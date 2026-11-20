"""Conversador por defecto: menú numerado. El LLM de Leonardo lo reemplaza con CONVERSADOR=llm (ADR-0003)."""
from app.compartido.formato import NOMBRE_FLUJO, fecha_larga, hora_corta
from app.compartido.tipos import ErrorDeNegocio, Flujo, Franja, NoEncontrado
from app.modulos.contenidos import contrato as contenidos
from app.modulos.solicitudes import contrato as solicitudes
from app.modulos.whatsapp.contrato import Herramientas, Respuesta, SolicitudResumida, Turno
from app.modulos.whatsapp.respuestas import texto as plantilla

OPCIONES_MENU = ("1 Pedir recolección de orgánicos\n2 Pedir recolección de reciclables\n"
                 "3 Ver mis solicitudes\n4 Ver mis puntos\n5 Aprender a separar")
OPCIONES_FRANJAS = "1 Mañana\n2 Tarde\n3 Noche"
FRANJA_ELEGIDA = {"1": Franja.MANANA, "2": Franja.TARDE, "3": Franja.NOCHE}


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
            textos = [plantilla("menu_inicio", nombre=turno.nombre, opciones=OPCIONES_MENU, comando="CANCELAR")]
        return Respuesta(textos=textos, memoria=memoria)


def texto_de_pieza(contenido: contenidos.ContenidoVista) -> str:
    enlace = f"\n{contenido.url}" if contenido.url else ""
    return plantilla("menu_pieza", titulo=contenido.titulo, texto=contenido.texto_corto, enlace=enlace)


def _pedir(texto: str, memoria: dict, herramientas: Herramientas) -> list[str]:
    franja = FRANJA_ELEGIDA.get(texto)
    if franja is None:
        return [plantilla("menu_franjas", opciones=OPCIONES_FRANJAS)]
    try:
        herramientas.pedir_recoleccion(Flujo(memoria.pop("pidiendo")), franja)
    except ErrorDeNegocio as error:
        return [str(error)]
    return []  # el aviso de «recibida» ya lleva el código


def _empezar_pedido(flujo: Flujo):
    def opcion(memoria: dict, herramientas: Herramientas) -> list[str]:
        memoria["pidiendo"] = flujo.value
        return [plantilla("menu_franjas", opciones=OPCIONES_FRANJAS)]
    return opcion


def _cancelar(codigo: str, herramientas: Herramientas) -> list[str]:
    try:
        herramientas.cancelar(codigo)
    except (ErrorDeNegocio, NoEncontrado) as error:
        return [str(error)]
    return []  # el aviso de cancelación ya sale


def _estado(memoria: dict, herramientas: Herramientas) -> list[str]:
    lineas = [_linea_de_estado(s) for s in herramientas.mis_solicitudes()[:5]]
    return ["\n".join(lineas) or plantilla("menu_sin_solicitudes")]


def _linea_de_estado(s: SolicitudResumida) -> str:
    estado = plantilla(f"menu_estado_{s.estado.value}")
    linea = plantilla("menu_linea_estado", codigo=s.codigo, flujo=NOMBRE_FLUJO[s.flujo], estado=estado)
    if s.estado == solicitudes.Estado.PROGRAMADA:
        linea += plantilla("menu_turno_programado", dia=fecha_larga(s.dia), hora=hora_corta(s.hora))
    return linea


def _puntos(memoria: dict, herramientas: Herramientas) -> list[str]:
    canje = [texto_de_pieza(c) for c in herramientas.que_puedo_canjear()]
    return ["\n\n".join([plantilla("menu_puntos", puntos=herramientas.mis_puntos()), *canje])]


def _aprender(memoria: dict, herramientas: Herramientas) -> list[str]:
    return [texto_de_pieza(c) for c in herramientas.aprender()] or [plantilla("menu_sin_material")]


_OPCIONES = {
    "1": _empezar_pedido(Flujo.ORGANICO),
    "2": _empezar_pedido(Flujo.RECICLABLE),
    "3": _estado,
    "4": _puntos,
    "5": _aprender,
}
