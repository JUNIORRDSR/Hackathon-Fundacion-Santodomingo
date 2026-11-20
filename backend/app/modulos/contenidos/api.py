"""API de contenidos: los ve cualquier sesión; los crea y edita el administrador (§4)."""
from uuid import UUID

from fastapi import APIRouter, Depends

from app.compartido.tipos import Flujo
from app.modulos.acceso import contrato as acceso
from app.modulos.contenidos import contrato as contenidos

router = APIRouter(prefix="/api/contenidos", tags=["contenidos"])
Sesion = Depends(acceso.usuario_actual)


@router.get("/publicos")
def publicos() -> list[contenidos.ContenidoVista]:
    """Capacitación pública, sin sesión: la vista abierta del frontend la lee de aquí."""
    return contenidos.capacitacion_publica()


@router.get("")
def listar(audiencia: contenidos.Audiencia | None = None, flujo: Flujo | None = None,
           proposito: contenidos.Proposito | None = None,
           _: acceso.Usuario = Sesion) -> list[contenidos.ContenidoVista]:
    return contenidos.listar(audiencia, flujo, proposito)


@router.post("", status_code=201)
def crear(datos: contenidos.NuevoContenido, u: acceso.Usuario = Sesion) -> contenidos.ContenidoVista:
    acceso.exigir_administrador(u)
    return contenidos.crear(datos)


@router.put("/{id}")
def actualizar(id: UUID, datos: contenidos.NuevoContenido, u: acceso.Usuario = Sesion) -> contenidos.ContenidoVista:
    acceso.exigir_administrador(u)
    return contenidos.actualizar(id, datos)
