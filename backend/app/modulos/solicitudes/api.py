"""API de solicitudes para la tablet. Cada coordinador ve solo su colectivo (RN-01, RN-07)."""
from datetime import date, time
from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.compartido.tipos import Canal, Colectivo, Flujo, Franja
from app.modulos.acceso import contrato as acceso
from app.modulos.directorio import contrato as directorio
from app.modulos.solicitudes import contrato as solicitudes

router = APIRouter(prefix="/api/solicitudes", tags=["solicitudes"])
Sesion = Depends(acceso.usuario_actual)


class Asistida(BaseModel):
    solicitante_id: UUID
    flujo: Flujo
    preferencia: Franja
    observaciones: str = Field("", max_length=500)


class Asignacion(BaseModel):
    encargado_id: UUID


class Programacion(BaseModel):
    dia: date
    hora: time


class Recoleccion(BaseModel):
    kg: Decimal | None = Field(None, gt=0, max_digits=6, decimal_places=2)


class Motivo(BaseModel):
    motivo: str = Field(min_length=3, max_length=300)


@router.get("")
def bandeja(estado: solicitudes.Estado | None = None, colectivo: Colectivo | None = None,
            u: acceso.Usuario = Sesion) -> list[solicitudes.SolicitudVista]:
    return solicitudes.bandeja(acceso.colectivo_visible(u, colectivo), {estado} if estado else None)


@router.post("", status_code=201)
def registrar_asistida(datos: Asistida, u: acceso.Usuario = Sesion) -> solicitudes.SolicitudVista:
    """Registro asistido: para quien llama o llega en persona. Cae en la bandeja de su flujo (ADR-0003)."""
    nueva = solicitudes.NuevaSolicitud(**datos.model_dump(), canal=Canal.ASISTIDO)
    return solicitudes.registrar(nueva, por=str(u.id))


@router.get("/{id}")
def detalle(id: UUID, u: acceso.Usuario = Sesion) -> solicitudes.SolicitudVista:
    return _visible(id, u)


@router.get("/{id}/sugerencias")
def sugerencias(id: UUID, u: acceso.Usuario = Sesion) -> list[directorio.EncargadoVista]:
    """Encargados del colectivo; primero los que cubren la zona. Solo sugiere: asigna el coordinador (§9)."""
    solicitud = _visible(id, u)
    return directorio.sugerir_encargados(solicitud.colectivo, solicitud.zona_id)


@router.post("/{id}/asignacion")
def asignar(id: UUID, datos: Asignacion, u: acceso.Usuario = Sesion) -> solicitudes.SolicitudVista:
    _visible(id, u)
    return solicitudes.asignar(id, datos.encargado_id, u.id)


@router.post("/{id}/programacion")
def programar(id: UUID, datos: Programacion, u: acceso.Usuario = Sesion) -> solicitudes.SolicitudVista:
    _visible(id, u)
    return solicitudes.programar(id, datos.dia, datos.hora, u.id)


@router.post("/{id}/recoleccion")
def registrar_recoleccion(id: UUID, datos: Recoleccion, u: acceso.Usuario = Sesion) -> solicitudes.SolicitudVista:
    _visible(id, u)
    return solicitudes.registrar_recoleccion(id, datos.kg, u.id)


@router.post("/{id}/rechazo")
def rechazar(id: UUID, datos: Motivo, u: acceso.Usuario = Sesion) -> solicitudes.SolicitudVista:
    _visible(id, u)
    return solicitudes.rechazar(id, datos.motivo, u.id)


@router.post("/{id}/cancelacion")
def cancelar(id: UUID, datos: Motivo, u: acceso.Usuario = Sesion) -> solicitudes.SolicitudVista:
    _visible(id, u)
    return solicitudes.cancelar(id, datos.motivo, str(u.id))


def _visible(id: UUID, u: acceso.Usuario) -> solicitudes.SolicitudVista:
    solicitud = solicitudes.obtener(id)
    acceso.exigir_colectivo(u, solicitud.colectivo)
    return solicitud
