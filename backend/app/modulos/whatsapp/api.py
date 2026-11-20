"""API de whatsapp: webhook de Twilio, monitor con toma de control (ADR-0007) y simulador. Todo menos el webhook
pide sesión."""
from urllib.parse import parse_qsl

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from app.modulos.acceso import contrato as acceso
from app.modulos.whatsapp import bot, monitor
from app.modulos.whatsapp.contrato import MensajeEntrante, MensajeSaliente
from app.modulos.whatsapp.transporte_twilio import TransporteTwilio

router = APIRouter(prefix="/api/whatsapp", tags=["whatsapp"])
Sesion = Depends(acceso.usuario_actual)


class Texto(BaseModel):
    texto: str = Field(min_length=1, max_length=1000)


@router.post("/twilio", include_in_schema=False)
async def webhook_twilio(request: Request) -> Response:
    """Lo llama Twilio con cada mensaje que llega. Sin una firma válida responde 403."""
    parametros = dict(parse_qsl((await request.body()).decode()))
    transporte = bot.transporte()
    firma = request.headers.get("X-Twilio-Signature", "")
    if not isinstance(transporte, TransporteTwilio) or not transporte.firma_valida(str(request.url), parametros, firma):
        raise HTTPException(403, "Firma de Twilio inválida.")
    mensaje = MensajeEntrante(telefono=parametros.get("From", "").removeprefix("whatsapp:"),
                              texto=parametros.get("Body", ""), media_url=parametros.get("MediaUrl0"))
    await run_in_threadpool(bot.recibir, mensaje)
    return Response("<Response/>", media_type="application/xml")


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
