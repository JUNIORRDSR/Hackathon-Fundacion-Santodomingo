"""API de whatsapp: el webhook de Twilio y el simulador, que requiere sesión."""
from urllib.parse import parse_qsl

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import FormData

from app.modulos.acceso import contrato as acceso
from app.modulos.whatsapp import bot
from app.modulos.whatsapp.contrato import MensajeEntrante, MensajeSaliente
from app.modulos.whatsapp.transporte_twilio import TransporteTwilio

router = APIRouter(prefix="/api/whatsapp", tags=["whatsapp"])
Sesion = Depends(acceso.usuario_actual)
FORMULARIO_MAXIMO = 32 * 1024


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
    await run_in_threadpool(bot.recibir, mensaje, sid)
    return Response("<Response/>", media_type="application/xml")


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


@router.post("/simulador")
def simular(mensaje: MensajeEntrante, _: acceso.Usuario = Sesion) -> list[str]:
    """Finge ser WhatsApp: sigue el mismo camino que un mensaje real y devuelve lo que respondió el bot."""
    return bot.recibir(mensaje)


@router.get("/simulador/mensajes")
def enviados(telefono: str | None = None, _: acceso.Usuario = Sesion) -> list[MensajeSaliente]:
    """Todo lo que el sistema envió por WhatsApp: respuestas y avisos."""
    return bot.enviados(telefono)
