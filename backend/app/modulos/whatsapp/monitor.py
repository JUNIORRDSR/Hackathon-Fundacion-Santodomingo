"""Monitor de WhatsApp (ADR-0007): la coordinación ve cada conversación y puede tomar el control del bot."""
from datetime import datetime, timezone
from uuid import UUID

from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert as insertar_o_actualizar

from app.compartido.bd import transaccion
from app.compartido.tipos import ErrorDeNegocio, NoEncontrado
from app.modulos.clasificacion import contrato as clasificacion
from app.modulos.directorio import contrato as directorio
from app.modulos.whatsapp import adjuntos, contactos, fotos
from app.modulos.whatsapp import tablas as t
from app.modulos.whatsapp.bot import enviar
from app.modulos.whatsapp.contrato import MensajeSaliente, Perfil
from app.modulos.whatsapp.eventos_monitor import notificar


class MensajeVista(BaseModel):
    id: int
    direccion: str  # entrante | saliente
    autor: str  # vecino | bot | aviso | coordinacion
    texto: str
    media_url: str | None
    estado: str | None
    fecha: datetime


class ConversacionVista(BaseModel):
    telefono: str
    nombre: str | None  # None: todavía no se registró
    perfil: str | None = None  # el nombre que puso en WhatsApp, según Twilio (ADR-0016)
    usuario: str | None = None  # su usuario de WhatsApp, si lo tiene
    control: str | None  # quién de la coordinación la atiende; None: el bot
    ultimo: str
    fecha: datetime
    sin_leer: int


def conversaciones(usuario_id: UUID) -> list[ConversacionVista]:
    """Una fila por número, la de actividad más reciente primero."""
    mensajes = t.mensajes.c
    ultimos = select(t.mensajes).distinct(mensajes.telefono).order_by(mensajes.telefono, mensajes.id.desc())
    with transaccion() as c:
        filas = c.execute(ultimos).all()
        controles = dict(c.execute(select(t.conversaciones.c.telefono, t.conversaciones.c.control)).all())
        sin_leer = dict(c.execute(_consulta_sin_leer(usuario_id)).all())
    vistas = [_resumen(fila, controles.get(fila.telefono), sin_leer.get(fila.telefono, 0)) for fila in filas]
    return sorted(vistas, key=lambda vista: vista.fecha, reverse=True)


def _consulta_sin_leer(usuario_id: UUID):
    mensajes, lecturas = t.mensajes.c, t.lecturas.c
    por_usuario = (lecturas.usuario_id == usuario_id) & (lecturas.telefono == mensajes.telefono)
    return (select(mensajes.telefono, func.count()).select_from(t.mensajes.outerjoin(t.lecturas, por_usuario))
            .where(mensajes.direccion == "entrante", mensajes.id > func.coalesce(lecturas.hasta_id, 0))
            .group_by(mensajes.telefono))


def mensajes_de(telefono: str) -> list[MensajeVista]:
    consulta = select(t.mensajes).where(t.mensajes.c.telefono == telefono).order_by(t.mensajes.c.id)
    with transaccion() as c:
        filas = c.execute(consulta).all()
    return [MensajeVista.model_validate({**fila._mapping, "fecha": fila.enviado_en,
                                       "estado": "fallido" if fila.estado == "en_cola" else fila.estado})
            for fila in filas]


def marcar_leido(telefono: str, usuario_id: UUID, hasta_id: int) -> None:
    mensajes, lecturas = t.mensajes.c, t.lecturas.c
    mensaje = select(mensajes.id).where(mensajes.id == hasta_id, mensajes.telefono == telefono,
                                        mensajes.direccion == "entrante")
    guardar = insertar_o_actualizar(t.lecturas).values(usuario_id=usuario_id, telefono=telefono, hasta_id=hasta_id)
    with transaccion() as c:
        if c.execute(mensaje).scalar_one_or_none() is None:
            raise NoEncontrado("El mensaje entrante no pertenece a esta conversación.")
        cambio = guardar.on_conflict_do_update(index_elements=[lecturas.usuario_id, lecturas.telefono],
                                               set_={"hasta_id": hasta_id}, where=lecturas.hasta_id < hasta_id)
        if c.execute(cambio).rowcount:
            notificar(c, usuario_id)


def tomar_control(telefono: str, quien: str) -> None:
    _cambiar_control(telefono, quien)


def devolver_al_bot(telefono: str) -> None:
    _cambiar_control(telefono, None)


def responder(telefono: str, texto: str) -> bool:
    """Solo con el control tomado: el vecino nunca recibe a la vez al bot y a la coordinación."""
    with transaccion() as c:
        control = c.execute(select(t.conversaciones.c.control).where(t.conversaciones.c.telefono == telefono)).scalar()
    if not control:
        raise ErrorDeNegocio("Toma el control de la conversación antes de escribir.")
    return enviar(MensajeSaliente(telefono=telefono, texto=texto), autor="coordinacion") != "fallido"


def clasificar(mensaje_id: int) -> list[str]:
    """La revisión de la IA que pide la coordinación para una foto: el vecino la recibe como respuesta del bot."""
    consulta = select(t.mensajes.c.telefono, t.mensajes.c.media_url).where(t.mensajes.c.id == mensaje_id)
    with transaccion() as c:
        fila = c.execute(consulta).first()
    if fila is None or not fila.media_url:
        raise NoEncontrado("Ese mensaje no tiene foto.")
    try:
        archivo = adjuntos.descargar(fila.media_url)
    except Exception as error:
        raise ErrorDeNegocio("No se pudo traer la foto de Twilio.") from error
    textos = fotos.responder(clasificacion.Foto(contenido=archivo.contenido, tipo=archivo.tipo), {})
    for texto in textos:
        enviar(MensajeSaliente(telefono=fila.telefono, texto=texto), autor="bot")
    return textos


def _resumen(fila, control: str | None, sin_leer: int) -> ConversacionVista:
    solicitante = directorio.solicitante_por_telefono(fila.telefono)
    perfil = contactos.perfil_de(fila.telefono) or Perfil()
    return ConversacionVista(telefono=fila.telefono, nombre=solicitante.nombre if solicitante else None,
                             perfil=perfil.nombre, usuario=perfil.usuario, control=control, ultimo=fila.texto,
                             fecha=fila.enviado_en, sin_leer=sin_leer)


def _cambiar_control(telefono: str, control: str | None) -> None:
    ahora = datetime.now(timezone.utc)
    nueva = {"telefono": telefono, "memoria": {}, "control": control, "actualizada": ahora}
    with transaccion() as c:
        c.execute(insertar_o_actualizar(t.conversaciones).values(nueva).on_conflict_do_update(
            index_elements=[t.conversaciones.c.telefono], set_={"control": control, "actualizada": ahora}))
        notificar(c)


def pedidos_en_espera() -> dict[str, dict]:
    """El primer pedido que dejó cada vecino al registrarse, por teléfono, mientras espera que lo acepten (ADR-0010)."""
    columnas = t.conversaciones.c
    with transaccion() as c:
        consulta = select(columnas.telefono, columnas.memoria).where(columnas.memoria.has_key("pedido_en_espera"))
        filas = c.execute(consulta)
        return {fila.telefono: fila.memoria["pedido_en_espera"] for fila in filas}
