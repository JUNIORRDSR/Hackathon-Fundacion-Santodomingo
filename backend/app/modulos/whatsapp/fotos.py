"""Fotos que manda un solicitante habilitado: se revisa si los residuos están bien separados y se responde con texto
fijo y la pieza educativa del flujo. Es orientativo: no frena el pedido (ADR-0011)."""
import base64
import logging
import os
import urllib.parse
import urllib.request

from app.compartido.tipos import Flujo
from app.modulos.clasificacion import contrato as clasificacion
from app.modulos.contenidos import contrato as contenidos
from app.modulos.whatsapp.menu import texto_de_pieza

log = logging.getLogger("whatsapp")
NO_SE_PUDO_ABRIR = "No pudimos abrir la foto. Intenta mandarla de nuevo."


def responder(media_url: str, memoria: dict) -> list[str]:
    """El flujo es el que la persona está pidiendo en el menú, si ya lo eligió."""
    try:
        foto = descargar(media_url)
    except Exception:
        log.exception("No se pudo descargar la foto")
        return [NO_SE_PUDO_ABRIR]
    flujo = Flujo(memoria["pidiendo"]) if "pidiendo" in memoria else None
    evaluacion = clasificacion.evaluar(foto, flujo)
    pieza = _pieza(evaluacion, flujo)
    return [evaluacion.mensaje] + ([texto_de_pieza(pieza)] if pieza else [])


def descargar(media_url: str) -> clasificacion.Foto:
    """Acepta data: (simulador) o una URL. La credencial de Twilio solo va a Twilio y no sigue la redirección."""
    if media_url.startswith("data:"):
        cabecera, _, datos = media_url.partition(",")
        return clasificacion.Foto(contenido=base64.b64decode(datos), tipo=cabecera[5:].split(";")[0])
    pedido = urllib.request.Request(media_url)
    if urllib.parse.urlparse(media_url).hostname == "api.twilio.com":
        pedido.add_unredirected_header("Authorization", f"Basic {_credencial_twilio()}")
    with urllib.request.urlopen(pedido, timeout=5) as respuesta:
        return clasificacion.Foto(contenido=respuesta.read(clasificacion.TAMANO_MAXIMO + 1),
                                  tipo=respuesta.headers.get_content_type())


def _credencial_twilio() -> str:
    cuenta, token = os.environ["TWILIO_ACCOUNT_SID"], os.environ["TWILIO_AUTH_TOKEN"]
    return base64.b64encode(f"{cuenta}:{token}".encode()).decode()


def _pieza(evaluacion: clasificacion.EvaluacionFoto, flujo: Flujo | None) -> contenidos.ContenidoVista | None:
    flujo = flujo or evaluacion.flujo_detectado
    if evaluacion.veredicto != clasificacion.Veredicto.MAL_SEPARADO or flujo is None:
        return None
    return contenidos.para_rechazo(flujo)
