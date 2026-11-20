"""Entrada y salida de WhatsApp: todo queda registrado; cada mensaje va al registro, al conversador o a la coordinación.
La pieza de Jorge entra con TRANSPORTE=twilio y la de Leonardo con CONVERSADOR=llm (ADR-0003, ADR-0007)."""
import importlib
import logging
import os
from datetime import datetime, timezone

from sqlalchemy import insert, select
from sqlalchemy.dialects.postgresql import insert as insertar_o_actualizar

from app.compartido.bd import transaccion
from app.modulos.directorio import contrato as directorio
from app.modulos.whatsapp import registro
from app.modulos.whatsapp import tablas as t
from app.modulos.whatsapp.contrato import Conversador, Herramientas, MensajeEntrante, MensajeSaliente, Transporte, Turno
from app.modulos.whatsapp.menu import ConversadorMenu

log = logging.getLogger("whatsapp")
EN_REVISION = "Tu registro está en revisión. Te avisamos por aquí cuando quedes habilitado."


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


def recibir(mensaje: MensajeEntrante) -> list[str]:
    """Entrada de todo mensaje. Si la coordinación tomó el control, el bot calla.
    Las respuestas salen después del commit."""
    with transaccion():
        _registrar(mensaje, "entrante", "vecino")
        memoria, control = _conversacion(mensaje.telefono)
        textos, memoria = ([], memoria) if control else _responder(mensaje, memoria)
        _guardar_memoria(mensaje.telefono, memoria)
    for texto in textos:
        enviar(MensajeSaliente(telefono=mensaje.telefono, texto=texto), autor="bot")
    return textos


def enviar(mensaje: MensajeSaliente, autor: str = "aviso") -> None:
    """Envía por el transporte y deja constancia, enviado o fallido, para el monitor y para reintentar."""
    try:
        _transporte.enviar(mensaje)
        estado = "enviado"
    except Exception:
        log.exception("No se pudo enviar un mensaje de WhatsApp")
        estado = "fallido"
    _registrar(mensaje, "saliente", autor, estado)


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
        return [EN_REVISION], memoria
    turno = Turno(nombre=solicitante.nombre, texto=mensaje.texto, media_url=mensaje.media_url)
    herramientas = Herramientas(solicitante.id)
    try:
        respuesta = _conversador.responder(turno, memoria, herramientas)
    except Exception:
        log.exception("El conversador falló; responde el menú")
        respuesta = ConversadorMenu().responder(turno, {}, herramientas)
    return respuesta.textos, respuesta.memoria


def _registrar(mensaje: MensajeEntrante | MensajeSaliente, direccion: str, autor: str,
               estado: str | None = None) -> None:
    with transaccion() as c:
        c.execute(insert(t.mensajes).values(telefono=mensaje.telefono, texto=mensaje.texto, media_url=mensaje.media_url,
                                            direccion=direccion, autor=autor, estado=estado,
                                            enviado_en=datetime.now(timezone.utc)))


def _conversacion(telefono: str) -> tuple[dict, str | None]:
    """La memoria del bot y quién de la coordinación tiene el control (None: el bot)."""
    columnas = t.conversaciones.c
    consulta = select(columnas.memoria, columnas.control).where(columnas.telefono == telefono)
    with transaccion() as c:
        fila = c.execute(consulta).first()
    return (dict(fila.memoria), fila.control) if fila else ({}, None)


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
