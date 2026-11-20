"""API de directorio: zonas, encargados y solicitantes (alta asistida y habilitación, RN-08)."""
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.compartido.tipos import Colectivo
from app.modulos.acceso import contrato as acceso
from app.modulos.directorio import contrato as directorio

router = APIRouter(prefix="/api/directorio", tags=["directorio"])
Sesion = Depends(acceso.usuario_actual)


class NuevaZona(BaseModel):
    nombre: str = Field(min_length=2, max_length=60)


@router.get("/zonas")
def zonas(_: acceso.Usuario = Sesion) -> list[directorio.ZonaVista]:
    return directorio.zonas()


@router.post("/zonas", status_code=201)
def crear_zona(datos: NuevaZona, u: acceso.Usuario = Sesion) -> directorio.ZonaVista:
    acceso.exigir_administrador(u)
    return directorio.crear_zona(datos.nombre)


@router.get("/encargados")
def encargados(colectivo: Colectivo | None = None, u: acceso.Usuario = Sesion) -> list[directorio.EncargadoVista]:
    return directorio.encargados(acceso.colectivo_visible(u, colectivo))


@router.post("/encargados", status_code=201)
def registrar_encargado(datos: directorio.NuevoEncargado, u: acceso.Usuario = Sesion) -> directorio.EncargadoVista:
    acceso.exigir_colectivo(u, datos.colectivo)
    return directorio.registrar_encargado(datos)


@router.get("/solicitantes")
def solicitantes(estado: directorio.EstadoSolicitante | None = None,
                 _: acceso.Usuario = Sesion) -> list[directorio.SolicitanteVista]:
    return directorio.solicitantes(estado)


@router.post("/solicitantes", status_code=201)
def registrar_solicitante(datos: directorio.NuevoSolicitante,
                          _: acceso.Usuario = Sesion) -> directorio.SolicitanteVista:
    """Registro asistido desde la tablet: entra habilitado."""
    return directorio.registrar_solicitante(datos, habilitado=True)


@router.get("/solicitantes/{id}")
def solicitante(id: UUID, _: acceso.Usuario = Sesion) -> directorio.SolicitanteVista:
    return directorio.solicitante(id)


@router.post("/solicitantes/{id}/habilitacion")
def habilitar(id: UUID, _: acceso.Usuario = Sesion) -> directorio.SolicitanteVista:
    return directorio.habilitar(id)
