"""Notas de voz (ADR-0012): Whisper de Azure OpenAI las vuelve texto y el turno sigue como si la persona lo hubiera
escrito. Solo de vecinos habilitados: antes de autorizar sus datos, su voz no se envía a nadie (Ley 1581)."""
import json
import logging
import os
import urllib.request
import uuid

from app.modulos.whatsapp.contrato import MensajeEntrante

log = logging.getLogger("whatsapp")
NO_TE_ESCUCHE = "No pudimos entender tu nota de voz. ¿Nos lo escribes, por favor?"
TIEMPO_MAXIMO = 10  # segundos: Twilio espera 15 la respuesta del webhook
TAMANO_MAXIMO = 16 * 1024 * 1024
LARGO_MAXIMO = 500  # caracteres que siguen al conversador
VOCABULARIO = "EcoConecta, orgánicos, reciclables, huerteros, recicladores, Brisas de San Pablo, recolección, canje"
NUMEROS = {"uno": "1", "una": "1", "dos": "2", "tres": "3", "cuatro": "4", "cinco": "5", "seis": "6", "siete": "7",
           "ocho": "8", "nueve": "9"}
EXTENSIONES = {"audio/ogg": ".ogg", "audio/mpeg": ".mp3", "audio/mp4": ".m4a", "audio/wav": ".wav",
               "audio/x-wav": ".wav", "audio/webm": ".webm"}


def activa() -> bool:
    return bool(os.getenv("TRANSCRIPCION_MODELO"))


def responder(audio: bytes, tipo: str, mensaje: MensajeEntrante) -> tuple[list[str], MensajeEntrante | None]:
    """El eco muestra lo que se entendió; el texto sigue al conversador como si la persona lo hubiera escrito."""
    try:
        if len(audio) > TAMANO_MAXIMO:
            raise ValueError("La nota de voz es demasiado grande.")
        texto = transcribir(audio, tipo).strip()[:LARGO_MAXIMO]
    except Exception:
        log.warning("No se pudo transcribir una nota de voz", exc_info=True)
        texto = ""
    if not texto:
        return [NO_TE_ESCUCHE], None
    escrito = mensaje.model_copy(update={"texto": como_opcion(texto), "media_url": None})
    return [f"🎙️ Entendí: «{texto}»"], escrito


def transcribir(audio: bytes, tipo: str) -> str:
    """Devuelve el texto de la nota. Levanta si la API falla o no responde a tiempo."""
    campos = {"model": os.environ["TRANSCRIPCION_MODELO"], "language": "es", "prompt": VOCABULARIO,
              "response_format": "json"}
    cuerpo, tipo_cuerpo = _formulario(audio, tipo, campos)
    url = (os.getenv("OPENAI_BASE_URL") or "https://api.openai.com/v1/").rstrip("/") + "/audio/transcriptions"
    cabeceras = {"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}", "Content-Type": tipo_cuerpo}
    with urllib.request.urlopen(urllib.request.Request(url, cuerpo, cabeceras), timeout=TIEMPO_MAXIMO) as respuesta:
        return json.load(respuesta)["text"]


def como_opcion(texto: str) -> str:
    """«Tres.» → «3», para que el menú numerado también funcione por voz."""
    palabra = texto.strip().strip(".,;:!¡¿?").lower()
    if palabra.isdigit():
        return palabra
    return NUMEROS.get(palabra, texto)


def _formulario(audio: bytes, tipo: str, campos: dict[str, str]) -> tuple[bytes, str]:
    """multipart/form-data con la librería estándar: los campos y el audio como archivo."""
    limite = uuid.uuid4().hex
    partes = "".join(f'--{limite}\r\nContent-Disposition: form-data; name="{nombre}"\r\n\r\n{valor}\r\n'
                     for nombre, valor in campos.items())
    archivo = (f'--{limite}\r\nContent-Disposition: form-data; name="file"; '
               f'filename="nota{EXTENSIONES.get(tipo, ".ogg")}"\r\nContent-Type: {tipo}\r\n\r\n')
    cuerpo = partes.encode() + archivo.encode() + audio + f"\r\n--{limite}--\r\n".encode()
    return cuerpo, f"multipart/form-data; boundary={limite}"
