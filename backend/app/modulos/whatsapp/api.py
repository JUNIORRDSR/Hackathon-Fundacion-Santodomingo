"""API de whatsapp: webhook de Twilio, monitor con toma de control (ADR-0007) y simulador. Todo menos el webhook
pide sesión."""
from urllib.parse import parse_qsl

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import FormData

from app.modulos.acceso import contrato as acceso
from app.modulos.whatsapp import bot, monitor
from app.modulos.whatsapp.contrato import MensajeEntrante, MensajeSaliente
from app.modulos.whatsapp.transporte_twilio import TransporteTwilio

router = APIRouter(prefix="/api/whatsapp", tags=["whatsapp"])
Sesion = Depends(acceso.usuario_actual)
FORMULARIO_MAXIMO = 32 * 1024


class Texto(BaseModel):
    texto: str = Field(min_length=1, max_length=1000)


@router.post("/twilio", include_in_schema=False)
async def webhook_twilio(request: Request) -> Response:
    """Lo llama Twilio con cada mensaje que llega. Sin una firma válida responde 403."""
    transporte = bot.transporte()
    firma = request.headers.get("X-Twilio-Signature", "")
    if not isinstance(transporte, TransporteTwilio) or not firma:
        raise HTTPException(403, "Firma de Twilio inválida.")
    parametros = await _formulario_twilio(request)
    if not transporte.firma_valida(parametros, firma):
        raise HTTPException(403, "Firma de Twilio inválida.")
    try:
        mensaje, sid = transporte.entrada(parametros)
    except PermissionError:
        raise HTTPException(403, "El remitente no está habilitado para esta prueba.") from None
    except ValueError:
        raise HTTPException(400, "Mensaje de WhatsApp inválido o remitente sin teléfono asociado.") from None
    return await run_in_threadpool(_respuesta_twilio, transporte, mensaje, sid)


def _respuesta_twilio(transporte: TransporteTwilio, mensaje: MensajeEntrante, sid: str) -> Response:
    if transporte.respuesta_twiml:
        cuerpo = transporte.serializar_twiml(bot.recibir_para_twiml(mensaje, sid))
    else:
        bot.recibir(mensaje, sid)
        cuerpo = "<Response/>"
    return Response(cuerpo, media_type="application/xml")


async def _formulario_twilio(request: Request) -> FormData:
    tipo = request.headers.get("Content-Type", "").partition(";")[0].strip().lower()
    if tipo != "application/x-www-form-urlencoded":
        raise HTTPException(415, "Se esperaba un formulario.")
    cuerpo = bytearray()
    async for bloque in request.stream():
        if len(cuerpo) + len(bloque) > FORMULARIO_MAXIMO:
            raise HTTPException(413, "El formulario es demasiado grande.")
        cuerpo.extend(bloque)
    try:
        return FormData(parse_qsl(cuerpo.decode(), keep_blank_values=True, errors="strict"))
    except UnicodeError:
        raise HTTPException(400, "Formulario inválido.") from None


@router.get("/pedidos-en-espera")
def pedidos_en_espera(_: acceso.Usuario = Depends(acceso.usuario_actual)) -> dict[str, dict]:
    return monitor.pedidos_en_espera()


@router.get("/conversaciones")
def conversaciones(_: acceso.Usuario = Sesion) -> list[monitor.ConversacionVista]:
    return monitor.conversaciones()


@router.get("/conversaciones/{telefono}/mensajes")
def mensajes(telefono: str, _: acceso.Usuario = Sesion) -> list[monitor.MensajeVista]:
    return monitor.mensajes_de(telefono)


@router.post("/conversaciones/{telefono}/control", status_code=204)
def tomar_control(telefono: str, u: acceso.Usuario = Sesion) -> None:
    """El bot deja de responder a este número hasta que se lo devuelvan."""
    monitor.tomar_control(telefono, u.nombre)


@router.delete("/conversaciones/{telefono}/control", status_code=204)
def devolver_al_bot(telefono: str, _: acceso.Usuario = Sesion) -> None:
    monitor.devolver_al_bot(telefono)


@router.post("/conversaciones/{telefono}/mensajes", status_code=204)
def responder(telefono: str, datos: Texto, _: acceso.Usuario = Sesion) -> None:
    monitor.responder(telefono, datos.texto)


@router.post("/simulador")
def simular(mensaje: MensajeEntrante, _: acceso.Usuario = Sesion) -> list[str]:
    """Finge ser WhatsApp: sigue el mismo camino que un mensaje real y devuelve lo que respondió el bot."""
    return bot.recibir(mensaje)


@router.get("/simulador/mensajes")
def enviados(telefono: str | None = None, _: acceso.Usuario = Sesion) -> list[MensajeSaliente]:
    """Lo que el sistema envió por WhatsApp: respuestas, avisos y mensajes de la coordinación."""
    return bot.enviados(telefono)
