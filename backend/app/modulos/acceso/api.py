"""API de sesión, registro y configuración de cuentas."""
import hmac
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response
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
    cuenta = acceso.autenticar(datos.usuario, datos.clave)
    if cuenta is None:
        raise HTTPException(401, "Usuario o clave incorrectos.")
    usuario, version = cuenta
    _iniciar_sesion(request, usuario, version)
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
    _iniciar_sesion(request, usuario)
    return usuario


def _iniciar_sesion(request: Request, usuario: acceso.Usuario, version: int = 0) -> None:
    request.session["usuario"] = {"id": str(usuario.id), "version": version}


@router.post("/salir", status_code=204)
def salir(request: Request) -> None:
    request.session.clear()


@router.get("/yo")
def yo(request: Request, response: Response) -> acceso.Usuario | None:
    """Sin sesión responde null, no 401: abrir la pantalla de entrar no es un error."""
    response.headers["Cache-Control"] = "no-store"
    try:
        return acceso.usuario_actual(request)
    except HTTPException:
        return None


@router.post("/usuarios", status_code=201)
def crear_usuario(datos: acceso.NuevoUsuario, request: Request) -> acceso.Usuario:
    with acceso.administrar(request):
        return acceso.crear_usuario(datos)


@router.get("/usuarios", dependencies=[Depends(acceso.administrador_actual)])
def listar_usuarios(response: Response) -> list[acceso.Usuario]:
    response.headers["Cache-Control"] = "no-store"
    return acceso.listar_usuarios()


@router.put("/usuarios/{id_usuario}")
def editar_usuario(id_usuario: UUID, datos: acceso.ConfiguracionUsuario, request: Request) -> acceso.Usuario:
    with acceso.administrar(request) as admin:
        return acceso.editar_usuario(admin, id_usuario, datos)


@router.put("/yo")
def editar_perfil(datos: acceso.Perfil, request: Request) -> acceso.Usuario:
    with acceso.administrar(request) as admin:
        return acceso.editar_perfil(admin.id, datos)


class NuevaClave(BaseModel):
    clave: str


class CambioDeClave(NuevaClave):
    actual: str


@router.put("/usuarios/{id_usuario}/clave", status_code=204)
def restablecer_clave(id_usuario: UUID, datos: NuevaClave, request: Request) -> None:
    with acceso.administrar(request) as admin:
        acceso.restablecer_clave(admin, id_usuario, datos.clave)


@router.put("/yo/clave", status_code=204)
def cambiar_mi_clave(datos: CambioDeClave, request: Request) -> None:
    with acceso.administrar(request) as admin:
        acceso.cambiar_mi_clave(admin, datos.actual, datos.clave)
    request.session.clear()
