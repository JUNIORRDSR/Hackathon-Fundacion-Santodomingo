"""Monitor de WhatsApp (ADR-0007): la coordinación ve cada conversación y puede tomar el control del bot."""
from datetime import datetime, timezone

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as insertar_o_actualizar

from app.compartido.bd import transaccion
from app.compartido.tipos import ErrorDeNegocio
from app.modulos.directorio import contrato as directorio
from app.modulos.whatsapp import tablas as t
from app.modulos.whatsapp.bot import enviar
from app.modulos.whatsapp.contrato import MensajeSaliente


class MensajeVista(BaseModel):
    direccion: str  # entrante | saliente
    autor: str  # vecino | bot | aviso | coordinacion
    texto: str
    media_url: str | None
    estado: str | None
    fecha: datetime


class ConversacionVista(BaseModel):
    telefono: str
    nombre: str | None  # None: todavía no se registró
    control: str | None  # quién de la coordinación la atiende; None: el bot
    ultimo: str
    fecha: datetime


def conversaciones() -> list[ConversacionVista]:
    """Una fila por número, la de actividad más reciente primero."""
    mensajes = t.mensajes.c
    ultimos = select(t.mensajes).distinct(mensajes.telefono).order_by(mensajes.telefono, mensajes.id.desc())
    with transaccion() as c:
        filas = c.execute(ultimos).all()
        controles = dict(c.execute(select(t.conversaciones.c.telefono, t.conversaciones.c.control)).all())
    vistas = [_resumen(fila, controles.get(fila.telefono)) for fila in filas]
    return sorted(vistas, key=lambda vista: vista.fecha, reverse=True)


def mensajes_de(telefono: str) -> list[MensajeVista]:
    consulta = select(t.mensajes).where(t.mensajes.c.telefono == telefono).order_by(t.mensajes.c.id)
    with transaccion() as c:
        filas = c.execute(consulta).all()
    return [MensajeVista.model_validate({**fila._mapping, "fecha": fila.enviado_en}) for fila in filas]


def tomar_control(telefono: str, quien: str) -> None:
    _cambiar_control(telefono, quien)


def devolver_al_bot(telefono: str) -> None:
    _cambiar_control(telefono, None)


def responder(telefono: str, texto: str) -> None:
    """Solo con el control tomado: el vecino nunca recibe a la vez al bot y a la coordinación."""
    with transaccion() as c:
        control = c.execute(select(t.conversaciones.c.control).where(t.conversaciones.c.telefono == telefono)).scalar()
    if not control:
        raise ErrorDeNegocio("Toma el control de la conversación antes de escribir.")
    enviar(MensajeSaliente(telefono=telefono, texto=texto), autor="coordinacion")


def _resumen(fila, control: str | None) -> ConversacionVista:
    solicitante = directorio.solicitante_por_telefono(fila.telefono)
    return ConversacionVista(telefono=fila.telefono, nombre=solicitante.nombre if solicitante else None,
                             control=control, ultimo=fila.texto, fecha=fila.enviado_en)


def _cambiar_control(telefono: str, control: str | None) -> None:
    ahora = datetime.now(timezone.utc)
    nueva = {"telefono": telefono, "memoria": {}, "control": control, "actualizada": ahora}
    with transaccion() as c:
        c.execute(insertar_o_actualizar(t.conversaciones).values(nueva).on_conflict_do_update(
            index_elements=[t.conversaciones.c.telefono], set_={"control": control, "actualizada": ahora}))
