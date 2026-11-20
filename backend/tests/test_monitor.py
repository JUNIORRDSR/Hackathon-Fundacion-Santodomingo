"""Monitor de WhatsApp (ADR-0007): la coordinación ve la conversación completa y puede tomar el control del bot."""
from fastapi.testclient import TestClient

from app.main import app

TELEFONO = "+573000000003"  # ficticio
URL = f"/api/whatsapp/conversaciones/{TELEFONO.replace('+', '%2B')}"


def test_tomar_el_control_calla_al_bot_y_devolverlo_lo_despierta():
    admin = TestClient(app)
    assert admin.post("/api/acceso/entrar", json={"usuario": "admin", "clave": "ecoconecta-demo"}).status_code == 200
    vecino = lambda texto: admin.post("/api/whatsapp/simulador", json={"telefono": TELEFONO, "texto": texto}).json()

    assert vecino("Hola")  # el bot responde con la autorización de datos
    assert any(c["telefono"] == TELEFONO for c in admin.get("/api/whatsapp/conversaciones").json())
    assert admin.post(f"{URL}/mensajes", json={"texto": "Hola"}).status_code == 409  # sin control no se escribe

    assert admin.post(f"{URL}/control").status_code == 204
    assert vecino("¿Alguien me ayuda?") == []  # el bot calla
    assert admin.post(f"{URL}/mensajes", json={"texto": "Hola, soy la coordinación"}).status_code == 204

    autores = [(m["direccion"], m["autor"]) for m in admin.get(f"{URL}/mensajes").json()]
    assert autores == [("entrante", "vecino"), ("saliente", "bot"), ("entrante", "vecino"), ("saliente", "coordinacion")]

    assert admin.delete(f"{URL}/control").status_code == 204
    assert vecino("1")  # el bot vuelve y sigue el registro donde iba
