"""Interpreta mensajes con Azure OpenAI y entrega la intención al diálogo local."""
import json
import os
import re
from contextlib import closing
from http.client import HTTPException, HTTPSConnection
from urllib.parse import urlsplit

from app.modulos.whatsapp.agente import contexto, dialogo, lenguaje
from app.modulos.whatsapp.agente.memoria import vigente as memoria_vigente
from app.modulos.whatsapp.contrato import Herramientas, Respuesta, Turno
from app.modulos.whatsapp.respuestas import texto as plantilla

_FORMATO = {
    "type": "json_schema",
    "name": "intencion_ecoconecta",
    "strict": True,
    "schema": {
        "type": "object",
        "properties": {"intent": {"type": "string", "enum": lenguaje.INTENCIONES}},
        "required": ["intent"],
        "additionalProperties": False,
    },
}
_HOST_AZURE = re.compile(r"[a-z0-9-]+\.(?:openai\.azure\.com|services\.ai\.azure\.com)")
_RUTA = "/openai/v1/responses"
_LIMITE_RESPUESTA = 64 * 1024
_BLOQUEADA = "bloqueada"


class ConversadorLLM:
    """El modelo devuelve una etiqueta. El diálogo decide si procede una acción."""

    def __init__(self, base_url: str, api_key: str, modelo: str, razonamiento_minimo: bool = False):
        self._host = _host_recurso(base_url)
        self._api_key = api_key
        self._modelo = modelo
        self._razonamiento_minimo = razonamiento_minimo

    @classmethod
    def desde_entorno(cls) -> "ConversadorLLM":
        return cls(os.getenv("OPENAI_BASE_URL", "").strip(), os.getenv("OPENAI_API_KEY", "").strip(),
                   os.getenv("CONVERSADOR_MODELO", "").strip(),
                   razonamiento_minimo=os.getenv("CONVERSADOR_RAZONAMIENTO", "").strip() == "minimal")

    def responder(self, turno: Turno, memoria: dict, herramientas: Herramientas) -> Respuesta:
        memoria = memoria_vigente(memoria)
        if lenguaje.intenta_cambiar_reglas(turno.texto):
            return Respuesta(textos=[plantilla("agente_fuera_de_alcance")], memoria=memoria)
        habilitado = self._host and self._api_key and self._modelo and not turno.media_url
        texto = lenguaje.para_azure(turno.texto, memoria) if habilitado else ""
        intencion = self._clasificar(texto) if texto else None
        if intencion == _BLOQUEADA:
            return Respuesta(textos=[plantilla("agente_fuera_de_alcance")], memoria=memoria)
        return dialogo.responder(turno, memoria, herramientas, intencion)

    def _cuerpo(self, texto: str) -> bytes:
        datos = {
            "model": self._modelo,
            "instructions": contexto.instrucciones(),
            "input": [{"role": "user", "content": texto}],
            "store": False,
            "max_output_tokens": 128 if self._razonamiento_minimo else 64,
            "text": {"format": _FORMATO},
        }
        if self._razonamiento_minimo:
            datos["reasoning"] = {"effort": "minimal"}
        return json.dumps(datos).encode("utf-8")

    def _clasificar(self, texto: str) -> str | None:
        cabeceras = {"api-key": self._api_key, "Content-Type": "application/json"}
        tiempo = 3 if self._razonamiento_minimo else 2
        try:
            with closing(HTTPSConnection(self._host, timeout=tiempo)) as conexion:
                conexion.request("POST", _RUTA, body=self._cuerpo(texto), headers=cabeceras)
                with conexion.getresponse() as respuesta:
                    if respuesta.status not in (200, 400):
                        return None
                    datos = respuesta.read(_LIMITE_RESPUESTA + 1)
                    estado = respuesta.status
            return _intencion(estado, json.loads(datos)) if len(datos) <= _LIMITE_RESPUESTA else None
        except (OSError, HTTPException, ValueError, RecursionError):
            return None


def _host_recurso(base_url: str) -> str:
    try:
        url = urlsplit(base_url)
        if url.scheme != "https" or url.username is not None or url.port not in (None, 443):
            return ""
    except ValueError:
        return ""
    host = url.hostname or ""
    if url.query or url.fragment or url.path not in ("", "/", "/openai/v1", "/openai/v1/"):
        return ""
    return host if _HOST_AZURE.fullmatch(host) else ""


def _intencion(estado: int, respuesta: object) -> str | None:
    if not isinstance(respuesta, dict):
        return None
    if _contenido_bloqueado(respuesta):
        return _BLOQUEADA
    if estado != 200 or respuesta.get("status") != "completed":
        return None
    mensajes = respuesta.get("output")
    if not isinstance(mensajes, list):
        return None
    textos = [texto for mensaje in mensajes for texto in _textos_del_modelo(mensaje)]
    if len(textos) != 1:
        return None
    contenido = json.loads(textos[0])
    if not isinstance(contenido, dict) or set(contenido) != {"intent"}:
        return None
    intencion = contenido["intent"]
    return intencion if intencion in lenguaje.INTENCIONES else None


def _contenido_bloqueado(respuesta: dict) -> bool:
    error = respuesta.get("error")
    if isinstance(error, dict) and error.get("code") in ("content_filter", "ContentFiltered"):
        return True
    incompleta = respuesta.get("incomplete_details")
    return isinstance(incompleta, dict) and incompleta.get("reason") == "content_filter"


def _textos_del_modelo(mensaje: object) -> list[str]:
    if not isinstance(mensaje, dict) or mensaje.get("type") != "message" or mensaje.get("role") != "assistant":
        return []
    contenido = mensaje.get("content")
    if not isinstance(contenido, list):
        return []
    return [parte["text"] for parte in contenido if isinstance(parte, dict) and parte.get("type") == "output_text"
            and isinstance(parte.get("text"), str)]
