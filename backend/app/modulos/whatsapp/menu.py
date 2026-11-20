"""Conversador por defecto: menú numerado. El LLM lo reemplaza con CONVERSADOR=llm (ADR-0003).
Los textos viven en respuestas.json y se pueden editar sin tocar el código (Jorge)."""
from uuid import UUID

from app.compartido.formato import NOMBRE_FLUJO, fecha_larga, hora_corta
from app.compartido.tipos import ErrorDeNegocio, Flujo, Franja, NoEncontrado
from app.modulos.contenidos import contrato as contenidos
from app.modulos.solicitudes import contrato as solicitudes
from app.modulos.whatsapp.contrato import Herramientas, Respuesta, SolicitudResumida, Turno
from app.modulos.whatsapp.respuestas import texto as plantilla

OPCIONES_MENU = ("1 Pedir recolección de orgánicos\n2 Pedir recolección de reciclables\n"
                 "3 Ver mis solicitudes\n4 Ver mis puntos y canjear\n5 Aprender a separar")
OPCIONES_FRANJAS = "1 Mañana\n2 Tarde\n3 Noche"
FRANJA_ELEGIDA = {"1": Franja.MANANA, "2": Franja.TARDE, "3": Franja.NOCHE}


class ConversadorMenu:
    """Responde a los números del menú; la memoria guarda qué flujo se pide o qué premios se ofrecieron."""

    def responder(self, turno: Turno, memoria: dict, herramientas: Herramientas) -> Respuesta:
        texto = turno.texto.strip().lower()
        if turno.media_url:
            memoria["foto"] = turno.media_url  # la foto es opcional y se guarda con el pedido
        if "pidiendo" in memoria:
            textos = _pedir(texto, memoria, herramientas)
        elif "canjeando" in memoria:
            textos = _canjear(texto, memoria.pop("canjeando"), turno.nombre, herramientas)
        elif texto in _OPCIONES:
            textos = _OPCIONES[texto](memoria, herramientas)
        elif texto.startswith("cancelar"):
            textos = _cancelar(texto.removeprefix("cancelar").strip(), herramientas)
        else:
            textos = [menu(turno.nombre)]
        return Respuesta(textos=textos, memoria=memoria)


def menu(nombre: str) -> str:
    return plantilla("menu_inicio", nombre=nombre, opciones=OPCIONES_MENU, comando="CANCELAR")


def texto_de_pieza(contenido: contenidos.ContenidoVista) -> str:
    pasos = "".join(f"\n• {paso}" for paso in contenido.pasos)
    enlace = f"\n{contenido.url}" if contenido.url else ""
    return plantilla("menu_pieza", titulo=contenido.titulo, texto=contenido.texto_corto + pasos, enlace=enlace)


def _franjas() -> str:
    return plantilla("menu_franjas", opciones=OPCIONES_FRANJAS)


def _pedir(texto: str, memoria: dict, herramientas: Herramientas) -> list[str]:
    franja = FRANJA_ELEGIDA.get(texto)
    if franja is None:
        return [_franjas()]
    try:
        herramientas.pedir_recoleccion(Flujo(memoria.pop("pidiendo")), franja, foto_url=memoria.pop("foto", None))
    except ErrorDeNegocio as error:
        return [str(error)]
    return []  # el aviso de «recibida» ya lleva el código


def _empezar_pedido(flujo: Flujo):
    def opcion(memoria: dict, herramientas: Herramientas) -> list[str]:
        memoria["pidiendo"] = flujo.value
        return [_franjas()]
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
    saldo, premios = plantilla("menu_puntos", puntos=herramientas.mis_puntos()), herramientas.premios()
    if not premios:
        return [saldo]
    memoria["canjeando"] = [str(p.id) for p in premios]
    lista = "\n".join(f"{i} {p.nombre}: {p.costo} puntos" for i, p in enumerate(premios, start=1))
    ejemplo = plantilla("menu_canje_ejemplo") if any(p.ejemplo for p in premios) else ""
    return [plantilla("menu_canje_lista", saldo=saldo, lista=lista, ejemplo=ejemplo)]


def _canjear(texto: str, ofrecidos: list[str], nombre: str, herramientas: Herramientas) -> list[str]:
    if not texto.isdigit() or not 1 <= int(texto) <= len(ofrecidos):
        return [menu(nombre)]
    try:
        canje = herramientas.pedir_canje(UUID(ofrecidos[int(texto) - 1]))
    except (ErrorDeNegocio, NoEncontrado) as error:
        return [str(error)]
    return [plantilla("menu_canje_apartado", premio=canje.premio, codigo=canje.codigo, costo=canje.costo)]


def _aprender(memoria: dict, herramientas: Herramientas) -> list[str]:
    return [texto_de_pieza(c) for c in herramientas.aprender()] or [plantilla("menu_sin_material")]


_OPCIONES = {
    "1": _empezar_pedido(Flujo.ORGANICO),
    "2": _empezar_pedido(Flujo.RECICLABLE),
    "3": _estado,
    "4": _puntos,
    "5": _aprender,
}
