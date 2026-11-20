"""Contrato de clasificacion: revisa si los residuos de una foto están bien separados (ADR-0011). Es orientativo: no
bloquea ni cambia la solicitud, y al modelo solo llegan la foto y el flujo (§9)."""
import logging
import os

from pydantic import BaseModel

from app.compartido.tipos import Flujo
from app.modulos.clasificacion import dominio, vision
from app.modulos.clasificacion.dominio import Problema, Veredicto

log = logging.getLogger("clasificacion")
TIPOS = ("image/jpeg", "image/png")
TAMANO_MAXIMO = 5 * 1024 * 1024  # el de una imagen de WhatsApp


class Foto(BaseModel):
    contenido: bytes
    tipo: str  # image/jpeg o image/png


class EvaluacionFoto(BaseModel):
    veredicto: Veredicto
    flujo_detectado: Flujo | None = None  # None: hay mezcla o no se distingue
    problemas: list[Problema] = []
    mensaje: str  # texto fijo, listo para WhatsApp
    modelo: str
    error: str | None = None  # solo si no se pudo revisar


def activa() -> bool:
    return os.getenv("CLASIFICACION_ACTIVA") == "true"


def evaluar(foto: Foto, flujo: Flujo | None) -> EvaluacionFoto:
    """Nunca lanza: si no se puede revisar, responde no_concluyente con el motivo en `error`."""
    modelo = os.getenv("CLASIFICACION_MODELO", "")
    motivo = _motivo_para_no_revisar(foto, modelo)
    if motivo:
        return _sin_revisar(motivo, modelo)
    try:
        lectura = dominio.leer(vision.preguntar(foto.contenido, foto.tipo, dominio.pedido(flujo)))
    except Exception as error:
        log.warning("No se pudo revisar la foto: %s", type(error).__name__)
        return _sin_revisar(f"fallo_del_modelo: {type(error).__name__}", modelo)
    log.info("Foto revisada: %s %s", lectura.veredicto, [p.value for p in lectura.problemas])
    return EvaluacionFoto(veredicto=lectura.veredicto, flujo_detectado=lectura.flujo, problemas=lectura.problemas,
                          mensaje=dominio.mensaje(lectura), modelo=modelo)


def _motivo_para_no_revisar(foto: Foto, modelo: str) -> str | None:
    if not activa():
        return "desactivada"
    if not modelo:
        return "sin_modelo"
    if foto.tipo not in TIPOS:
        return "tipo_no_soportado"
    if not foto.contenido:
        return "foto_vacia"
    return "foto_muy_grande" if len(foto.contenido) > TAMANO_MAXIMO else None


def _sin_revisar(motivo: str, modelo: str) -> EvaluacionFoto:
    return EvaluacionFoto(veredicto=Veredicto.NO_CONCLUYENTE, mensaje=dominio.SIN_REVISAR, modelo=modelo, error=motivo)
