"""Transporte por Twilio (WhatsApp Business Platform): versión básica que Jorge completa o reemplaza (ADR-0003)."""
import base64
import hashlib
import hmac
import os
import urllib.parse
import urllib.request
from dataclasses import dataclass

from app.modulos.whatsapp.contrato import MensajeSaliente

MENSAJES = "https://api.twilio.com/2010-04-01/Accounts/{cuenta}/Messages.json"
VARIABLES = ("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_WHATSAPP_FROM")


@dataclass(frozen=True)
class TransporteTwilio:
    cuenta: str
    token: str
    remitente: str  # en el sandbox: whatsapp:+14155238886

    @classmethod
    def desde_entorno(cls) -> "TransporteTwilio":
        return cls(*(os.environ[variable] for variable in VARIABLES))

    def enviar(self, mensaje: MensajeSaliente) -> None:
        datos = {"From": self.remitente, "To": f"whatsapp:{mensaje.telefono}", "Body": mensaje.texto}
        if mensaje.media_url:
            datos["MediaUrl"] = mensaje.media_url
        credencial = base64.b64encode(f"{self.cuenta}:{self.token}".encode()).decode()
        pedido = urllib.request.Request(MENSAJES.format(cuenta=self.cuenta), urllib.parse.urlencode(datos).encode(),
                                        {"Authorization": f"Basic {credencial}"})
        with urllib.request.urlopen(pedido, timeout=10) as respuesta:
            respuesta.read()

    def firma_valida(self, url: str, parametros: dict[str, str], firma: str) -> bool:
        """Twilio firma cada webhook: HMAC-SHA1 de la URL seguida de los parámetros ordenados, en base64."""
        datos = url + "".join(clave + parametros[clave] for clave in sorted(parametros))
        esperada = base64.b64encode(hmac.new(self.token.encode(), datos.encode(), hashlib.sha1).digest()).decode()
        return hmac.compare_digest(esperada, firma)
