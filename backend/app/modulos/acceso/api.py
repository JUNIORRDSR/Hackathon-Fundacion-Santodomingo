"""API de acceso: entrar, salir, crear usuarios (administrador) y registrarse con el código de la fundación."""
import hmac

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from app.compartido.configuracion import variable
from app.compartido.tipos import Colectivo

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


class Registro(BaseModel):
    nombre: str = Field(min_length=2, max_length=80)
    usuario: str = Field(min_length=3, max_length=40)
    colectivo: Colectivo
    clave: str = Field(min_length=8, max_length=128)
    codigo: str


@router.post("/registro", status_code=201)
def registrarse(datos: Registro, request: Request) -> acceso.Usuario:
    """Crea la cuenta de un coordinador y entra. Solo con el código que reparte la fundación (ADR-0009)."""
    if not hmac.compare_digest(datos.codigo.strip(), variable("CODIGO_REGISTRO", "villas-2026")):
        raise HTTPException(403, "El código de la fundación no es válido. Pídelo a la administración.")
    usuario = acceso.crear_usuario(acceso.NuevoUsuario(usuario=datos.usuario.strip().lower(), nombre=datos.nombre,
                                                        rol=acceso.Rol.COORDINADOR, colectivo=datos.colectivo,
                                                        clave=datos.clave))
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
