"""Transporte de WhatsApp: autentica webhooks de Twilio y entrega respuestas y avisos."""
import base64
import os
import re
import urllib.parse
import urllib.request
from dataclasses import dataclass, field

from starlette.datastructures import FormData
from twilio.request_validator import RequestValidator

from app.modulos.whatsapp.contrato import MensajeEntrante, MensajeSaliente

MENSAJES = "https://api.twilio.com/2010-04-01/Accounts/{cuenta}/Messages.json"
RUTA_WEBHOOK = "/api/whatsapp/twilio"
VARIABLES = ("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_WHATSAPP_FROM", "TWILIO_WEBHOOK_URL")
CUENTA = re.compile(r"AC[0-9a-fA-F]{32}")
FIRMA = re.compile(r"[A-Za-z0-9+/]{27}=")
TELEFONO = re.compile(r"\+[1-9][0-9]{7,14}")
BSUID = re.compile(r"[A-Z]{2}\.(?:ENT\.)?[A-Za-z0-9]{1,128}")
SID_MENSAJE = re.compile(r"(?:SM|MM)[0-9a-fA-F]{32}")
PREFIJO = "whatsapp:"


@dataclass(frozen=True)
class TransporteTwilio:
    cuenta: str
    token: str
    remitente: str
    url_webhook: str
    alias: dict[str, str] = field(default_factory=dict)
    telefonos_piloto: frozenset[str] = frozenset()

    @classmethod
    def desde_entorno(cls) -> "TransporteTwilio":
        cuenta, token, remitente, url = (_variable(nombre) for nombre in VARIABLES)
        if not CUENTA.fullmatch(cuenta):
            raise RuntimeError("TWILIO_ACCOUNT_SID debe contener el SID de la cuenta de Twilio.")
        if not remitente.startswith(PREFIJO) or not TELEFONO.fullmatch(remitente.removeprefix(PREFIJO)):
            raise RuntimeError("TWILIO_WHATSAPP_FROM debe contener whatsapp: seguido del teléfono en formato E.164.")
        return cls(cuenta, token, remitente, _url_publica(url), _alias_configurados(), _telefonos_piloto())

    def firma_valida(self, parametros: FormData, firma: str) -> bool:
        if not FIRMA.fullmatch(firma):
            return False
        return RequestValidator(self.token).validate(self.url_webhook, parametros, firma)

    def entrada(self, parametros: FormData) -> tuple[MensajeEntrante, str]:
        remitente = _valor(parametros, "From")
        sid = _valor(parametros, "MessageSid")
        if _valor(parametros, "To") != self.remitente or _valor(parametros, "AccountSid") != self.cuenta:
            raise ValueError("El formulario pertenece a otro destinatario o cuenta.")
        if not remitente.startswith(PREFIJO) or not SID_MENSAJE.fullmatch(sid):
            raise ValueError("El remitente o el identificador del mensaje es inválido.")
        identidad = remitente.removeprefix(PREFIJO)
        telefono = identidad if TELEFONO.fullmatch(identidad) else self.alias.get(identidad)
        if not telefono:
            raise ValueError("El remitente no tiene un teléfono asociado.")
        if self.telefonos_piloto and telefono not in self.telefonos_piloto:
            raise PermissionError("El remitente está fuera de la prueba piloto.")
        media_url = _valor(parametros, "MediaUrl0") or None
        return MensajeEntrante(telefono=telefono, texto=_valor(parametros, "Body"), media_url=media_url), sid

    def enviar(self, mensaje: MensajeSaliente) -> None:
        destino = next((a for a, telefono in self.alias.items() if telefono == mensaje.telefono), mensaje.telefono)
        datos = {"From": self.remitente, "To": f"{PREFIJO}{destino}", "Body": mensaje.texto}
        if mensaje.media_url:
            datos["MediaUrl"] = mensaje.media_url
        credencial = base64.b64encode(f"{self.cuenta}:{self.token}".encode()).decode()
        pedido = urllib.request.Request(MENSAJES.format(cuenta=self.cuenta), urllib.parse.urlencode(datos).encode(),
                                        {"Authorization": f"Basic {credencial}"})
        with urllib.request.urlopen(pedido, timeout=10) as respuesta:
            respuesta.read()


def _variable(nombre: str) -> str:
    valor = os.getenv(nombre, "").strip()
    if not valor:
        raise RuntimeError(f"Falta la variable de entorno {nombre}.")
    return valor


def _url_publica(valor: str) -> str:
    mensaje = f"TWILIO_WEBHOOK_URL debe ser la URL HTTPS exacta que acaba en {RUTA_WEBHOOK}, sin parámetros."
    try:
        url = urllib.parse.urlsplit(valor)
        if (url.scheme != "https" or not url.hostname or url.path != RUTA_WEBHOOK or url.query or url.fragment
                or url.username is not None or url.port == 0 or not valor.endswith(RUTA_WEBHOOK)
                or any(caracter.isspace() for caracter in valor)):
            raise ValueError(mensaje)
    except ValueError:
        raise RuntimeError(mensaje) from None
    return valor


def _valores_configurados(nombre: str) -> list[str]:
    crudo = os.getenv(nombre, "").strip()
    return [parte.strip() for parte in crudo.split(",")] if crudo else []


def _alias_configurados() -> dict[str, str]:
    alias = {}
    for par in _valores_configurados("WHATSAPP_CONTACT_ALIASES"):
        identidad, _, telefono = map(str.strip, par.partition("="))
        if not BSUID.fullmatch(identidad) or not TELEFONO.fullmatch(telefono) or identidad in alias:
            raise RuntimeError("WHATSAPP_CONTACT_ALIASES requiere pares BSUID=teléfono E.164 sin BSUID repetidos.")
        alias[identidad] = telefono
    return alias


def _telefonos_piloto() -> frozenset[str]:
    telefonos = _valores_configurados("WHATSAPP_PILOT_NUMBERS")
    if not all(TELEFONO.fullmatch(telefono) for telefono in telefonos):
        raise RuntimeError("WHATSAPP_PILOT_NUMBERS requiere teléfonos E.164 separados por comas.")
    return frozenset(telefonos)


def _valor(parametros: FormData, campo: str) -> str:
    valores = parametros.getlist(campo)
    if len(valores) > 1:
        raise ValueError("El formulario repite un campo de mensaje.")
    return valores[0] if valores else ""
