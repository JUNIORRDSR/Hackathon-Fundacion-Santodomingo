"""Estado de corta duración guardado en la conversación de PostgreSQL."""
import re
from time import time

from app.compartido.tipos import Flujo, Franja


PASOS = ("pidiendo", "esperando_flujo", "canjeando", "ofrecio_canjes", "esperando_aprender")
_ACTUALIZADO = "agente_actualizado"
_SEGUNDOS = 30 * 60
_FRANJAS = tuple(franja.value for franja in Franja)
_UUID = re.compile(r"[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}", re.I)


def vigente(memoria: dict) -> dict:
    """Acepta los borradores anteriores al sello de actividad y conserva el estado de registro."""
    copia = memoria.copy()
    sello = copia.get(_ACTUALIZADO)
    if sello is not None and (not isinstance(sello, int) or not 0 <= int(time()) - sello <= _SEGUNDOS):
        retirar_borrador(copia)
    if copia.get("pidiendo") not in (Flujo.ORGANICO, Flujo.RECICLABLE):
        copia.pop("pidiendo", None)
    if "pidiendo" in copia:
        copia.pop("esperando_flujo", None)
    elif copia.get("esperando_flujo") not in (*_FRANJAS, None):
        copia["esperando_flujo"] = None
    if not _premios_validos(copia.get("canjeando")) or "pidiendo" in copia or "esperando_flujo" in copia:
        copia.pop("canjeando", None)
    return copia


def _premios_validos(premios: object) -> bool:
    return (isinstance(premios, list) and bool(premios)
            and all(isinstance(premio, str) and _UUID.fullmatch(premio) for premio in premios))


def registrar_actividad(memoria: dict) -> None:
    if any(clave in memoria for clave in (*PASOS, "foto")):
        memoria[_ACTUALIZADO] = int(time())
    else:
        memoria.pop(_ACTUALIZADO, None)


def retirar_borrador(memoria: dict) -> None:
    for clave in (*PASOS, "foto", _ACTUALIZADO):
        memoria.pop(clave, None)
