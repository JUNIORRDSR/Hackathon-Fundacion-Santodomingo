"""API de clasificacion: revisar una foto desde /docs, sin WhatsApp. Sirve de plan B en la demo (ADR-0011)."""
from fastapi import APIRouter, Depends, Request
from starlette.concurrency import run_in_threadpool

from app.compartido.tipos import Flujo
from app.modulos.acceso import contrato as acceso
from app.modulos.clasificacion import contrato as clasificacion

router = APIRouter(prefix="/api/clasificacion", tags=["clasificacion"])
Sesion = Depends(acceso.usuario_actual)
FOTO = {"required": True,
        "content": {tipo: {"schema": {"type": "string", "format": "binary"}} for tipo in clasificacion.TIPOS}}


@router.post("/evaluar", openapi_extra={"requestBody": FOTO})
async def evaluar(request: Request, flujo: Flujo | None = None,
                  _: acceso.Usuario = Sesion) -> clasificacion.EvaluacionFoto:
    """La foto va como cuerpo (image/jpeg o image/png); el flujo que se va a entregar es opcional."""
    tipo = request.headers.get("content-type", "").split(";")[0].strip()
    foto = clasificacion.Foto(contenido=await request.body(), tipo=tipo)
    return await run_in_threadpool(clasificacion.evaluar, foto, flujo)
