"""API de whatsapp: webhook de Twilio, monitor con toma de control (ADR-0007) y simulador. Todo menos el webhook
pide sesión."""
import logging
from urllib.parse import parse_qsl

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import FormData

from app.modulos.acceso import contrato as acceso
from app.modulos.whatsapp import adjuntos, bot, carteles, monitor
from app.modulos.whatsapp.contrato import MensajeEntrante, MensajeSaliente
from app.modulos.whatsapp.transporte_twilio import TransporteTwilio

router = APIRouter(prefix="/api/whatsapp", tags=["whatsapp"])
log = logging.getLogger("whatsapp.webhook")
Sesion = Depends(acceso.usuario_actual)
FORMULARIO_MAXIMO = 32 * 1024


class Texto(BaseModel):
    texto: str = Field(min_length=1, max_length=1000)


class Lectura(BaseModel):
    hasta_id: int = Field(strict=True, gt=0, le=2_147_483_647)


@router.post("/twilio", include_in_schema=False)
async def webhook_twilio(request: Request) -> Response:
    """Lo llama Twilio con cada mensaje que llega. Sin una firma válida responde 403."""
    transporte = bot.transporte()
    firma = request.headers.get("X-Twilio-Signature", "")
    if not isinstance(transporte, TransporteTwilio) or not firma:
        log.info("Solicitud de WhatsApp rechazada: %s", "transporte inactivo" if firma else "sin firma")
        raise HTTPException(403, "Firma de Twilio inválida.")
    parametros = await _formulario_twilio(request)
    if not transporte.firma_valida(parametros, firma):
        log.warning("Solicitud de WhatsApp rechazada: la firma no coincide con la URL o el token configurado")
        raise HTTPException(403, "Firma de Twilio inválida.")
    try:
        mensaje, sid = transporte.entrada(parametros)
    except PermissionError:
        log.warning("Solicitud firmada de WhatsApp rechazada: remitente fuera del piloto")
        raise HTTPException(403, "El remitente no está habilitado para esta prueba.") from None
    except ValueError:
        log.info("Solicitud firmada de WhatsApp rechazada: formulario, cuenta, destinatario o alias inválido")
        raise HTTPException(400, "Mensaje de WhatsApp inválido o remitente sin teléfono asociado.") from None
    return await run_in_threadpool(_respuesta_twilio, transporte, mensaje, sid)


def _respuesta_twilio(transporte: TransporteTwilio, mensaje: MensajeEntrante, sid: str) -> Response:
    if transporte.respuesta_twiml:
        respuestas = bot.recibir_para_twiml(mensaje, sid)
        cuerpo = transporte.serializar_twiml(respuestas)
        log.info("Webhook de WhatsApp procesado (SID …%s, respuestas TwiML: %s)", sid[-8:], len(respuestas))
    else:
        bot.recibir(mensaje, sid)
        cuerpo = "<Response/>"
        log.info("Webhook de WhatsApp procesado (SID …%s, modo REST)", sid[-8:])
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


@router.get("/carteles/{nombre}", include_in_schema=False)
def cartel(nombre: str) -> FileResponse:
    """Público: Twilio descarga el cartel para mandarlo por WhatsApp. Solo sirve los del catálogo (ADR-0016)."""
    ruta = carteles.archivo(nombre)
    if ruta is None:
        raise HTTPException(404, "No existe ese cartel.")
    return FileResponse(ruta, media_type="image/jpeg", headers={"Cache-Control": "public, max-age=86400"})


@router.get("/pedidos-en-espera")
def pedidos_en_espera(_: acceso.Usuario = Depends(acceso.usuario_actual)) -> dict[str, dict]:
    return monitor.pedidos_en_espera()


@router.get("/conversaciones")
def conversaciones(u: acceso.Usuario = Sesion) -> list[monitor.ConversacionVista]:
    return monitor.conversaciones(u.id)


@router.get("/eventos")
async def eventos(request: Request, u: acceso.Usuario = Sesion) -> StreamingResponse:
    flujo = request.app.state.eventos_whatsapp.flujo(u.id)
    return StreamingResponse(flujo, media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no"})


@router.get("/conversaciones/{telefono}/mensajes")
def mensajes(telefono: str, _: acceso.Usuario = Sesion) -> list[monitor.MensajeVista]:
    return monitor.mensajes_de(telefono)


@router.post("/conversaciones/{telefono}/lectura", status_code=204)
def marcar_leido(telefono: str, datos: Lectura, u: acceso.Usuario = Sesion) -> None:
    monitor.marcar_leido(telefono, u.id, datos.hasta_id)


@router.post("/conversaciones/{telefono}/control", status_code=204)
def tomar_control(telefono: str, u: acceso.Usuario = Sesion) -> None:
    """El bot deja de responder a este número hasta que se lo devuelvan."""
    monitor.tomar_control(telefono, u.nombre)


@router.delete("/conversaciones/{telefono}/control", status_code=204)
def devolver_al_bot(telefono: str, _: acceso.Usuario = Sesion) -> None:
    monitor.devolver_al_bot(telefono)


@router.post("/conversaciones/{telefono}/mensajes", status_code=204)
def responder(telefono: str, datos: Texto, _: acceso.Usuario = Sesion) -> None:
    if not monitor.responder(telefono, datos.texto):
        raise HTTPException(502, "No se pudo confirmar el envío por WhatsApp. Revisa el estado en la conversación.")


@router.get("/adjunto")
def adjunto(url: str, _: acceso.Usuario = Sesion) -> Response:
    """La foto o el audio de un vecino para la tablet: se trae de Twilio con la credencial, que no sale del servidor."""
    try:
        archivo = adjuntos.descargar(url)
    except ValueError as error:
        raise HTTPException(400, str(error)) from None
    except Exception:
        raise HTTPException(502, "No se pudo traer el adjunto de Twilio.") from None
    if not archivo.tipo.startswith(("image/", "audio/")):
        raise HTTPException(415, "En el monitor solo se muestran fotos y audios.")
    return Response(archivo.contenido, media_type=archivo.tipo,
                    headers={"Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff"})


@router.post("/mensajes/{mensaje_id}/clasificacion")
def clasificar(mensaje_id: int, _: acceso.Usuario = Sesion) -> list[str]:
    """Con el control tomado, la coordinación pide la revisión de la IA de una foto en lugar de responder ella."""
    return monitor.clasificar(mensaje_id)


@router.post("/simulador")
def simular(mensaje: MensajeEntrante, _: acceso.Usuario = Sesion) -> list[str]:
    """Finge ser WhatsApp por el mismo camino de un mensaje real. No enlaza BSUID: eso solo lo firma Twilio."""
    perfil = mensaje.perfil.model_copy(update={"bsuid": None}) if mensaje.perfil else None
    return bot.recibir(mensaje.model_copy(update={"perfil": perfil}))


@router.get("/simulador/mensajes")
def enviados(telefono: str | None = None, _: acceso.Usuario = Sesion) -> list[MensajeSaliente]:
    """Lo que el sistema envió por WhatsApp: respuestas, avisos y mensajes de la coordinación."""
    return bot.enviados(telefono)
