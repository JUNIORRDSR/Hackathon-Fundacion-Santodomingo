"""Diálogo breve de WhatsApp: conserva el borrador y canaliza las acciones al dominio."""
import re

from app.compartido.tipos import Flujo, Franja
from app.modulos.whatsapp.agente.lenguaje import normalizar
from app.modulos.whatsapp.agente.memoria import PASOS, registrar_actividad, retirar_borrador, vigente as memoria_vigente
from app.modulos.whatsapp.contrato import Herramientas, Respuesta, Turno
from app.modulos.whatsapp.menu import FRANJA_ELEGIDA, ConversadorMenu, menu, texto_de_pieza
from app.modulos.whatsapp.respuestas import texto as plantilla

_MENU = ConversadorMenu()
_TIPOS = {
    Flujo.ORGANICO: frozenset(("organico", "organicos", "organica", "organicas")),
    Flujo.RECICLABLE: frozenset(("reciclable", "reciclables", "reciclaje")),
}
_NUMERO_FRANJA = {franja: numero for numero, franja in FRANJA_ELEGIDA.items()}
_LECTURAS = frozenset(("estado", "puntos", "canjes", "aprender", "informacion", "aprender_organico",
                       "aprender_reciclable"))
_SALUDOS = frozenset(("hola", "buenas", "buenos dias", "buenas tardes", "buenas noches", "hola buenas"))
_SALIR = frozenset(("0", "volver", "mejor no", "dejarlo", "olvidalo", "cancelar"))
_DUDA = re.compile(r"\b(?:no|nunca|ni|tampoco|o|ignora|instrucciones|prompt)\b")
_CANCELAR = re.compile(r"(?:cancelar|cancela)(?: (?:mi|la|el) (?:solicitud|pedido))? ((?:org|rec)-[0-9]+)")
_SOLICITAR = (r"(?:(?:quiero|quisiera|necesito|solicito) (?:que (?:recojan|recolecten)|"
              r"(?:pedir )?(?:una )?recoleccion(?: de)?)|(?:pueden|puedes|podrian) (?:recoger|recolectar|pasar por)|"
              r"recoger|recoge|recojan|recolectar|recolecten|(?:una )?recoleccion(?: de)?)")
_MATERIAL = r"(?:(?:mis|los|las|residuos) )*(?:organicos?|organicas?|reciclables?|reciclaje)"
_CORTESIA = r"(?:,? (?:por favor|si se puede))?"
_SOLICITUD_CON_FRANJA = re.compile(
    rf"{_SOLICITAR}(?: {_MATERIAL})?(?: hoy| manana)? (?:por|en|de) la (manana|tarde|noche){_CORTESIA}"
)
_PREFERENCIA = re.compile(r"(?:(?:me queda mejor|mejor|prefiero|puede ser) )?(?:(?:hoy|manana) (?=por|en|de))?"
                         rf"(?:(?:por|en|de) la |la )?(manana|tarde|noche){_CORTESIA}")


def _texto_plano(texto: str) -> str:
    return " ".join(normalizar(texto).split()).strip(" ¿?¡!.,")


def responder(turno: Turno, memoria: dict, herramientas: Herramientas, intencion: str | None = None) -> Respuesta:
    texto = _texto_plano(turno.texto)
    vigente = memoria_vigente(memoria)
    if turno.media_url:
        vigente["foto"] = turno.media_url
    textos = _comando(texto, turno, vigente, herramientas)
    if textos is None:
        textos = _dialogar(texto, intencion, turno, vigente, herramientas)
    registrar_actividad(vigente)
    return Respuesta(textos=textos, memoria=vigente)


def _menu(texto: str, turno: Turno, memoria: dict, herramientas: Herramientas) -> list[str]:
    return _MENU.responder(turno.model_copy(update={"texto": texto}), memoria, herramientas).textos


def _comando(texto: str, turno: Turno, memoria: dict, herramientas: Herramientas) -> list[str] | None:
    if texto in ("menu", "ayuda", "opciones", "ver opciones"):
        retirar_borrador(memoria)
        return [menu(turno.nombre)]
    if texto in _SALIR:
        retirar_borrador(memoria)
        return [plantilla("agente_volver")]
    cancelar = _CANCELAR.fullmatch(texto)
    if cancelar:
        return _menu(f"cancelar {cancelar[1]}", turno, {}, herramientas)
    if not re.fullmatch(r"[0-9]{1,3}", texto) or "esperando_flujo" in memoria:
        return None
    if "pidiendo" in memoria and texto not in FRANJA_ELEGIDA:
        return [plantilla("agente_franja")]
    return _menu(texto, turno, memoria, herramientas)


def _dialogar(texto: str, intencion: str | None, turno: Turno, memoria: dict, herramientas: Herramientas) -> list[str]:
    lectura = _consulta_local(texto) or (intencion if intencion in _LECTURAS and not _DUDA.search(texto) else None)
    if lectura:
        return _consultar(lectura, turno, memoria, herramientas)
    if memoria.get("ofrecio_canjes") and texto in ("si", "si por favor", "si, por favor", "muestrame", "dale"):
        return _consultar("canjes", turno, memoria, herramientas)
    flujo = _flujo(texto)
    if "esperando_aprender" in memoria and flujo and re.fullmatch(rf"(?:de |sobre )?{_MATERIAL}", texto):
        return _consultar(f"aprender_{flujo}", turno, memoria, herramientas)
    if texto in _SALUDOS or intencion == "saludo":
        return [plantilla("agente_saludo", nombre=turno.nombre)]
    if texto in ("gracias", "muchas gracias", "mil gracias", "listo gracias"):
        return [plantilla("agente_gracias")]
    pedido = _recoleccion(texto, intencion, turno, memoria, herramientas)
    if pedido is not None:
        return pedido
    return _premio(texto, turno, memoria, herramientas) if "canjeando" in memoria else [plantilla("agente_orientacion")]


def _consulta_local(texto: str) -> str | None:
    if _DUDA.search(texto):
        return None
    consulta_saldo = (r"(?:(?:me )?(?:puedes decir|dime) |quiero (?:saber|ver) )?"
                      r"(?:cuantos puntos tengo|cuanto saldo tengo|mi saldo|mis puntos)")
    if re.fullmatch(consulta_saldo, texto):
        return "puntos"
    if re.fullmatch(r"(?:que puedo canjear|que premios hay|ver premios|premios|canjes)", texto):
        return "canjes"
    if re.fullmatch(r"(?:ver |consultar )?mis (?:solicitudes|pedidos|recolecciones)", texto):
        return "estado"
    if re.fullmatch(r"(?:como va|cuando pasan por|que paso con) mi (?:solicitud|pedido|recoleccion)", texto):
        return "estado"
    if re.fullmatch(r"(?:que es ecoconecta|como funciona ecoconecta|que hacen)", texto):
        return "informacion"
    if re.match(r"^(?:como (?:separo|se separan?)|aprender a separar)\b", texto):
        flujo = _flujo(texto)
        return f"aprender_{flujo}" if flujo else "aprender"
    return None


def _consultar(intencion: str, turno: Turno, memoria: dict, herramientas: Herramientas) -> list[str]:
    if intencion == "puntos":
        return _saldo(memoria, herramientas)
    if intencion == "canjes":
        retirar_borrador(memoria)
        return _menu("4", turno, memoria, herramientas)
    if intencion == "estado":
        return _menu("3", turno, {}, herramientas)
    if intencion == "informacion":
        return [plantilla("agente_informacion")]
    if intencion == "aprender":
        memoria["esperando_aprender"] = True
        return [plantilla("agente_aprender")]
    memoria.pop("esperando_aprender", None)
    flujo = Flujo(intencion.removeprefix("aprender_"))
    piezas = herramientas.aprender(flujo)
    pieza = next((pieza for pieza in piezas if pieza.flujo == flujo), None)
    return [texto_de_pieza(pieza or piezas[0])] if piezas else [plantilla("menu_sin_material")]


def _saldo(memoria: dict, herramientas: Herramientas) -> list[str]:
    if any(clave in memoria for clave in ("pidiendo", "esperando_flujo", "canjeando", "esperando_aprender")):
        return [plantilla("menu_puntos", puntos=herramientas.mis_puntos())]
    memoria["ofrecio_canjes"] = True
    return [plantilla("agente_puntos", puntos=herramientas.mis_puntos())]


def _flujo(texto: str) -> Flujo | None:
    flujos = _flujos(texto)
    return flujos[0] if len(flujos) == 1 else None


def _flujos(texto: str) -> list[Flujo]:
    palabras = set(re.findall(r"[a-z]+", texto))
    return [flujo for flujo, tipos in _TIPOS.items() if palabras & tipos]


def _recoleccion(texto: str, intencion: str | None, turno: Turno, memoria: dict,
                 herramientas: Herramientas) -> list[str] | None:
    if "pidiendo" in memoria:
        return _completar_preferencia(texto, turno, memoria, herramientas)
    if "esperando_flujo" in memoria:
        return _completar_flujo(texto, turno, memoria, herramientas)
    if _DUDA.search(texto):
        return None
    peticion = re.match(rf"^{_SOLICITAR}\b", texto)
    if not peticion and intencion not in ("organico", "reciclable", "recoleccion"):
        return None
    flujos = _flujos(texto)
    if not flujos and intencion in ("organico", "reciclable"):
        flujos.append(Flujo(intencion))
    flujo = flujos[0] if len(flujos) == 1 else None
    preferencia = _SOLICITUD_CON_FRANJA.fullmatch(texto)
    return _empezar(flujo, Franja(preferencia[1]) if preferencia else None, turno, memoria, herramientas)


def _completar_preferencia(texto: str, turno: Turno, memoria: dict, herramientas: Herramientas) -> list[str]:
    preferencia = _PREFERENCIA.fullmatch(texto)
    if preferencia:
        return _menu(_NUMERO_FRANJA[preferencia[1]], turno, memoria, herramientas)
    cambio = re.fullmatch(rf"mejor {_MATERIAL}", texto)
    if cambio and (flujo := _flujo(texto)) and flujo != memoria["pidiendo"]:
        memoria["pidiendo"] = flujo.value
        memoria.pop("foto", None)
    return [plantilla("agente_franja")]


def _completar_flujo(texto: str, turno: Turno, memoria: dict, herramientas: Herramientas) -> list[str]:
    if texto in ("1", "2"):
        flujo = Flujo.ORGANICO if texto == "1" else Flujo.RECICLABLE
    else:
        indica_material = re.fullmatch(rf"(?:son |tengo |voy a entregar )?{_MATERIAL}(?:,? por favor)?", texto)
        flujo = _flujo(texto) if indica_material else None
    preferencia = _PREFERENCIA.fullmatch(texto)
    if preferencia:
        memoria["esperando_flujo"] = preferencia[1]
    if not flujo:
        return [plantilla("agente_flujo")]
    anterior = memoria.pop("esperando_flujo")
    return _empezar(flujo, Franja(anterior) if anterior else None, turno, memoria, herramientas)


def _empezar(flujo: Flujo | None, franja: Franja | None, turno: Turno, memoria: dict,
             herramientas: Herramientas) -> list[str]:
    for clave in PASOS:
        memoria.pop(clave, None)
    if flujo is None:
        memoria["esperando_flujo"] = franja.value if franja else None
        return [plantilla("agente_flujo")]
    memoria["pidiendo"] = flujo.value
    if franja is not None:
        return _menu(_NUMERO_FRANJA[franja], turno, memoria, herramientas)
    return [plantilla("agente_franja")]


def _premio(texto: str, turno: Turno, memoria: dict, herramientas: Herramientas) -> list[str]:
    if len(texto) > 80 or _DUDA.search(texto):
        return [plantilla("agente_canje_pendiente")]
    nombre = re.sub(r"^(?:quiero (?:canjear |apartar )?|me quedo con )", "", texto)
    ofrecidos = memoria["canjeando"]
    candidatos = [str(premio.id) for premio in herramientas.premios() if str(premio.id) in ofrecidos
                  and _texto_plano(premio.nombre) == nombre]
    if len(candidatos) == 1:
        return _menu(str(ofrecidos.index(candidatos[0]) + 1), turno, memoria, herramientas)
    return [plantilla("agente_canje_pendiente")]
