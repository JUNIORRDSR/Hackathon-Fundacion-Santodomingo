"""Adjuntos de WhatsApp (ADR-0013): se descargan solo de Twilio por HTTPS o de un data: del simulador, y se reparten
por tipo: las fotos van a revisión (ADR-0011) y las notas de voz se vuelven texto para el conversador."""
import base64
import logging
import os
import threading
import time
import urllib.parse
import urllib.request
from collections import defaultdict, deque
from typing import NamedTuple

from app.modulos.clasificacion import contrato as clasificacion
from app.modulos.whatsapp import fotos, voz
from app.modulos.whatsapp.agente.memoria import registrar_actividad
from app.modulos.whatsapp.contrato import MensajeEntrante

log = logging.getLogger("whatsapp")
NO_SE_PUDO_ABRIR = "No pudimos abrir lo que enviaste. Intenta mandarlo de nuevo."
ESPERA = "Recibimos varias fotos o audios seguidos. Espera unos minutos y vuelve a intentarlo."
HOSTS_PERMITIDOS = ("api.twilio.com",)
TAMANO_MAXIMO = 16 * 1024 * 1024  # el de un audio de WhatsApp; las fotos tienen su propio tope
LIMITE_POR_VENTANA, VENTANA = 6, 600  # adjuntos por número cada 10 minutos: cuida la cuota y el costo de los modelos
# ponytail: contador en la memoria del proceso (hay una sola réplica); con más réplicas pasa a una tabla.
_recientes: dict[str, deque] = defaultdict(deque)
_candado = threading.Lock()


class Adjunto(NamedTuple):
    contenido: bytes
    tipo: str


class Atencion(NamedTuple):
    textos: list[str]  # lo que sale ya
    mensaje: MensajeEntrante | None  # lo que sigue al conversador; None: ya se respondió
    revision: list[str] = []  # la revisión de la foto, para que el agente la cuente a su manera (ADR-0016)


def atender(mensaje: MensajeEntrante, memoria: dict, para_el_agente: bool = False) -> Atencion:
    if not mensaje.media_url or not (clasificacion.activa() or voz.activa()):
        return Atencion([], mensaje)
    if excede_el_limite(mensaje.telefono, LIMITE_POR_VENTANA):
        return Atencion([ESPERA], None)
    try:
        adjunto = descargar(mensaje.media_url)
    except Exception:
        log.warning("No se pudo descargar un adjunto", exc_info=True)
        return Atencion([NO_SE_PUDO_ABRIR], None)
    if adjunto.tipo.startswith("audio/") and voz.activa():
        return Atencion(*voz.responder(adjunto.contenido, adjunto.tipo, mensaje))
    if adjunto.tipo.startswith("image/") and clasificacion.activa():
        return _revisar(clasificacion.Foto(contenido=adjunto.contenido, tipo=adjunto.tipo), mensaje, memoria,
                        para_el_agente)
    return Atencion([], mensaje)


def _revisar(foto: clasificacion.Foto, mensaje: MensajeEntrante, memoria: dict, para_el_agente: bool) -> Atencion:
    """La revisión orienta y la foto igual queda para el pedido. Con el agente, su texto fijo es el respaldo."""
    memoria["foto"] = mensaje.media_url
    revision = fotos.responder(foto, memoria)
    if not para_el_agente:
        return Atencion(revision, None)
    registrar_actividad(memoria)
    return Atencion([], mensaje, revision)


def descargar(media_url: str) -> Adjunto:
    """Un data: del simulador o un medio de Twilio por HTTPS. Cualquier otro origen se rechaza: sin SSRF."""
    if media_url.startswith("data:"):
        cabecera, _, datos = media_url.partition(",")
        if len(datos) > TAMANO_MAXIMO * 4 // 3:
            raise ValueError("El adjunto es demasiado grande.")
        return Adjunto(base64.b64decode(datos, validate=True), cabecera[5:].split(";")[0])
    partes = urllib.parse.urlparse(media_url)
    if partes.scheme != "https" or partes.hostname not in HOSTS_PERMITIDOS:
        raise ValueError(f"Origen de adjunto no permitido: {partes.scheme}://{partes.hostname}")
    pedido = urllib.request.Request(media_url)
    pedido.add_unredirected_header("Authorization", f"Basic {_credencial_twilio()}")
    with urllib.request.urlopen(pedido, timeout=5) as respuesta:
        return Adjunto(respuesta.read(TAMANO_MAXIMO + 1), respuesta.headers.get_content_type())


def excede_el_limite(clave: str, limite: int) -> bool:
    """Cuenta un uso de la clave (un número, o el agente de un número) en la ventana de 10 minutos."""
    ahora = time.monotonic()
    with _candado:
        marcas = _recientes[clave]
        while marcas and ahora - marcas[0] > VENTANA:
            marcas.popleft()
        if len(marcas) >= limite:
            return True
        marcas.append(ahora)
        return False


def _credencial_twilio() -> str:
    cuenta, token = os.environ["TWILIO_ACCOUNT_SID"], os.environ["TWILIO_AUTH_TOKEN"]
    return base64.b64encode(f"{cuenta}:{token}".encode()).decode()
