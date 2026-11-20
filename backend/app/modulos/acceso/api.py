"""API de acceso: entrar, salir y crear usuarios (administrador)."""
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.modulos.acceso import contrato as acceso

router = APIRouter(prefix="/api/acceso", tags=["acceso"])


class Credenciales(BaseModel):
    usuario: str
    clave: str


@router.post("/entrar")
def entrar(datos: Credenciales, request: Request) -> acceso.Usuario:
    usuario = acceso.autenticar(datos.usuario, datos.clave)
    if usuario is None:
        raise HTTPException(401, "Usuario o clave incorrectos.")
    request.session["usuario"] = usuario.model_dump(mode="json")
    return usuario


@router.post("/salir", status_code=204)
def salir(request: Request) -> None:
    request.session.clear()


@router.get("/yo")
def yo(u: acceso.Usuario = Depends(acceso.usuario_actual)) -> acceso.Usuario:
    return u


@router.post("/usuarios", status_code=201)
def crear_usuario(datos: acceso.NuevoUsuario, u: acceso.Usuario = Depends(acceso.usuario_actual)) -> acceso.Usuario:
    acceso.exigir_administrador(u)
    return acceso.crear_usuario(datos)
