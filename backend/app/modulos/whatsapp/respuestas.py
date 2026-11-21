"""Catálogo de WhatsApp con sustituciones parciales y recarga de la última edición válida."""
import json
import logging
import os
from pathlib import Path
from string import Formatter
from threading import Lock


def _leer(ruta: Path) -> dict:
    datos = json.loads(ruta.read_text(encoding="utf-8-sig"))
    if not isinstance(datos, dict):
        raise ValueError("El catálogo debe ser un objeto JSON")
    return datos


def _marcadores(plantilla: str) -> set[str]:
    campos = set()
    for _, campo, formato, conversion in Formatter().parse(plantilla):
        if campo is None:
            continue
        if not campo.isidentifier() or formato or conversion:
            raise ValueError("Usa marcadores simples, por ejemplo {nombre}")
        campos.add(campo)
    return campos


_PREDETERMINADAS = _leer(Path(__file__).with_suffix(".json"))
_MARCADORES = {clave: _marcadores(plantilla) for clave, plantilla in _PREDETERMINADAS.items()}
_FIRMA = tuple[int, int, int, int] | None
_catalogos: dict[Path, tuple[_FIRMA, dict[str, str]]] = {}
_candado = Lock()
_log = logging.getLogger("whatsapp")


def _validar(cambios: dict) -> None:
    for clave, plantilla in cambios.items():
        if clave not in _MARCADORES or not isinstance(plantilla, str) or not plantilla.strip():
            raise ValueError("La clave debe existir y su texto no puede estar vacío")
        if _marcadores(plantilla) != _MARCADORES[clave]:
            raise ValueError("Conserva los marcadores de cada plantilla")


def _firma(ruta: Path) -> _FIRMA:
    try:
        datos = ruta.stat()
    except (OSError, ValueError):
        return None
    return datos.st_mtime_ns, datos.st_ctime_ns, datos.st_size, datos.st_ino


def _catalogo(ruta: Path) -> dict[str, str]:
    with _candado:
        anterior, vigente = _catalogos.get(ruta, (None, _PREDETERMINADAS))
        firma = _firma(ruta)
        if firma == anterior:
            return vigente
        try:
            cambios = _leer(ruta)
            _validar(cambios)
        except (OSError, ValueError, RecursionError):
            _log.warning("No se pudo recargar el catálogo de WhatsApp. Se conserva la versión válida.")
        else:
            vigente = _PREDETERMINADAS | cambios
        _catalogos[ruta] = firma, vigente
        return vigente


def texto(clave: str, **valores: object) -> str:
    """Lee la versión válida y sustituye los marcadores de una respuesta."""
    ruta = os.getenv("WHATSAPP_REPLIES_FILE")
    catalogo = _catalogo(Path(ruta)) if ruta else _PREDETERMINADAS
    return catalogo[clave].format(**valores)
