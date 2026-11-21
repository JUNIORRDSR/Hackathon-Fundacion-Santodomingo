"""Cliente de la API Responses (v1) de Azure OpenAI para el agente (ADR-0016). La clave solo viaja a un host de
Azure, sin redirecciones, y el proveedor no guarda la conversación (store: false)."""
import json
import os
import re
from contextlib import closing
from dataclasses import dataclass
from http.client import HTTPException, HTTPSConnection
from urllib.parse import urlsplit

_HOST_AZURE = re.compile(r"[a-z0-9-]+\.(?:openai\.azure\.com|services\.ai\.azure\.com)")
_RUTA = "/openai/v1/responses"
_LIMITE_RESPUESTA = 512 * 1024
ESPERA_MAXIMA = 8.0  # segundos por llamada: el plazo total lo decide el turno


class AgenteNoDisponible(Exception):
    """Azure no respondió a tiempo o respondió algo que no se puede usar: contesta el diálogo local."""


class ContenidoBloqueado(Exception):
    """Las salvaguardas de Azure (Prompt Shields y filtros) frenaron el mensaje."""


@dataclass(frozen=True)
class ClienteAzure:
    host: str
    clave: str
    modelo: str
    razonamiento_minimo: bool = False

    @classmethod
    def desde_entorno(cls) -> "ClienteAzure | None":
        host = host_azure(os.getenv("OPENAI_BASE_URL", "").strip())
        clave, modelo = os.getenv("OPENAI_API_KEY", "").strip(), os.getenv("CONVERSADOR_MODELO", "").strip()
        if not (host and clave and modelo):
            return None
        return cls(host, clave, modelo, os.getenv("CONVERSADOR_RAZONAMIENTO", "").strip() == "minimal")

    def responder(self, instrucciones: str, entrada: list[dict], herramientas: list[dict], espera: float) -> list[dict]:
        """Los elementos de salida del modelo: mensajes, llamadas a herramientas y razonamiento cifrado."""
        estado, datos = self._publicar(self._cuerpo(instrucciones, entrada, herramientas), min(espera, ESPERA_MAXIMA))
        return _salida(estado, datos)

    def _cuerpo(self, instrucciones: str, entrada: list[dict], herramientas: list[dict]) -> bytes:
        datos = {"model": self.modelo, "instructions": instrucciones, "input": entrada, "tools": herramientas,
                 "parallel_tool_calls": False, "store": False, "max_output_tokens": 1500}
        if self.razonamiento_minimo:  # GPT-5: sin store, el razonamiento vuelve cifrado en la siguiente ronda
            datos |= {"reasoning": {"effort": "minimal"}, "include": ["reasoning.encrypted_content"]}
        return json.dumps(datos).encode("utf-8")

    def _publicar(self, cuerpo: bytes, espera: float) -> tuple[int, object]:
        cabeceras = {"api-key": self.clave, "Content-Type": "application/json"}
        try:
            with closing(HTTPSConnection(self.host, timeout=espera)) as conexion:
                conexion.request("POST", _RUTA, body=cuerpo, headers=cabeceras)
                with conexion.getresponse() as respuesta:
                    estado, datos = respuesta.status, respuesta.read(_LIMITE_RESPUESTA + 1)
            if len(datos) > _LIMITE_RESPUESTA:
                raise AgenteNoDisponible("La respuesta de Azure es demasiado grande.")
            return estado, json.loads(datos)
        except (OSError, HTTPException, ValueError, RecursionError) as error:
            raise AgenteNoDisponible(type(error).__name__) from None


def host_azure(base_url: str) -> str:
    """El host del recurso si la URL es un endpoint HTTPS de Azure OpenAI; si no, vacío y la clave no sale."""
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


def _salida(estado: int, respuesta: object) -> list[dict]:
    if not isinstance(respuesta, dict):
        raise AgenteNoDisponible("Respuesta sin forma")
    if _bloqueada(respuesta):
        raise ContenidoBloqueado()
    if estado != 200 or respuesta.get("status") != "completed":
        raise AgenteNoDisponible(f"HTTP {estado}, estado {respuesta.get('status')}")
    salida = respuesta.get("output")
    if not isinstance(salida, list) or not all(isinstance(item, dict) for item in salida):
        raise AgenteNoDisponible("Salida sin forma")
    return salida


def _bloqueada(respuesta: dict) -> bool:
    error = respuesta.get("error")
    if isinstance(error, dict) and error.get("code") in ("content_filter", "ContentFiltered"):
        return True
    incompleta = respuesta.get("incomplete_details")
    return isinstance(incompleta, dict) and incompleta.get("reason") == "content_filter"
