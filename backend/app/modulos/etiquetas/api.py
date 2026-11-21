"""API de etiquetas: imprimir el QR y el código de cada hogar, y leerlos al pesar la bolsa (ADR-0015)."""
from fastapi import APIRouter, Depends, Query

from app.modulos.acceso import contrato as acceso
from app.modulos.etiquetas import contrato as etiquetas

router = APIRouter(prefix="/api/etiquetas", tags=["etiquetas"])
Sesion = Depends(acceso.usuario_actual)


@router.get("")
def para_imprimir(_: acceso.Usuario = Sesion) -> list[etiquetas.EtiquetaVista]:
    return etiquetas.etiquetas()


@router.get("/lectura")
def leer(contenido: str = Query(max_length=200), u: acceso.Usuario = Sesion) -> etiquetas.Lectura:
    """El QR que leyó la cámara o el código escrito en la bolsa: el hogar y su solicitud abierta del colectivo."""
    return etiquetas.leer(contenido, acceso.colectivo_visible(u, None))
