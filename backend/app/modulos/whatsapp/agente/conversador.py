"""El agente de WhatsApp (ADR-0016): el modelo conversa con el vecino y actúa con herramientas cerradas. Si Azure falla
o se acaba el plazo de Twilio, responde el diálogo local; las salvaguardas de Azure tienen una respuesta fija."""
import logging
import re
import time

from app.modulos.whatsapp.agente import contexto, dialogo
from app.modulos.whatsapp.agente.cliente import AgenteNoDisponible, ClienteAzure, ContenidoBloqueado
from app.modulos.whatsapp.agente.herramientas import CATALOGO, Acciones
from app.modulos.whatsapp.agente.memoria import PASOS, registrar_actividad, vigente as memoria_vigente
from app.modulos.whatsapp.contrato import Herramientas, Respuesta, Turno
from app.modulos.whatsapp.respuestas import texto as plantilla

log = logging.getLogger("whatsapp.agente")
RONDAS = 4  # llamadas al modelo por turno: pocas herramientas encadenadas y una respuesta
MINIMO = 2.5  # segundos que necesita una llamada; con menos, responde el diálogo local
LARGO = 1500  # el cuerpo de WhatsApp en Twilio admite 1600
_TUTEO = {"querés": "quieres", "tenés": "tienes", "podés": "puedes", "sabés": "sabes", "preferís": "prefieres",
          "decime": "dime", "contame": "cuéntame", "mirá": "mira", "fijate": "fíjate"}
_VOSEO = re.compile(r"\b(?:" + "|".join(_TUTEO) + r")\b", re.IGNORECASE)


class ConversadorAgente:
    def __init__(self, cliente: ClienteAzure | None):
        self._cliente = cliente

    @classmethod
    def desde_entorno(cls) -> "ConversadorAgente":
        return cls(ClienteAzure.desde_entorno())

    def responder(self, turno: Turno, memoria: dict, herramientas: Herramientas) -> Respuesta:
        acciones = Acciones(herramientas, memoria_vigente(memoria))
        try:
            return self._conversar(turno, acciones)
        except ContenidoBloqueado:
            log.info("Las salvaguardas de Azure frenaron un mensaje")
            return Respuesta(textos=[plantilla("agente_fuera_de_alcance")], memoria=acciones.memoria)
        except AgenteNoDisponible as error:
            log.warning("El agente no respondió (%s); responde el diálogo local", error)
        except Exception:
            log.exception("El agente falló; responde el diálogo local")
        return _respaldo(turno, acciones)

    def _conversar(self, turno: Turno, acciones: Acciones) -> Respuesta:
        if self._cliente is None:
            raise AgenteNoDisponible("Falta configurar Azure OpenAI")
        limite = time.monotonic() + turno.segundos
        acciones.memoria["turno_agente"] = acciones.memoria.get("turno_agente", 0) + 1
        entrada, instrucciones = contexto.entrada(turno), contexto.instrucciones(turno.nombre)
        for _ in range(RONDAS):
            salida = self._cliente.responder(instrucciones, entrada, CATALOGO, _restante(limite))
            llamadas = [item for item in salida if item.get("type") == "function_call"]
            if not llamadas:
                return _final(salida, acciones)
            entrada += salida + [{"type": "function_call_output", "call_id": llamada.get("call_id"),
                                  "output": acciones.ejecutar(llamada.get("name", ""), llamada.get("arguments", ""))}
                                 for llamada in llamadas]
        raise AgenteNoDisponible("El modelo encadenó demasiadas herramientas")


def _restante(limite: float) -> float:
    restante = limite - time.monotonic()
    if restante < MINIMO:
        raise AgenteNoDisponible("Se acabó el plazo de Twilio")
    return restante


def _final(salida: list[dict], acciones: Acciones) -> Respuesta:
    texto = para_whatsapp(" ".join(_textos(salida)))
    if not texto and not acciones.con_aviso and not acciones.cartel:
        raise AgenteNoDisponible("El modelo no escribió nada")
    for paso in PASOS:  # el diálogo local deja borradores; el agente ya sigue la conversación por el historial
        acciones.memoria.pop(paso, None)
    registrar_actividad(acciones.memoria)
    return Respuesta(textos=[texto] if texto else [], memoria=acciones.memoria, media_url=acciones.cartel)


def _textos(salida: list[dict]) -> list[str]:
    return [parte["text"] for item in salida if item.get("type") == "message" and item.get("role") == "assistant"
            for parte in item.get("content") or [] if isinstance(parte, dict) and parte.get("type") == "output_text"
            and isinstance(parte.get("text"), str)]


def para_whatsapp(texto: str) -> str:
    """Corrige el Markdown que WhatsApp no entiende (**negrita**, títulos con #, enlaces con corchetes) y el voseo
    que se le escapa al modelo: en la costa se tutea."""
    texto = _VOSEO.sub(_tutear, texto)
    texto = re.sub(r"\*\*(.+?)\*\*", r"*\1*", texto)
    texto = re.sub(r"^#{1,6}\s*", "", texto, flags=re.M)
    texto = re.sub(r"\[([^\]]+)\]\((https?://[^)\s]+)\)", r"\1: \2", texto).strip()
    return texto if len(texto) <= LARGO else texto[:LARGO].rsplit("\n", 1)[0].strip()


def _tutear(voseo: re.Match) -> str:
    tuteo = _TUTEO[voseo[0].lower()]
    return tuteo.capitalize() if voseo[0][0].isupper() else tuteo


def _respaldo(turno: Turno, acciones: Acciones) -> Respuesta:
    """Sin agente, lo que ya se hizo en el turno se confirma tal cual (el diálogo no lo repite), la revisión de la
    foto sale con su texto fijo y lo demás lo atiende el diálogo local."""
    if acciones.hechos or acciones.con_aviso:
        return Respuesta(textos=acciones.hechos, memoria=acciones.memoria)
    if turno.revision:
        return Respuesta(textos=turno.revision, memoria=acciones.memoria)
    return dialogo.responder(turno, acciones.memoria, acciones.herramientas)
