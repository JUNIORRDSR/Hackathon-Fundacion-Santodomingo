"""API de puntos: regla vigente (la cambia el administrador) y saldo de un solicitante."""
from uuid import UUID

from fastapi import APIRouter, Depends

from app.modulos.acceso import contrato as acceso
from app.modulos.puntos import contrato as puntos

router = APIRouter(prefix="/api/puntos", tags=["puntos"])
Sesion = Depends(acceso.usuario_actual)


@router.get("/regla")
def regla(_: acceso.Usuario = Sesion) -> puntos.ReglaVista:
    return puntos.regla_vigente()


@router.put("/regla")
def cambiar_regla(datos: puntos.NuevaRegla, u: acceso.Usuario = Sesion) -> puntos.ReglaVista:
    acceso.exigir_administrador(u)
    return puntos.cambiar_regla(datos)


@router.get("/solicitantes/{solicitante_id}")
def saldo(solicitante_id: UUID, _: acceso.Usuario = Sesion) -> puntos.Saldo:
    return puntos.saldo(solicitante_id)
