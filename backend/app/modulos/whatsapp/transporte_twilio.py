"""Transporte de WhatsApp: autentica webhooks de Twilio y entrega respuestas y avisos."""
import base64
import json
import os
import re
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from urllib.error import HTTPError

from starlette.datastructures import FormData
from twilio.request_validator import RequestValidator
from twilio.twiml.messaging_response import MessagingResponse

from app.modulos.whatsapp import contactos
from app.modulos.whatsapp.contrato import MensajeEntrante, MensajeSaliente, Perfil

MENSAJES = "https://api.twilio.com/2010-04-01/Accounts/{cuenta}/Messages.json"
RUTA_WEBHOOK = "/api/whatsapp/twilio"
VARIABLES = ("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_WHATSAPP_FROM", "TWILIO_WEBHOOK_URL")
CUENTA = re.compile(r"AC[0-9a-fA-F]{32}")
FIRMA = re.compile(r"[A-Za-z0-9+/]{27}=")
TELEFONO = re.compile(r"\+[1-9][0-9]{7,14}")
BSUID = re.compile(r"[A-Z]{2}\.(?:ENT\.)?[A-Za-z0-9]{1,128}")
SID_MENSAJE = re.compile(r"(?:SM|MM)[0-9a-fA-F]{32}")
USUARIO = re.compile(r"[A-Za-z0-9._]{1,64}")  # usuario de WhatsApp, como ing_jorge_sol
PREFIJO = "whatsapp:"


class ErrorEnvioTwilio(RuntimeError):
    def __init__(self, http: int, codigo: int | None):
        super().__init__("Twilio rechazó el envío")
        self.http = http
        self.codigo = codigo


@dataclass(frozen=True)
class TransporteTwilio:
    cuenta: str
    token: str
    remitente: str
    url_webhook: str
    alias: dict[str, str] = field(default_factory=dict)
    telefonos_piloto: frozenset[str] = frozenset()
    respuesta_twiml: bool = False

    @classmethod
    def desde_entorno(cls) -> "TransporteTwilio":
        cuenta, token, remitente, url = (_variable(nombre) for nombre in VARIABLES)
        if not CUENTA.fullmatch(cuenta):
            raise RuntimeError("TWILIO_ACCOUNT_SID debe contener el SID de la cuenta de Twilio.")
        if not remitente.startswith(PREFIJO) or not TELEFONO.fullmatch(remitente.removeprefix(PREFIJO)):
            raise RuntimeError("TWILIO_WHATSAPP_FROM debe contener whatsapp: seguido del teléfono en formato E.164.")
        return cls(cuenta, token, remitente, _url_publica(url), _alias_configurados(), _telefonos_piloto(),
                   respuesta_twiml=os.getenv("TWILIO_RESPUESTA_TWIML", "").strip() == "1")

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
        telefono = self._telefono(identidad)
        if not telefono:
            raise ValueError("El remitente no tiene un teléfono asociado.")
        if self.telefonos_piloto and telefono not in self.telefonos_piloto:
            raise PermissionError("El remitente está fuera de la prueba piloto.")
        media_url = _valor(parametros, "MediaUrl0") or None
        return MensajeEntrante(telefono=telefono, texto=_valor(parametros, "Body"), media_url=media_url,
                               perfil=_perfil(parametros, identidad)), sid

    def _telefono(self, identidad: str) -> str | None:
        """El número del remitente; si escribe con su usuario (BSUID), el alias configurado o el que ya conocemos."""
        if TELEFONO.fullmatch(identidad):
            return identidad
        if identidad in self.alias:
            return self.alias[identidad]
        return contactos.telefono_de(identidad) if BSUID.fullmatch(identidad) else None

    def enviar(self, mensaje: MensajeSaliente) -> None:
        destino = next((a for a, telefono in self.alias.items() if telefono == mensaje.telefono), mensaje.telefono)
        datos = {"From": self.remitente, "To": f"{PREFIJO}{destino}", "Body": mensaje.texto}
        if mensaje.media_url:
            datos["MediaUrl"] = mensaje.media_url
        credencial = base64.b64encode(f"{self.cuenta}:{self.token}".encode()).decode()
        pedido = urllib.request.Request(MENSAJES.format(cuenta=self.cuenta), urllib.parse.urlencode(datos).encode(),
                                        {"Authorization": f"Basic {credencial}"})
        try:
            with urllib.request.urlopen(pedido, timeout=10) as respuesta:
                respuesta.read()
        except HTTPError as error:
            with error:
                codigo = _codigo_error(error)
            raise ErrorEnvioTwilio(error.code, codigo) from None

    @staticmethod
    def serializar_twiml(mensajes: list[MensajeSaliente]) -> str:
        respuesta = MessagingResponse()
        for mensaje in mensajes:
            if mensaje.media_url:
                salida = respuesta.message()
                if mensaje.texto:
                    salida.body(mensaje.texto)
                salida.media(mensaje.media_url)
            else:
                respuesta.message(mensaje.texto)
        return str(respuesta)


def _perfil(parametros: FormData, identidad: str) -> Perfil:
    """ProfileName, Username y el BSUID (ExternalUserId o el remitente) que Twilio firma con el mensaje."""
    externo = _valor(parametros, "ExternalUserId").removeprefix(PREFIJO)
    bsuid = next((valor for valor in (externo, identidad) if BSUID.fullmatch(valor)), None)
    usuario = _valor(parametros, "Username")
    nombre = " ".join(_valor(parametros, "ProfileName").split())[:80] or None
    return Perfil(nombre=nombre, usuario=usuario if USUARIO.fullmatch(usuario) else None, bsuid=bsuid)


def _codigo_error(respuesta: HTTPError) -> int | None:
    try:
        cuerpo = json.loads(respuesta.read(4096))
    except (OSError, ValueError):
        return None
    codigo = cuerpo.get("code") if isinstance(cuerpo, dict) else None
    return codigo if type(codigo) is int else None


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
