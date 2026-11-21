"""Fotos y audios en el monitor (ADR-0014): la tablet ve lo que mandó el vecino sin conocer la credencial de Twilio y,
con el control tomado, la coordinación decide si responde ella o pide la revisión de la IA. Se sustituye lo externo."""
import base64
import email.message
import json
import urllib.request

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modulos.clasificacion import vision

TELEFONO = "+573000000004"  # ficticio
JPEG = b"\xff\xd8\xff\xe0foto-del-monitor"
FOTO = "data:image/jpeg;base64," + base64.b64encode(JPEG).decode()
TWILIO = "https://api.twilio.com/2010-04-01/Accounts/AC1/Messages/MM1/Media/ME1"
MAL_SEPARADA = {"veredicto": "mal_separado", "flujo_detectado": "reciclable", "problemas": ["organico_en_reciclables"]}


@pytest.fixture(scope="module")
def admin() -> TestClient:
    cliente = TestClient(app)
    assert cliente.post("/api/acceso/entrar", json={"usuario": "admin", "clave": "ecoconecta-demo"}).status_code == 200
    zona = cliente.get("/api/directorio/zonas").json()[0]["id"]
    vecina = {"telefono": TELEFONO, "nombre": "Vecina del Monitor", "tipo": "hogar", "zona_id": zona,
              "direccion": "Torre 4, apto 404", "autoriza_datos": True}
    assert cliente.post("/api/directorio/solicitantes", json=vecina).status_code == 201
    return cliente


class RespuestaTwilio:
    def __init__(self, cuerpo: bytes, tipo: str):
        self.cuerpo, self.headers = cuerpo, email.message.Message()
        self.headers["Content-Type"] = tipo

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def read(self, *_):
        return self.cuerpo


def test_la_tablet_ve_la_foto_de_twilio_sin_conocer_la_credencial(admin, monkeypatch):
    monkeypatch.setenv("TWILIO_ACCOUNT_SID", "AC-prueba")
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "token-de-prueba")
    monkeypatch.setattr(urllib.request, "urlopen", lambda pedido, timeout: RespuestaTwilio(JPEG, "image/jpeg"))
    respuesta = admin.get("/api/whatsapp/adjunto", params={"url": TWILIO})
    assert respuesta.status_code == 200 and respuesta.content == JPEG
    assert respuesta.headers["content-type"] == "image/jpeg"
    assert TestClient(app).get("/api/whatsapp/adjunto", params={"url": TWILIO}).status_code == 401


@pytest.mark.parametrize(("url", "codigo"), [
    ("https://otro-sitio.example/foto.jpg", 400),  # sin SSRF
    ("data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==", 415),  # sin XSS desde nuestro dominio
])
def test_el_monitor_no_sirve_otros_origenes_ni_otros_tipos(admin, url, codigo):
    assert admin.get("/api/whatsapp/adjunto", params={"url": url}).status_code == codigo


def test_con_el_control_tomado_la_coordinacion_pide_la_revision_de_la_ia(admin, monkeypatch):
    monkeypatch.setenv("CLASIFICACION_ACTIVA", "true")
    monkeypatch.setenv("CLASIFICACION_MODELO", "modelo-de-prueba")
    monkeypatch.setattr(vision, "preguntar", lambda foto, tipo, pedido: json.dumps(MAL_SEPARADA))
    assert admin.post(f"/api/whatsapp/conversaciones/{TELEFONO}/control").status_code == 204
    enviada = admin.post("/api/whatsapp/simulador", json={"telefono": TELEFONO, "texto": "", "media_url": FOTO})
    assert enviada.json() == []  # el bot calla: decide la coordinación
    hilo = admin.get(f"/api/whatsapp/conversaciones/{TELEFONO}/mensajes").json()
    foto = next(m for m in hilo if m["media_url"] == FOTO)
    textos = admin.post(f"/api/whatsapp/mensajes/{foto['id']}/clasificacion").json()
    assert "comida" in textos[0]
    despues = admin.get(f"/api/whatsapp/conversaciones/{TELEFONO}/mensajes").json()
    assert any(m["autor"] == "bot" and "comida" in m["texto"] for m in despues if m["id"] > foto["id"])
