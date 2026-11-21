"""Notas de voz y salvaguardas de los adjuntos (ADR-0013): solo de vecinos habilitados, el texto sigue al conversador
como si lo hubieran escrito y un número no puede agotar la cuota de los modelos. Se sustituye solo lo externo."""
import base64
import email.message
import urllib.request
from collections import defaultdict, deque

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modulos.whatsapp import adjuntos, voz

HABILITADA, NUEVO = "+573000000000", "+573000000006"  # ficticios; el 6 Twilio lo rechaza y nunca se registra
OGG = b"OggS-nota-de-voz-de-prueba"
NOTA = "data:audio/ogg;base64," + base64.b64encode(OGG).decode()


class TranscriptorFalso:
    """Hace de Whisper: guarda cada audio y responde el texto que la prueba le indique."""

    def __init__(self, texto: str | Exception):
        self.texto, self.audios = texto, []

    def transcribir(self, audio: bytes, tipo: str) -> str:
        self.audios.append((audio, tipo))
        if isinstance(self.texto, Exception):
            raise self.texto
        return self.texto


@pytest.fixture
def whisper(monkeypatch):
    monkeypatch.setenv("TRANSCRIPCION_MODELO", "whisper")
    monkeypatch.setattr(adjuntos, "_recientes", defaultdict(deque))

    def responder_con(texto: str | Exception) -> TranscriptorFalso:
        falso = TranscriptorFalso(texto)
        monkeypatch.setattr(voz, "transcribir", falso.transcribir)
        return falso
    return responder_con


@pytest.fixture(scope="module")
def admin() -> TestClient:
    cliente = TestClient(app)
    assert cliente.post("/api/acceso/entrar", json={"usuario": "admin", "clave": "ecoconecta-demo"}).status_code == 200
    zona = cliente.get("/api/directorio/zonas").json()[0]["id"]
    vecino = {"telefono": HABILITADA, "nombre": "Vecino de Voz", "tipo": "hogar", "zona_id": zona,
              "direccion": "Torre 2, apto 202", "autoriza_datos": True}
    assert cliente.post("/api/directorio/solicitantes", json=vecino).status_code == 201
    return cliente


def _whatsapp(admin: TestClient, telefono: str, texto: str = "", media_url: str | None = None) -> list[str]:
    respuesta = admin.post("/api/whatsapp/simulador", json={"telefono": telefono, "texto": texto, "media_url": media_url})
    assert respuesta.status_code == 200, respuesta.text
    return respuesta.json()


def test_una_nota_de_voz_responde_igual_que_si_la_hubiera_escrito(whisper, admin):
    falso = whisper("Tres.")
    por_voz = _whatsapp(admin, HABILITADA, media_url=NOTA)
    escrito = _whatsapp(admin, HABILITADA, "3")
    assert falso.audios == [(OGG, "audio/ogg")]
    assert "Tres." in por_voz[0] and por_voz[1:] == escrito  # el eco muestra lo que se entendió


def test_si_whisper_falla_lo_dice_sin_tumbar_la_conversacion(whisper, admin):
    whisper(TimeoutError("Azure no respondió"))
    assert _whatsapp(admin, HABILITADA, media_url=NOTA) == [voz.NO_TE_ESCUCHE]


def test_sin_modelo_de_transcripcion_el_audio_sigue_al_conversador_sin_transcribirse(whisper, admin, monkeypatch):
    falso = whisper("Tres.")
    monkeypatch.delenv("TRANSCRIPCION_MODELO")
    assert _whatsapp(admin, HABILITADA, media_url=NOTA) == _whatsapp(admin, HABILITADA, "")
    assert falso.audios == []


def test_la_voz_de_quien_no_ha_autorizado_sus_datos_no_se_envia_al_modelo(whisper, admin):
    falso = whisper("Tres.")
    _whatsapp(admin, NUEVO, media_url=NOTA)
    assert falso.audios == []  # Ley 1581: primero la autorización, en el registro


def test_un_numero_no_puede_agotar_la_cuota_de_los_modelos(whisper, admin, monkeypatch):
    falso = whisper("Tres.")
    monkeypatch.setattr(adjuntos, "LIMITE_POR_VENTANA", 2)
    respuestas = [_whatsapp(admin, HABILITADA, media_url=NOTA) for _ in range(3)]
    assert len(falso.audios) == 2 and respuestas[2] == [adjuntos.ESPERA]


def test_un_adjunto_que_no_viene_de_twilio_no_se_descarga(whisper, admin, monkeypatch):
    falso, pedidos = whisper("Tres."), []
    monkeypatch.setattr(urllib.request, "urlopen", lambda pedido, timeout: pedidos.append(pedido))
    respuesta = _whatsapp(admin, HABILITADA, media_url="https://otro-sitio.example/nota.ogg")
    assert respuesta == [adjuntos.NO_SE_PUDO_ABRIR] and pedidos == [] and falso.audios == []


class RespuestaWhisper:
    def __init__(self):
        self.headers = email.message.Message()
        self.headers["Content-Type"] = "application/json"

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def read(self, *_):
        return b'{"text": "Quiero que recojan mis org\\u00e1nicos"}'


@pytest.mark.parametrize(("base", "url", "cabecera", "credencial"), [
    # La API v1 de Azure no enruta Whisper (404 DeploymentNotFound): va por la ruta clásica del despliegue.
    ("https://recurso.openai.azure.com/openai/v1/",
     "https://recurso.openai.azure.com/openai/deployments/whisper/audio/transcriptions?api-version=2024-06-01",
     "Api-key", "clave-de-prueba"),
    (None, "https://api.openai.com/v1/audio/transcriptions", "Authorization", "Bearer clave-de-prueba"),
])
def test_a_whisper_le_llegan_el_audio_el_idioma_y_el_despliegue(monkeypatch, base, url, cabecera, credencial):
    if base:
        monkeypatch.setenv("OPENAI_BASE_URL", base)
    else:
        monkeypatch.delenv("OPENAI_BASE_URL", raising=False)
    monkeypatch.setenv("OPENAI_API_KEY", "clave-de-prueba")
    monkeypatch.setenv("TRANSCRIPCION_MODELO", "whisper")
    pedidos = []
    monkeypatch.setattr(urllib.request, "urlopen", lambda pedido, timeout: pedidos.append(pedido) or RespuestaWhisper())
    assert voz.transcribir(OGG, "audio/ogg") == "Quiero que recojan mis orgánicos"
    pedido = pedidos[0]
    assert pedido.full_url == url and pedido.get_header(cabecera) == credencial
    assert pedido.get_header("Content-type").startswith("multipart/form-data; boundary=")
    assert b'name="model"\r\n\r\nwhisper\r\n' in pedido.data and b'name="language"\r\n\r\nes\r\n' in pedido.data
    assert OGG in pedido.data and b'filename="nota.og' in pedido.data
