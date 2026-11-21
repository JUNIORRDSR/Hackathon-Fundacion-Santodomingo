"""Monitor de WhatsApp (ADR-0007): la coordinación ve la conversación completa y puede tomar el control del bot."""
from fastapi.testclient import TestClient

from app.main import app
from app.modulos.whatsapp import bot

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


def test_lectura_por_usuario_no_oculta_entrantes_que_llegaron_despues():
    telefono = "+573000000006"
    conversaciones = "/api/whatsapp/conversaciones"
    hilo = f"{conversaciones}/{telefono.replace('+', '%2B')}"
    admin, coordinador = TestClient(app), TestClient(app)
    for cliente, usuario in ((admin, "admin"), (coordinador, "huerteros")):
        credenciales = {"usuario": usuario, "clave": "ecoconecta-demo"}
        assert cliente.post("/api/acceso/entrar", json=credenciales).status_code == 200

    def enviar(texto):
        assert admin.post("/api/whatsapp/simulador", json={"telefono": telefono, "texto": texto}).status_code == 200

    def sin_leer(cliente):
        return next(c["sin_leer"] for c in cliente.get(conversaciones).json() if c["telefono"] == telefono)

    enviar("Hola")
    mensajes = admin.get(f"{hilo}/mensajes").json()
    entrante, saliente = (m["id"] for m in mensajes)
    assert sin_leer(admin) == sin_leer(coordinador) == 1
    assert TestClient(app).post(f"{hilo}/lectura", json={"hasta_id": entrante}).status_code == 401
    assert admin.post(f"{hilo}/lectura", json={"hasta_id": saliente}).status_code == 404
    enviar("1")
    assert admin.post(f"{hilo}/lectura", json={"hasta_id": entrante}).status_code == 204
    assert sin_leer(admin) == 1 and sin_leer(coordinador) == 2
    ultimo = max(m["id"] for m in admin.get(f"{hilo}/mensajes").json() if m["direccion"] == "entrante")
    for cursor in (ultimo, entrante):
        assert admin.post(f"{hilo}/lectura", json={"hasta_id": cursor}).status_code == 204
    assert sin_leer(admin) == 0 and sin_leer(coordinador) == 2


def test_fallo_de_envio_de_coordinacion_queda_en_el_hilo_y_se_informa(monkeypatch):
    class TransporteNoDisponible:
        def enviar(self, mensaje):
            raise TimeoutError("detalle interno")

    monkeypatch.setattr(bot, "_transporte", TransporteNoDisponible())
    cliente = TestClient(app)
    credenciales = {"usuario": "admin", "clave": "ecoconecta-demo"}
    assert cliente.post("/api/acceso/entrar", json=credenciales).status_code == 200
    hilo = "/api/whatsapp/conversaciones/%2B573000000012"
    assert cliente.post(f"{hilo}/control").status_code == 204
    respuesta = cliente.post(f"{hilo}/mensajes", json={"texto": "Mensaje de prueba"})
    assert respuesta.status_code == 502
    assert "detalle interno" not in respuesta.text
    mensaje, = cliente.get(f"{hilo}/mensajes").json()
    assert (mensaje["autor"], mensaje["estado"]) == ("coordinacion", "fallido")
