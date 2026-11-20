"""Conversador por defecto: menú numerado. El LLM de Leonardo lo reemplaza con CONVERSADOR=llm (ADR-0003)."""
from app.compartido.formato import NOMBRE_FLUJO, fecha_larga, hora_corta
from app.compartido.tipos import ErrorDeNegocio, Flujo, Franja, NoEncontrado
from app.modulos.contenidos import contrato as contenidos
from app.modulos.solicitudes import contrato as solicitudes
from app.modulos.whatsapp.contrato import Herramientas, Respuesta, SolicitudResumida, Turno

MENU = ("¿Qué quieres hacer?\n1 Pedir recolección de orgánicos\n2 Pedir recolección de reciclables\n"
        "3 Ver mis solicitudes\n4 Ver mis puntos\n5 Aprender a separar\n"
        "Para cancelar, escribe CANCELAR y el código (por ejemplo, CANCELAR ORG-0001).")
FRANJAS = "¿A qué hora te queda mejor?\n1 Mañana\n2 Tarde\n3 Noche"
FRANJA_ELEGIDA = {"1": Franja.MANANA, "2": Franja.TARDE, "3": Franja.NOCHE}
ESTADO = {"recibida": "recibida; la coordinación la está revisando", "asignada": "asignada; falta acordar día y hora",
          "programada": "programada", "recolectada": "recolectada", "rechazada": "rechazada",
          "cancelada": "cancelada"}


class ConversadorMenu:
    """Responde a los números del menú; la memoria solo guarda qué flujo se está pidiendo."""

    def responder(self, turno: Turno, memoria: dict, herramientas: Herramientas) -> Respuesta:
        texto = turno.texto.strip().lower()
        if "pidiendo" in memoria:
            textos = _pedir(texto, memoria, herramientas)
        elif texto in _OPCIONES:
            textos = _OPCIONES[texto](memoria, herramientas)
        elif texto.startswith("cancelar"):
            textos = _cancelar(texto.removeprefix("cancelar").strip(), herramientas)
        else:
            textos = [f"Hola, {turno.nombre}. {MENU}"]
        return Respuesta(textos=textos, memoria=memoria)


def texto_de_pieza(contenido: contenidos.ContenidoVista) -> str:
    return f"*{contenido.titulo}*\n{contenido.texto_corto}" + (f"\n{contenido.url}" if contenido.url else "")


def _pedir(texto: str, memoria: dict, herramientas: Herramientas) -> list[str]:
    franja = FRANJA_ELEGIDA.get(texto)
    if franja is None:
        return [FRANJAS]
    try:
        herramientas.pedir_recoleccion(Flujo(memoria.pop("pidiendo")), franja)
    except ErrorDeNegocio as error:
        return [str(error)]
    return []  # el aviso de «recibida» ya lleva el código


def _empezar_pedido(flujo: Flujo):
    def opcion(memoria: dict, herramientas: Herramientas) -> list[str]:
        memoria["pidiendo"] = flujo.value
        return [FRANJAS]
    return opcion


def _cancelar(codigo: str, herramientas: Herramientas) -> list[str]:
    try:
        herramientas.cancelar(codigo)
    except (ErrorDeNegocio, NoEncontrado) as error:
        return [str(error)]
    return []  # el aviso de cancelación ya sale


def _estado(memoria: dict, herramientas: Herramientas) -> list[str]:
    lineas = [_linea_de_estado(s) for s in herramientas.mis_solicitudes()[:5]]
    return ["\n".join(lineas) or "Todavía no tienes solicitudes."]


def _linea_de_estado(s: SolicitudResumida) -> str:
    linea = f"{s.codigo} ({NOMBRE_FLUJO[s.flujo]}): {ESTADO[s.estado]}"
    if s.estado == solicitudes.Estado.PROGRAMADA:
        linea += f" para el {fecha_larga(s.dia)} a las {hora_corta(s.hora)}"
    return linea


def _puntos(memoria: dict, herramientas: Herramientas) -> list[str]:
    return [f"Llevas {herramientas.mis_puntos()} puntos."]


def _aprender(memoria: dict, herramientas: Herramientas) -> list[str]:
    return [texto_de_pieza(c) for c in herramientas.aprender()] or ["Pronto tendremos material."]


_OPCIONES = {
    "1": _empezar_pedido(Flujo.ORGANICO),
    "2": _empezar_pedido(Flujo.RECICLABLE),
    "3": _estado,
    "4": _puntos,
    "5": _aprender,
}
