"""Avisos al solicitante que salen por WhatsApp después del commit de cada evento (ADR-0003)."""
from uuid import UUID

from app.compartido.eventos import suscribir_despues
from app.compartido.formato import NOMBRE_FLUJO, fecha_larga, hora_corta, kilos
from app.compartido.tipos import Flujo
from app.modulos.contenidos import contrato as contenidos
from app.modulos.directorio import contrato as directorio
from app.modulos.puntos import contrato as puntos
from app.modulos.solicitudes import contrato as solicitudes
from app.modulos.whatsapp.bot import enviar
from app.modulos.whatsapp.contrato import MensajeSaliente
from app.modulos.whatsapp.menu import texto_de_pieza
from app.modulos.whatsapp.respuestas import texto as plantilla


def escuchar() -> None:
    suscribir_despues(solicitudes.SolicitudRecibida, _al_recibir)
    suscribir_despues(solicitudes.SolicitudProgramada, _al_programar)
    suscribir_despues(puntos.PuntosAcreditados, _al_acreditar)
    suscribir_despues(solicitudes.SolicitudRechazada, _al_rechazar)
    suscribir_despues(solicitudes.SolicitudCancelada, _al_cancelar)
    suscribir_despues(directorio.SolicitanteHabilitado, _al_habilitar)


def _avisar(solicitante_id: UUID, texto: str) -> None:
    enviar(MensajeSaliente(telefono=directorio.solicitante(solicitante_id).telefono, texto=texto))


def _al_recibir(e: solicitudes.SolicitudRecibida) -> None:
    colectivo = "huerteros" if e.flujo == Flujo.ORGANICO else "recicladores"
    _avisar(e.solicitante_id, plantilla("aviso_solicitud_recibida", codigo=e.codigo,
                                      flujo=NOMBRE_FLUJO[e.flujo], colectivo=colectivo))


def _al_programar(e: solicitudes.SolicitudProgramada) -> None:
    encargado = directorio.encargado(e.encargado_id).nombre
    # hora_corta ya termina en «a. m.» o «p. m.»: la frase no lleva punto final propio.
    _avisar(e.solicitante_id, plantilla("aviso_solicitud_programada", encargado=encargado, codigo=e.codigo,
                                      dia=fecha_larga(e.dia), hora=hora_corta(e.hora)))


def _al_acreditar(e: puntos.PuntosAcreditados) -> None:
    peso = f": {kilos(e.kg)} kg" if e.kg else ""
    _avisar(e.solicitante_id, plantilla("aviso_puntos_acreditados", flujo=NOMBRE_FLUJO[e.flujo], peso=peso,
                                      puntos=e.puntos, explicacion=e.explicacion, saldo=e.saldo, opcion="4"))


def _al_rechazar(e: solicitudes.SolicitudRechazada) -> None:
    pieza = contenidos.para_rechazo(e.flujo)
    texto = plantilla("aviso_solicitud_rechazada", codigo=e.codigo, motivo=e.motivo)
    _avisar(e.solicitante_id, texto + (f"\n\n{texto_de_pieza(pieza)}" if pieza else ""))


def _al_cancelar(e: solicitudes.SolicitudCancelada) -> None:
    _avisar(e.solicitante_id, plantilla("aviso_solicitud_cancelada", codigo=e.codigo))


def _al_habilitar(e: directorio.SolicitanteHabilitado) -> None:
    _avisar(e.solicitante_id, plantilla("aviso_solicitante_habilitado", comando="MENÚ"))
