"""API de whatsapp: el webhook de Twilio y el simulador, que requiere sesión."""
from urllib.parse import parse_qsl

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from starlette.concurrency import run_in_threadpool

from app.modulos.acceso import contrato as acceso
from app.modulos.whatsapp import bot
from app.modulos.whatsapp.contrato import MensajeEntrante, MensajeSaliente
from app.modulos.whatsapp.transporte_twilio import TransporteTwilio

router = APIRouter(prefix="/api/whatsapp", tags=["whatsapp"])
Sesion = Depends(acceso.usuario_actual)


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


@router.post("/simulador")
def simular(mensaje: MensajeEntrante, _: acceso.Usuario = Sesion) -> list[str]:
    """Finge ser WhatsApp: sigue el mismo camino que un mensaje real y devuelve lo que respondió el bot."""
    return bot.recibir(mensaje)


@router.get("/simulador/mensajes")
def enviados(telefono: str | None = None, _: acceso.Usuario = Sesion) -> list[MensajeSaliente]:
    """Todo lo que el sistema envió por WhatsApp: respuestas y avisos."""
    return bot.enviados(telefono)
