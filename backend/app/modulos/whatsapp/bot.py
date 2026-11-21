"""Entrada y salida de WhatsApp: todo queda registrado; cada mensaje va al registro, al conversador o a la coordinación.
La pieza de Jorge entra con TRANSPORTE=twilio y la de Leonardo con CONVERSADOR=llm (ADR-0003, ADR-0007)."""
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
from app.modulos.whatsapp import adjuntos, registro
from app.modulos.whatsapp import tablas as t
from app.modulos.whatsapp.contrato import Conversador, Herramientas, MensajeEntrante, MensajeSaliente, Transporte, Turno
from app.modulos.whatsapp.eventos_monitor import notificar
from app.modulos.whatsapp.menu import ConversadorMenu
from app.modulos.whatsapp.respuestas import texto as plantilla
from app.modulos.whatsapp.transporte_twilio import ErrorEnvioTwilio

log = logging.getLogger("whatsapp")


@dataclass
class _RespuestaWebhook:
    """Con Twilio en el sandbox las respuestas viajan en el TwiML del mismo webhook (Jorge)."""
    telefono: str
    mensajes: list[tuple[MensajeSaliente, str]] = field(default_factory=list)


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
    """Entrada de todo mensaje. Un mensaje repetido de Twilio (mismo SID) no se procesa dos veces.
    Si la coordinación tomó el control, el bot calla. Las respuestas salen después del commit."""
    with transaccion() as c:
        c.execute(select(func.pg_advisory_xact_lock(func.hashtextextended(mensaje.telefono, 0))))
        if sid is not None and not _registrar_entrega(c, sid):
            return []
        _registrar(mensaje, "entrante", "vecino")
        memoria, control = _conversacion(mensaje.telefono)
        textos, memoria = ([], memoria) if control else _responder(mensaje, memoria)
        _guardar_memoria(mensaje.telefono, memoria)
    for texto in textos:
        enviar(MensajeSaliente(telefono=mensaje.telefono, texto=texto), autor="bot")
    return textos


def recibir_para_twiml(mensaje: MensajeEntrante, sid: str) -> list[MensajeSaliente]:
    """Reúne las respuestas y los avisos de este turno para devolverlos en el TwiML del webhook."""
    respuesta = _RespuestaWebhook(mensaje.telefono)
    token = _respuesta_webhook.set(respuesta)
    try:
        recibir(mensaje, sid)
    finally:
        _respuesta_webhook.reset(token)
    for salida, autor in respuesta.mensajes:
        _registrar(salida, "saliente", autor, "emitido")
    return [salida for salida, _ in respuesta.mensajes]


def enviar(mensaje: MensajeSaliente, autor: str = "aviso") -> str:
    """Envía por el transporte, o lo suma al TwiML del webhook activo, y deja constancia para el monitor."""
    respuesta = _respuesta_webhook.get()
    if respuesta is not None and respuesta.telefono == mensaje.telefono:
        respuesta.mensajes.append((mensaje, autor))
        return "emitido"
    estado = "fallido"
    try:
        _transporte.enviar(mensaje)
        estado = "enviado"
    except ErrorEnvioTwilio as error:
        log.warning("Twilio rechazó un mensaje de WhatsApp (HTTP %s, código %s)", error.http, error.codigo)
    except Exception as error:
        log.warning("No se pudo enviar un mensaje de WhatsApp (%s)", type(error).__name__)
    _registrar(mensaje, "saliente", autor, estado)
    return estado


def enviados(telefono: str | None = None) -> list[MensajeSaliente]:
    """Lo que salió por WhatsApp, en orden: respuestas, avisos y mensajes de la coordinación."""
    consulta = select(t.mensajes).where(t.mensajes.c.direccion == "saliente").order_by(t.mensajes.c.id)
    if telefono is not None:
        consulta = consulta.where(t.mensajes.c.telefono == telefono)
    with transaccion() as c:
        return [MensajeSaliente.model_validate(dict(fila._mapping)) for fila in c.execute(consulta).all()]


def _responder(mensaje: MensajeEntrante, memoria: dict) -> tuple[list[str], dict]:
    solicitante = directorio.solicitante_por_telefono(mensaje.telefono)
    if solicitante is None:
        return registro.responder(mensaje.texto, mensaje.telefono, memoria), memoria
    if solicitante.estado != directorio.EstadoSolicitante.HABILITADO:
        return [plantilla("registro_en_revision")], memoria
    textos, mensaje = adjuntos.atender(mensaje, memoria)
    if mensaje is None:
        return textos, memoria
    turno = Turno(nombre=solicitante.nombre, texto=mensaje.texto, media_url=mensaje.media_url)
    herramientas = Herramientas(solicitante.id)
    try:
        respuesta = _conversador.responder(turno, memoria, herramientas)
    except Exception:
        log.exception("El conversador falló; responde el menú")
        respuesta = ConversadorMenu().responder(turno, {}, herramientas)
    return textos + respuesta.textos, respuesta.memoria


def _registrar(mensaje: MensajeEntrante | MensajeSaliente, direccion: str, autor: str,
               estado: str | None = None) -> None:
    with transaccion() as c:
        c.execute(insert(t.mensajes).values(telefono=mensaje.telefono, texto=mensaje.texto, media_url=mensaje.media_url,
                                            direccion=direccion, autor=autor, estado=estado,
                                            enviado_en=datetime.now(timezone.utc)))
        notificar(c)


def _conversacion(telefono: str) -> tuple[dict, str | None]:
    """La memoria del bot y quién de la coordinación tiene el control (None: el bot)."""
    columnas = t.conversaciones.c
    consulta = select(columnas.memoria, columnas.control).where(columnas.telefono == telefono)
    with transaccion() as c:
        fila = c.execute(consulta).first()
    return (dict(fila.memoria), fila.control) if fila else ({}, None)


def _registrar_entrega(conexion: Connection, sid: str) -> bool:
    consulta = insertar_o_actualizar(t.entregas).values(sid=sid).on_conflict_do_nothing()
    return conexion.execute(consulta.returning(t.entregas.c.sid)).scalar_one_or_none() is not None


def tomar_pedido_en_espera(telefono: str) -> dict | None:
    """El primer pedido que dejó el vecino al registrarse; se saca de la memoria para que entre una sola vez."""
    memoria, _ = _conversacion(telefono)
    pedido = memoria.pop("pedido_en_espera", None)
    if pedido is not None:
        _guardar_memoria(telefono, memoria)
    return pedido


def _guardar_memoria(telefono: str, memoria: dict) -> None:
    valores = {"telefono": telefono, "memoria": memoria, "actualizada": datetime.now(timezone.utc)}
    with transaccion() as c:
        c.execute(insertar_o_actualizar(t.conversaciones).values(valores)
                  .on_conflict_do_update(index_elements=[t.conversaciones.c.telefono], set_=valores))
