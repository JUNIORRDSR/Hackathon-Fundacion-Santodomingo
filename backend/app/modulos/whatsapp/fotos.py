"""Fotos que manda un solicitante habilitado: se revisa si los residuos están bien separados y se responde con texto
fijo y la pieza educativa del flujo. Es orientativo: no frena el pedido (ADR-0011)."""
from app.compartido.tipos import Flujo
from app.modulos.clasificacion import contrato as clasificacion
from app.modulos.contenidos import contrato as contenidos
from app.modulos.whatsapp.menu import texto_de_pieza


def responder(foto: clasificacion.Foto, memoria: dict) -> list[str]:
    """El flujo es el que la persona está pidiendo en el menú, si ya lo eligió."""
    flujo = Flujo(memoria["pidiendo"]) if "pidiendo" in memoria else None
    evaluacion = clasificacion.evaluar(foto, flujo)
    pieza = _pieza(evaluacion, flujo)
    return [evaluacion.mensaje] + ([texto_de_pieza(pieza)] if pieza else [])


def _pieza(evaluacion: clasificacion.EvaluacionFoto, flujo: Flujo | None) -> contenidos.ContenidoVista | None:
    flujo = flujo or evaluacion.flujo_detectado
    if evaluacion.veredicto != clasificacion.Veredicto.MAL_SEPARADO or flujo is None:
        return None
    return contenidos.para_rechazo(flujo)
