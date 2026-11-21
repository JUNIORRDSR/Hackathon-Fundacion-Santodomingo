"""Las herramientas que el agente puede pedir (ADR-0016): un catálogo cerrado, atado al vecino por el sistema.
Canjear y cancelar exigen que el vecino confirme en un mensaje posterior: lo hace cumplir el código, no el prompt."""
import json
import logging
from dataclasses import dataclass, field

from app.compartido.formato import NOMBRE_FLUJO, dia_local, fecha_larga, hora_corta, kilos
from app.compartido.tipos import ErrorDeNegocio, Flujo, Franja, NoEncontrado
from app.modulos.solicitudes import contrato as solicitudes
from app.modulos.whatsapp import carteles
from app.modulos.whatsapp.contrato import Herramientas, SolicitudResumida

log = logging.getLogger("whatsapp.agente")
CONFIRMAR = {"requiere_confirmacion": True, "indicacion": "Todavía no se hizo. Pide al vecino que confirme en su "
             "próximo mensaje y vuelve a llamar la herramienta solo si dice que sí."}
_TURNOS_PARA_CONFIRMAR = 2


def _funcion(nombre: str, descripcion: str, /, **propiedades: dict) -> dict:
    parametros = {"type": "object", "properties": propiedades, "required": list(propiedades),
                  "additionalProperties": False}
    return {"type": "function", "name": nombre, "description": descripcion, "parameters": parametros, "strict": True}


_TIPO = {"type": "string", "enum": [flujo.value for flujo in Flujo]}
_TEMAS = "; ".join(f"{tema}: {descripcion}" for tema, (_, descripcion) in carteles.TEMAS.items())
CATALOGO = [
    _funcion("consultar_recolecciones", "Solicitudes recientes del vecino: estado, día y hora programados, kilos, "
             "puntos ganados y motivo si la rechazaron."),
    _funcion("pedir_recoleccion", "Registra una solicitud. La coordinación fija el día y la hora y el sistema le manda "
             "al vecino el aviso con el código para la bolsa.", tipo=_TIPO,
             franja={"type": "string", "enum": [franja.value for franja in Franja]},
             observaciones={"type": ["string", "null"], "description": "Detalle útil para quien recoge, sin datos "
                            "personales"}),
    _funcion("cancelar_recoleccion", "Cancela una solicitud abierta del vecino. Requiere su confirmación.",
             codigo={"type": "string", "description": "Como ORG-0012 o REC-0003"}),
    _funcion("consultar_puntos", "Puntos disponibles para canjear y los últimos movimientos con su explicación."),
    _funcion("ver_premios", "Premios activos, su costo en puntos y si al vecino le alcanzan."),
    _funcion("canjear_premio", "Aparta los puntos de un premio. Requiere la confirmación del vecino.",
             premio_id={"type": "string", "description": "El premio_id que dio ver_premios"}),
    _funcion("consultar_canjes", "Canjes del vecino y su estado: pedido (por reclamar en la huerta), entregado o "
             "cancelado."),
    _funcion("cambiar_mi_nombre", "Cambia el nombre o alias con el que llamamos al vecino, si él lo pide.",
             nombre={"type": "string"}),
    _funcion("consultar_guias", "Guías de separación publicadas por la fundación.",
             tipo={"type": ["string", "null"], "enum": [*_TIPO["enum"], None]}),
    _funcion("enviar_cartel", f"Adjunta a tu respuesta un cartel ilustrado (uno por mensaje). Temas: {_TEMAS}.",
             tema={"type": "string", "enum": list(carteles.TEMAS)}),
]


@dataclass
class Acciones:
    """Ejecuta lo que pide el modelo con la identidad del vecino y anota lo que sale con la respuesta."""

    herramientas: Herramientas
    memoria: dict
    cartel: str | None = None
    con_aviso: bool = False  # el sistema ya le mandó al vecino un aviso (recibida o cancelada) en este turno
    hechos: list[str] = field(default_factory=list)  # lo que cambió sin aviso; sale si Azure falla después

    def ejecutar(self, nombre: str, argumentos: str) -> str:
        try:
            datos = json.loads(argumentos or "{}")
            resultado = _ACCIONES[nombre](self, **datos)
        except (ErrorDeNegocio, NoEncontrado) as error:
            resultado = {"error": str(error)}
        except (KeyError, TypeError, ValueError):
            log.warning("El agente pidió una herramienta inválida: %s", nombre, exc_info=True)
            resultado = {"error": "Esa herramienta o esos datos no son válidos."}
        return json.dumps(resultado, ensure_ascii=False, default=str)


def _confirmado(a: Acciones, accion: str, valor: str) -> bool:
    """Vale si la misma acción quedó propuesta en uno de los dos turnos anteriores; si no, queda propuesta."""
    turno, pendiente = a.memoria.get("turno_agente", 0), a.memoria.get("por_confirmar") or {}
    if (pendiente.get("accion"), pendiente.get("valor")) == (accion, valor) and \
            0 < turno - pendiente.get("turno", turno) <= _TURNOS_PARA_CONFIRMAR:
        a.memoria.pop("por_confirmar")
        return True
    a.memoria["por_confirmar"] = {"accion": accion, "valor": valor, "turno": turno}
    return False


def _recolecciones(a: Acciones) -> dict:
    ganados = {m.codigo: m.puntos for m in a.herramientas.mis_movimientos() if m.puntos > 0}
    return {"recolecciones": [_solicitud(s, ganados.get(s.codigo)) for s in a.herramientas.mis_solicitudes()[:6]]}


def _solicitud(s: SolicitudResumida, puntos: int | None) -> dict:
    return {"codigo": s.codigo, "tipo": NOMBRE_FLUJO[s.flujo], "estado": s.estado.value,
            "franja_preferida": s.preferencia, "dia": fecha_larga(s.dia) if s.dia else None,
            "hora": hora_corta(s.hora) if s.hora else None, "kg": kilos(s.kg) if s.kg else None,
            "puntos_ganados": puntos, "motivo_del_rechazo": s.motivo or None}


def _pedir(a: Acciones, tipo: str, franja: str, observaciones: str | None) -> dict:
    foto = a.memoria.get("foto")
    nueva = a.herramientas.pedir_recoleccion(Flujo(tipo), Franja(franja), (observaciones or "")[:300], foto_url=foto)
    a.memoria.pop("foto", None)
    a.con_aviso = True
    return {"codigo": nueva.codigo, "estado": nueva.estado.value, "foto_adjunta": foto is not None,
            "nota": "El vecino YA recibió un aviso con el código y los siguientes pasos. Responde como mucho una "
                    "frase corta que no repita el código ni los pasos, o deja tu respuesta vacía."}


def _cancelar(a: Acciones, codigo: str) -> dict:
    codigo = codigo.strip().upper()
    abiertas = {s.codigo for s in a.herramientas.mis_solicitudes() if s.estado in solicitudes.ABIERTOS}
    if codigo not in abiertas:
        return {"error": f"El vecino no tiene una solicitud abierta con el código {codigo}."}
    if not _confirmado(a, "cancelar", codigo):
        return {**CONFIRMAR, "codigo": codigo}
    a.herramientas.cancelar(codigo)
    a.con_aviso = True
    return {"codigo": codigo, "estado": "cancelada", "nota": "El sistema ya le mandó el aviso de cancelación."}


def _puntos(a: Acciones) -> dict:
    movimientos = a.herramientas.mis_movimientos()[-5:]
    return {"disponibles": a.herramientas.mis_puntos(), "ultimos_movimientos": [
        {"codigo": m.codigo, "puntos": m.puntos, "explicacion": m.explicacion, "fecha": fecha_larga(dia_local(m.fecha))}
        for m in reversed(movimientos)]}


def _premios(a: Acciones) -> dict:
    disponibles = a.herramientas.mis_puntos()
    return {"disponibles": disponibles, "premios": [
        {"premio_id": str(p.id), "nombre": p.nombre, "costo": p.costo, "le_alcanza": p.costo <= disponibles}
        for p in a.herramientas.premios()]}


def _canjear(a: Acciones, premio_id: str) -> dict:
    premio = next((p for p in a.herramientas.premios() if str(p.id) == premio_id.strip()), None)
    if premio is None:
        return {"error": "Ese premio no está en la lista; consulta ver_premios."}
    faltan = premio.costo - a.herramientas.mis_puntos()
    if faltan > 0:
        return {"error": f"Le faltan {faltan} puntos para {premio.nombre}."}
    if not _confirmado(a, "canje", str(premio.id)):
        return {**CONFIRMAR, "premio": premio.nombre, "costo": premio.costo}
    canje = a.herramientas.pedir_canje(premio.id)
    a.hechos.append(f"Listo: aparté {canje.costo} puntos para {canje.premio}. Muestra el código *{canje.codigo}* "
                    "en la huerta para reclamarlo.")
    return {"codigo": canje.codigo, "premio": canje.premio, "costo": canje.costo,
            "puntos_que_le_quedan": a.herramientas.mis_puntos(), "nota": "Se reclama en la huerta con ese código."}


def _canjes(a: Acciones) -> dict:
    return {"canjes": [{"codigo": c.codigo, "premio": c.premio, "costo": c.costo, "estado": c.estado.value,
                        "pedido": fecha_larga(dia_local(c.pedido_en)),
                        "cerrado": fecha_larga(dia_local(c.cerrado_en)) if c.cerrado_en else None}
                       for c in a.herramientas.mis_canjes()[:6]]}


def _nombre(a: Acciones, nombre: str) -> dict:
    nuevo = a.herramientas.cambiar_mi_nombre(nombre)
    a.hechos.append(f"Listo, desde ahora te llamamos {nuevo}.")
    return {"nombre": nuevo, "nota": "Desde ahora lo llamamos así."}


def _guias(a: Acciones, tipo: str | None) -> dict:
    piezas = a.herramientas.aprender(Flujo(tipo) if tipo else None)
    return {"guias": [{"titulo": p.titulo, "texto": p.texto_corto, "pasos": p.pasos} for p in piezas[:4]]}


def _cartel(a: Acciones, tema: str) -> dict:
    a.cartel = carteles.url(tema)
    return {"adjuntado": carteles.TEMAS[tema][1], "nota": "La imagen sale con tu texto; no pegues enlaces."}


_ACCIONES = {
    "consultar_recolecciones": _recolecciones, "pedir_recoleccion": _pedir, "cancelar_recoleccion": _cancelar,
    "consultar_puntos": _puntos, "ver_premios": _premios, "canjear_premio": _canjear, "consultar_canjes": _canjes,
    "cambiar_mi_nombre": _nombre, "consultar_guias": _guias, "enviar_cartel": _cartel,
}
