"""Avisos al solicitante que salen por WhatsApp después del commit de cada evento (ADR-0003).
Los textos viven en respuestas.json (Jorge)."""
from uuid import UUID

from app.compartido.eventos import suscribir_despues
from app.compartido.formato import NOMBRE_FLUJO, fecha_larga, hora_corta, kilos
from app.compartido.tipos import ErrorDeNegocio, Flujo, Franja
from app.modulos.contenidos import contrato as contenidos
from app.modulos.directorio import contrato as directorio
from app.modulos.puntos import contrato as puntos
from app.modulos.solicitudes import contrato as solicitudes
from app.modulos.whatsapp import bot
from app.modulos.whatsapp.bot import enviar
from app.modulos.whatsapp.contrato import Herramientas, MensajeSaliente
from app.modulos.whatsapp.menu import texto_de_pieza
from app.modulos.whatsapp.respuestas import texto as plantilla

OPCION_PUNTOS = "4"


def escuchar() -> None:
    suscribir_despues(solicitudes.SolicitudRecibida, _al_recibir)
    suscribir_despues(solicitudes.SolicitudProgramada, _al_programar)
    suscribir_despues(puntos.PuntosAcreditados, _al_acreditar)
    suscribir_despues(puntos.CanjeEntregado, _al_entregar_canje)
    suscribir_despues(solicitudes.SolicitudRechazada, _al_rechazar)
    suscribir_despues(solicitudes.SolicitudCancelada, _al_cancelar)
    suscribir_despues(directorio.SolicitanteHabilitado, _al_habilitar)


def _avisar(solicitante_id: UUID, texto: str) -> None:
    enviar(MensajeSaliente(telefono=directorio.solicitante(solicitante_id).telefono, texto=texto))


def _al_recibir(e: solicitudes.SolicitudRecibida) -> None:
    colectivo = "huerteros" if e.flujo == Flujo.ORGANICO else "recicladores"
    _avisar(e.solicitante_id, plantilla("aviso_solicitud_recibida", codigo=e.codigo, flujo=NOMBRE_FLUJO[e.flujo],
                                        colectivo=colectivo))


def _al_programar(e: solicitudes.SolicitudProgramada) -> None:
    encargado = directorio.encargado(e.encargado_id).nombre
    _avisar(e.solicitante_id, plantilla("aviso_solicitud_programada", encargado=encargado, codigo=e.codigo,
                                        dia=fecha_larga(e.dia), hora=hora_corta(e.hora)))


def _al_acreditar(e: puntos.PuntosAcreditados) -> None:
    peso = f": {kilos(e.kg)} kg" if e.kg else ""
    disponible = puntos.disponible(e.solicitante_id)
    _avisar(e.solicitante_id, plantilla("aviso_puntos_acreditados", flujo=NOMBRE_FLUJO[e.flujo], codigo=e.codigo,
                                        peso=peso, puntos=e.puntos, explicacion=e.explicacion, saldo=disponible,
                                        alcance=_lo_que_alcanza(disponible)))


def _lo_que_alcanza(disponible: int) -> str:
    """Dice qué premio ya puede pedir o cuánto le falta para el más barato (ADR-0008)."""
    premios = puntos.premios(solo_activos=True)
    alcanza = [p for p in premios if p.costo <= disponible]
    if alcanza:
        return plantilla("aviso_premio_alcanza", premio=alcanza[-1].nombre, opcion=OPCION_PUNTOS)
    if premios:
        return plantilla("aviso_premio_falta", faltan=premios[0].costo - disponible, premio=premios[0].nombre,
                         opcion=OPCION_PUNTOS)
    return plantilla("aviso_ver_puntos", opcion=OPCION_PUNTOS)


def _al_entregar_canje(e: puntos.CanjeEntregado) -> None:
    _avisar(e.solicitante_id, plantilla("aviso_canje_entregado", codigo=e.codigo, premio=e.premio, saldo=e.saldo))


def _al_rechazar(e: solicitudes.SolicitudRechazada) -> None:
    pieza = contenidos.para_rechazo(e.flujo)
    texto = plantilla("aviso_solicitud_rechazada", codigo=e.codigo, motivo=e.motivo)
    _avisar(e.solicitante_id, texto + (f"\n\n{texto_de_pieza(pieza)}" if pieza else ""))


def _al_cancelar(e: solicitudes.SolicitudCancelada) -> None:
    _avisar(e.solicitante_id, plantilla("aviso_solicitud_cancelada", codigo=e.codigo))


def _al_habilitar(e: directorio.SolicitanteHabilitado) -> None:
    """Si dejó su primer pedido al registrarse, entra ahora: el aviso de «recibida» le da el código de la bolsa."""
    if e.asistido:  # lo registró la coordinación: bienvenida con el aviso de privacidad (ADR-0014)
        nombre = directorio.solicitante(e.solicitante_id).nombre
        _avisar(e.solicitante_id, plantilla("aviso_registro_asistido", nombre=nombre, comando="MENÚ"))
        return
    pedido = bot.tomar_pedido_en_espera(directorio.solicitante(e.solicitante_id).telefono)
    if pedido is None:
        _avisar(e.solicitante_id, plantilla("aviso_solicitante_habilitado", comando="MENÚ"))
        return
    _avisar(e.solicitante_id, plantilla("aviso_bienvenida_con_pedido"))
    try:
        Herramientas(e.solicitante_id).pedir_recoleccion(Flujo(pedido["flujo"]), Franja(pedido["preferencia"]))
    except ErrorDeNegocio as error:
        _avisar(e.solicitante_id, str(error))
