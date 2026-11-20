"""Entrada y salida de WhatsApp: cada mensaje va al registro o al conversador, y lo que sale queda registrado.
La pieza de Jorge entra con TRANSPORTE=twilio y la de Leonardo con CONVERSADOR=llm (ADR-0003)."""
import importlib
import logging
import os
from contextvars import ContextVar
from dataclasses import dataclass, field
from datetime import datetime, timezone

from sqlalchemy import Connection, func, insert, select
from sqlalchemy.dialects.postgresql import insert as insertar_o_actualizar

from app.compartido.bd import transaccion
from app.modulos.directorio import contrato as directorio
from app.modulos.whatsapp import registro
from app.modulos.whatsapp import tablas as t
from app.modulos.whatsapp.contrato import Conversador, Herramientas, MensajeEntrante, MensajeSaliente, Transporte, Turno
from app.modulos.whatsapp.menu import ConversadorMenu
from app.modulos.whatsapp.respuestas import texto

log = logging.getLogger("whatsapp")


@dataclass
class _RespuestaWebhook:
    telefono: str
    mensajes: list[MensajeSaliente] = field(default_factory=list)


_respuesta_webhook: ContextVar[_RespuestaWebhook | None] = ContextVar("respuesta_webhook", default=None)


class TransporteSimulado:
    """No envía nada: el registro de mensajes (whatsapp.mensajes) hace de bandeja de salida del simulador."""

    def enviar(self, mensaje: MensajeSaliente) -> None:
        pass


_transporte: Transporte = TransporteSimulado()
_conversador: Conversador = ConversadorMenu()


def configurar(transporte: Transporte | None = None, conversador: Conversador | None = None) -> None:
    global _transporte, _conversador
    _transporte = transporte or _transporte
    _conversador = conversador or _conversador


def transporte() -> Transporte:
    return _transporte


def configurar_desde_entorno() -> None:
    """TRANSPORTE=twilio carga transporte_twilio.TransporteTwilio (Jorge); CONVERSADOR=llm carga
    conversador_llm.ConversadorLLM (Leonardo). Cada clase expone desde_entorno()."""
    if os.getenv("TRANSPORTE", "simulado") == "twilio":
        modulo = importlib.import_module("app.modulos.whatsapp.transporte_twilio")
        configurar(transporte=modulo.TransporteTwilio.desde_entorno())
    if os.getenv("CONVERSADOR", "menu") == "llm":
        modulo = importlib.import_module("app.modulos.whatsapp.conversador_llm")
        configurar(conversador=modulo.ConversadorLLM.desde_entorno())


def recibir(mensaje: MensajeEntrante, sid: str | None = None) -> list[str]:
    """Entrada de todo mensaje, del webhook real o del simulador. Las respuestas salen después del commit."""
    with transaccion() as c:
        c.execute(select(func.pg_advisory_xact_lock(func.hashtextextended(mensaje.telefono, 0))))
        if sid is not None and not _registrar_entrega(c, sid):
            return []
        textos, memoria = _responder(mensaje, _memoria(mensaje.telefono))
        _guardar_memoria(mensaje.telefono, memoria)
    for respuesta in textos:
        enviar(MensajeSaliente(telefono=mensaje.telefono, texto=respuesta))
    return textos


def recibir_para_twiml(mensaje: MensajeEntrante, sid: str) -> list[MensajeSaliente]:
    """Reúne las respuestas y los avisos que produce este turno para su remitente."""
    respuesta = _RespuestaWebhook(mensaje.telefono)
    token = _respuesta_webhook.set(respuesta)
    try:
        recibir(mensaje, sid)
    finally:
        _respuesta_webhook.reset(token)
    if respuesta.mensajes:
        with transaccion():
            for salida in respuesta.mensajes:
                _guardar_envio(salida, "emitido")
    return respuesta.mensajes


def enviar(mensaje: MensajeSaliente) -> None:
    """Entrega al transporte o añade el mensaje a la respuesta del webhook activo."""
    respuesta = _respuesta_webhook.get()
    if respuesta is not None and respuesta.telefono == mensaje.telefono:
        respuesta.mensajes.append(mensaje)
        return
    try:
        _transporte.enviar(mensaje)
        estado = "enviado"
    except Exception as error:
        log.warning("No se pudo enviar un mensaje de WhatsApp (%s)", type(error).__name__)
        estado = "fallido"
    _guardar_envio(mensaje, estado)


def _guardar_envio(mensaje: MensajeSaliente, estado: str) -> None:
    with transaccion() as c:
        c.execute(insert(t.mensajes).values(**mensaje.model_dump(), estado=estado,
                                            enviado_en=datetime.now(timezone.utc)))


def enviados(telefono: str | None = None) -> list[MensajeSaliente]:
    """Todo lo que salió por WhatsApp, en orden: respuestas y avisos."""
    consulta = select(t.mensajes).order_by(t.mensajes.c.id)
    if telefono is not None:
        consulta = consulta.where(t.mensajes.c.telefono == telefono)
    with transaccion() as c:
        return [MensajeSaliente.model_validate(dict(fila._mapping)) for fila in c.execute(consulta).all()]


def _responder(mensaje: MensajeEntrante, memoria: dict) -> tuple[list[str], dict]:
    solicitante = directorio.solicitante_por_telefono(mensaje.telefono)
    if solicitante is None:
        return registro.responder(mensaje.texto, mensaje.telefono, memoria), memoria
    if solicitante.estado != directorio.EstadoSolicitante.HABILITADO:
        return [texto("registro_en_revision")], memoria
    turno = Turno(nombre=solicitante.nombre, texto=mensaje.texto, media_url=mensaje.media_url)
    herramientas = Herramientas(solicitante.id)
    try:
        respuesta = _conversador.responder(turno, memoria, herramientas)
    except Exception:
        log.exception("El conversador falló; responde el menú")
        respuesta = ConversadorMenu().responder(turno, {}, herramientas)
    return respuesta.textos, respuesta.memoria


def _memoria(telefono: str) -> dict:
    with transaccion() as c:
        fila = c.execute(select(t.conversaciones.c.memoria).where(t.conversaciones.c.telefono == telefono)).first()
    return dict(fila.memoria) if fila else {}


def _registrar_entrega(conexion: Connection, sid: str) -> bool:
    consulta = insertar_o_actualizar(t.entregas).values(sid=sid).on_conflict_do_nothing()
    return conexion.execute(consulta.returning(t.entregas.c.sid)).scalar_one_or_none() is not None


def _guardar_memoria(telefono: str, memoria: dict) -> None:
    valores = {"telefono": telefono, "memoria": memoria, "actualizada": datetime.now(timezone.utc)}
    with transaccion() as c:
        c.execute(insertar_o_actualizar(t.conversaciones).values(valores)
                  .on_conflict_do_update(index_elements=[t.conversaciones.c.telefono], set_=valores))
