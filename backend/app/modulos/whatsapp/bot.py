"""Entrada y salida de WhatsApp: todo queda registrado; cada mensaje va al registro, al conversador o a la coordinación.
Twilio entra con TRANSPORTE=twilio y el agente con CONVERSADOR=llm (ADR-0003, ADR-0007, ADR-0016)."""
import importlib
import logging
import os
import time
from contextvars import ContextVar
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from sqlalchemy import Connection, delete, func, insert, or_, select
from sqlalchemy.dialects.postgresql import insert as insertar_o_actualizar

from app.compartido.bd import reservar_conexion, transaccion
from app.modulos.directorio import contrato as directorio
from app.modulos.whatsapp import adjuntos, contactos, registro
from app.modulos.whatsapp import tablas as t
from app.modulos.whatsapp.agente.memoria import vigente as memoria_vigente
from app.modulos.whatsapp.contrato import (Conversador, Herramientas, Linea, MensajeEntrante, MensajeSaliente,
                                           Respuesta, Transporte, Turno)
from app.modulos.whatsapp.eventos_monitor import notificar
from app.modulos.whatsapp.menu import ConversadorMenu
from app.modulos.whatsapp.respuestas import texto as plantilla
from app.modulos.whatsapp.transporte_twilio import ErrorEnvioTwilio

log = logging.getLogger("whatsapp")
PLAZO = 12.5  # segundos para responder: Twilio espera 15 el TwiML del webhook
HISTORIAL = 14  # mensajes recientes que el agente lee para seguir la conversación
TURNOS_DEL_AGENTE = 20  # por número cada 10 minutos; pasado el tope responde el diálogo local, sin costo de Azure


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

    def admite(self, telefono: str) -> bool:
        return True


_transporte: Transporte = TransporteSimulado()
_conversador: Conversador = ConversadorMenu()


def configurar(transporte: Transporte | None = None, conversador: Conversador | None = None) -> None:
    global _transporte, _conversador
    _transporte = transporte or _transporte
    _conversador = conversador or _conversador


def transporte() -> Transporte:
    return _transporte


def configurar_desde_entorno() -> None:
    """TRANSPORTE=twilio carga transporte_twilio.TransporteTwilio; CONVERSADOR=llm carga el agente
    (agente/conversador.py, ADR-0016). Cada clase expone desde_entorno()."""
    if os.getenv("TRANSPORTE", "simulado") == "twilio":
        modulo = importlib.import_module("app.modulos.whatsapp.transporte_twilio")
        configurar(transporte=modulo.TransporteTwilio.desde_entorno())
    if con_agente():
        modulo = importlib.import_module("app.modulos.whatsapp.agente.conversador")
        configurar(conversador=modulo.ConversadorAgente.desde_entorno())


def con_agente() -> bool:
    return os.getenv("CONVERSADOR", "menu") == "llm"


def recibir(mensaje: MensajeEntrante, sid: str | None = None) -> list[str]:
    """Entrada de todo mensaje. Un mensaje repetido de Twilio (mismo SID) no se procesa dos veces.
    El monitor ve el entrante desde su commit, mientras el bot prepara la respuesta."""
    respuesta = _procesar_turno(mensaje, sid)
    if respuesta is None:
        return []
    for salida in _salidas(mensaje.telefono, respuesta):
        enviar(salida, autor="bot")
    return respuesta.textos


def _procesar_turno(mensaje: MensajeEntrante, sid: str | None) -> Respuesta | None:
    """Serializa los turnos del mismo número a través de los dos commits."""
    clave = func.hashtextextended(mensaje.telefono, 0)
    with reservar_conexion() as conexion:
        try:
            with transaccion() as c:
                c.execute(select(func.pg_advisory_lock(clave)))
                mensaje_id = _registrar_entrada(c, mensaje, sid)
            if mensaje_id is None:
                return None
            return _responder_entrada(mensaje, mensaje_id, sid)
        finally:
            if not conexion.invalidated:
                try:
                    with conexion.begin():
                        conexion.execute(select(func.pg_advisory_unlock(clave)))
                except BaseException:
                    conexion.invalidate()  # No devolver al pool una sesión que puede seguir bloqueada.
                    raise


def _registrar_entrada(c: Connection, mensaje: MensajeEntrante, sid: str | None) -> int | None:
    pendientes = t.entregas_pendientes.c
    if sid is not None and not _registrar_entrega(c, sid):
        consulta = (select(pendientes.mensaje_id).join(t.mensajes, t.mensajes.c.id == pendientes.mensaje_id)
                    .where(pendientes.sid == sid, t.mensajes.c.telefono == mensaje.telefono))
        return c.execute(consulta).scalar_one_or_none()
    if mensaje.perfil:
        contactos.recordar(mensaje.telefono, mensaje.perfil)
    mensaje_id = _registrar(mensaje, "entrante", "vecino")
    if sid is not None:
        c.execute(insert(t.entregas_pendientes).values(sid=sid, mensaje_id=mensaje_id))
    return mensaje_id


def _responder_entrada(mensaje: MensajeEntrante, mensaje_id: int, sid: str | None) -> Respuesta:
    with transaccion() as c:
        memoria, control = _conversacion(mensaje.telefono)
        respuesta = Respuesta(textos=[], memoria=memoria)
        if not control:
            respuesta = _responder(mensaje, memoria, _historial(mensaje.telefono, antes_de=mensaje_id))
        _guardar_memoria(mensaje.telefono, respuesta.memoria)
        if sid is not None:
            c.execute(delete(t.entregas_pendientes).where(t.entregas_pendientes.c.sid == sid))
    return respuesta


def _salidas(telefono: str, respuesta: Respuesta) -> list[MensajeSaliente]:
    """Un mensaje por texto; el cartel va con el último para no gastar otro mensaje del cupo de Twilio."""
    salidas = [MensajeSaliente(telefono=telefono, texto=texto) for texto in respuesta.textos]
    if respuesta.media_url and salidas:
        salidas[-1].media_url = respuesta.media_url
    elif respuesta.media_url:
        salidas.append(MensajeSaliente(telefono=telefono, texto="", media_url=respuesta.media_url))
    return salidas


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
    if not _transporte.admite(mensaje.telefono):
        return "omitido"  # fuera del piloto: sin envío ni rastro en el monitor (los ficticios de la demo)
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


def _responder(mensaje: MensajeEntrante, memoria: dict, historial: list[Linea]) -> Respuesta:
    limite = time.monotonic() + PLAZO
    solicitante = directorio.solicitante_por_telefono(mensaje.telefono)
    if solicitante is None:
        return Respuesta(textos=registro.responder(mensaje.texto, mensaje.telefono, memoria), memoria=memoria)
    if solicitante.estado != directorio.EstadoSolicitante.HABILITADO:
        return Respuesta(textos=[plantilla("registro_en_revision")], memoria=memoria)
    if mensaje.media_url and con_agente():
        memoria = memoria_vigente(memoria)
    atencion = adjuntos.atender(mensaje, memoria, para_el_agente=con_agente())
    if atencion.mensaje is None:
        return Respuesta(textos=atencion.textos, memoria=memoria)
    agotado = con_agente() and adjuntos.excede_el_limite(f"agente:{mensaje.telefono}", TURNOS_DEL_AGENTE)
    turno = Turno(nombre=solicitante.nombre, texto=atencion.mensaje.texto, media_url=atencion.mensaje.media_url,
                  historial=historial, revision=atencion.revision, segundos=0 if agotado else limite - time.monotonic())
    respuesta = _conversar(turno, memoria, Herramientas(solicitante.id))
    return respuesta.model_copy(update={"textos": atencion.textos + respuesta.textos})


def _conversar(turno: Turno, memoria: dict, herramientas: Herramientas) -> Respuesta:
    try:
        return _conversador.responder(turno, memoria, herramientas)
    except Exception:
        log.exception("El conversador falló; responde el menú")
        return ConversadorMenu().responder(turno, {}, herramientas)


def _historial(telefono: str, antes_de: int) -> list[Linea]:
    """Lo que se habló en las últimas 24 horas, sin los envíos fallidos ni el registro: la dirección que escribió
    al registrarse no viaja al modelo (ADR-0016)."""
    m, solicitante = t.mensajes.c, directorio.solicitante_por_telefono(telefono)
    desde = datetime.now(timezone.utc) - timedelta(hours=24)
    desde = max(desde, solicitante.autorizo_en) if solicitante else desde
    consulta = (select(m.autor, m.texto, m.media_url)
                .where(m.telefono == telefono, m.id < antes_de, m.enviado_en >= desde,
                       or_(m.estado.is_(None), m.estado != "fallido"))
                .order_by(m.id.desc()).limit(HISTORIAL))
    with transaccion() as c:
        filas = c.execute(consulta).all()
    return [Linea(autor=f.autor, texto=" ".join(filter(None, (f.texto, "[adjunto]" if f.media_url else None))))
            for f in reversed(filas)]


def _registrar(mensaje: MensajeEntrante | MensajeSaliente, direccion: str, autor: str,
               estado: str | None = None) -> int:
    consulta = insert(t.mensajes).values(telefono=mensaje.telefono, texto=mensaje.texto, media_url=mensaje.media_url,
                                         direccion=direccion, autor=autor, estado=estado,
                                         enviado_en=datetime.now(timezone.utc))
    with transaccion() as c:
        mensaje_id = c.execute(consulta.returning(t.mensajes.c.id)).scalar_one()
        notificar(c)
    return mensaje_id


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
