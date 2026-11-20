"""El webhook de Twilio: solo entra lo que viene firmado, y sigue el mismo camino que el simulador."""
import base64
import hashlib
import hmac

from fastapi.testclient import TestClient

from app.main import app
from app.modulos.whatsapp import bot
from app.modulos.whatsapp.transporte_twilio import TransporteTwilio

URL = "http://testserver/api/whatsapp/twilio"
TOKEN = "token-de-prueba"
TELEFONO = "+573000000002"  # ficticio
ENVIADOS = []


class TwilioSinInternet(TransporteTwilio):
    """Guarda lo que enviaría en lugar de llamar a Twilio."""

    def enviar(self, mensaje):
        ENVIADOS.append(mensaje)


def _firma(parametros: dict[str, str]) -> str:
    datos = URL + "".join(clave + parametros[clave] for clave in sorted(parametros))
    return base64.b64encode(hmac.new(TOKEN.encode(), datos.encode(), hashlib.sha1).digest()).decode()


def test_el_webhook_solo_acepta_mensajes_firmados_por_twilio():
    anterior = bot.transporte()
    bot.configurar(transporte=TwilioSinInternet("AC-prueba", TOKEN, "whatsapp:+10000000000"))
    try:
        cliente, parametros = TestClient(app), {"From": f"whatsapp:{TELEFONO}", "Body": "Hola"}
        falsa = cliente.post("/api/whatsapp/twilio", data=parametros, headers={"X-Twilio-Signature": "falsa"})
        assert falsa.status_code == 403
        firmada = cliente.post("/api/whatsapp/twilio", data=parametros, headers={"X-Twilio-Signature": _firma(parametros)})
        assert firmada.status_code == 200, firmada.text
        assert ENVIADOS[-1].telefono == TELEFONO and "Soy EcoConecta" in ENVIADOS[-1].texto
    finally:
        bot.configurar(transporte=anterior)
