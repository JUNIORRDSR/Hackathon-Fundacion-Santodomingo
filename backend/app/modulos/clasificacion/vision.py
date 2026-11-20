"""Llamada al modelo con visión por la API v1 de Azure OpenAI, compatible con la de OpenAI (ADR-0007). Solo viajan
la foto y el pedido, y el proveedor no guarda la respuesta (store: false)."""
import base64
import json
import os
import urllib.request

from app.modulos.clasificacion.dominio import ESQUEMA, REGLAS

TIEMPO_MAXIMO = 12  # segundos: Twilio espera 15 la respuesta del webhook
OPENAI = "https://api.openai.com/v1/"


def preguntar(foto: bytes, tipo: str, pedido: str) -> str:
    """Devuelve el JSON que escribió el modelo. Levanta si la API falla o no responde a tiempo."""
    url = os.getenv("OPENAI_BASE_URL") or OPENAI
    cabeceras = {"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}", "Content-Type": "application/json"}
    solicitud = urllib.request.Request(url.rstrip("/") + "/responses", json.dumps(_cuerpo(foto, tipo, pedido)).encode(),
                                       cabeceras)
    with urllib.request.urlopen(solicitud, timeout=TIEMPO_MAXIMO) as respuesta:
        return _texto(json.load(respuesta))


def _cuerpo(foto: bytes, tipo: str, pedido: str) -> dict:
    imagen = f"data:{tipo};base64,{base64.b64encode(foto).decode()}"
    contenido = [{"type": "input_text", "text": pedido}, {"type": "input_image", "image_url": imagen}]
    formato = {"type": "json_schema", "name": "revision_de_foto", "strict": True, "schema": ESQUEMA}
    return {"model": os.environ["CLASIFICACION_MODELO"], "instructions": REGLAS, "store": False,
            "reasoning": {"effort": "minimal"}, "input": [{"role": "user", "content": contenido}],
            "text": {"format": formato}}


def _texto(respuesta: dict) -> str:
    """El texto del mensaje final; los bloques de razonamiento se saltan."""
    for item in respuesta.get("output", []):
        for parte in item.get("content") or []:
            if parte.get("type") == "output_text":
                return parte["text"]
    raise ValueError(f"El modelo no devolvió texto (estado: {respuesta.get('status')}).")
