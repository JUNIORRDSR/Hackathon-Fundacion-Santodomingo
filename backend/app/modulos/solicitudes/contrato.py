"""Contrato público de solicitudes, el núcleo. Lo único que otros módulos y la API pueden importar (ADR-0001)."""
from dataclasses import asdict
from datetime import date, datetime, time
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field

from app.compartido.eventos import Evento, publicar
from app.compartido.formato import NOMBRE_FLUJO
from app.compartido.tipos import COLECTIVO_DEL_FLUJO, Canal, Colectivo, ErrorDeNegocio, Flujo, Franja, NoEncontrado
from app.modulos.directorio import contrato as directorio
from app.modulos.solicitudes.dominio import ABIERTOS, PREFIJO, Estado, Solicitud


class NuevaSolicitud(BaseModel):
    solicitante_id: UUID
    flujo: Flujo
    preferencia: Franja
    observaciones: str = Field("", max_length=500)
    canal: Canal


class CambioVista(BaseModel):
    fecha: datetime
    estado: Estado
    por: str
    nota: str


class SolicitudVista(BaseModel):
    """Contacto y dirección solo llegan a quien atiende: la API filtra por colectivo (RN-07)."""

    id: UUID
    codigo: str
    estado: Estado
    flujo: Flujo
    colectivo: Colectivo
    canal: Canal
    solicitante_id: UUID
    solicitante_nombre: str
    telefono: str
    zona_id: UUID
    direccion: str
    preferencia: Franja
    observaciones: str
    encargado_id: UUID | None
    asignada_por: UUID | None
    dia: date | None
    hora: time | None
    kg: Decimal | None
    motivo: str
    recibida: datetime
    historial: list[CambioVista]


class EventoDeSolicitud(Evento):
    solicitud_id: UUID
    codigo: str
    solicitante_id: UUID
    flujo: Flujo


class SolicitudRecibida(EventoDeSolicitud):
    pass


class SolicitudProgramada(EventoDeSolicitud):
    encargado_id: UUID
    dia: date
    hora: time


class RecoleccionRegistrada(EventoDeSolicitud):
    """La escucha puntos: es la única fuente de puntos (RN-05)."""

    kg: Decimal | None


class SolicitudRechazada(EventoDeSolicitud):
    motivo: str


class SolicitudCancelada(EventoDeSolicitud):
    motivo: str


# ponytail: en memoria hasta que entre Postgres (tabla en su esquema e índice único parcial para «una abierta por flujo»).
_solicitudes: dict[UUID, Solicitud] = {}
_consecutivo = {flujo: 0 for flujo in Flujo}


def registrar(nueva: NuevaSolicitud, por: str = "solicitante") -> SolicitudVista:
    """Entrada única para WhatsApp, el registro asistido y el simulador (ADR-0003)."""
    solicitante = directorio.solicitante(nueva.solicitante_id)
    if solicitante.estado != directorio.EstadoSolicitante.HABILITADO:
        raise ErrorDeNegocio("El solicitante todavía no está habilitado en el piloto (RN-08).")
    abierta = next((s for s in _solicitudes.values() if s.solicitante_id == nueva.solicitante_id
                    and s.flujo == nueva.flujo and s.estado in ABIERTOS), None)
    if abierta:
        raise ErrorDeNegocio(f"Ya hay una solicitud abierta de {NOMBRE_FLUJO[nueva.flujo]}: {abierta.codigo}.")
    _consecutivo[nueva.flujo] += 1
    solicitud = Solicitud.recibir(
        por,
        codigo=f"{PREFIJO[nueva.flujo]}-{_consecutivo[nueva.flujo]:04d}",
        zona_id=solicitante.zona_id,
        direccion=solicitante.direccion,
        **nueva.model_dump(),
    )
    _solicitudes[solicitud.id] = solicitud
    publicar(SolicitudRecibida(**_ids(solicitud)))
    return _vista(solicitud)


def asignar(id: UUID, encargado_id: UUID, por: UUID) -> SolicitudVista:
    solicitud = _obtener(id)
    if directorio.encargado(encargado_id).colectivo != COLECTIVO_DEL_FLUJO[solicitud.flujo]:
        raise ErrorDeNegocio("Ese encargado no es del colectivo de la solicitud (RN-01).")
    solicitud.asignar(encargado_id, por)
    return _vista(solicitud)


def programar(id: UUID, dia: date, hora: time, por: UUID) -> SolicitudVista:
    solicitud = _obtener(id)
    solicitud.programar(dia, hora, por)
    publicar(SolicitudProgramada(**_ids(solicitud), encargado_id=solicitud.encargado_id, dia=dia, hora=hora))
    return _vista(solicitud)


def registrar_recoleccion(id: UUID, kg: Decimal | None, por: UUID) -> SolicitudVista:
    solicitud = _obtener(id)
    solicitud.registrar_recoleccion(kg, por)
    publicar(RecoleccionRegistrada(**_ids(solicitud), kg=kg))
    return _vista(solicitud)


def rechazar(id: UUID, motivo: str, por: UUID) -> SolicitudVista:
    solicitud = _obtener(id)
    solicitud.rechazar(motivo, por)
    publicar(SolicitudRechazada(**_ids(solicitud), motivo=solicitud.motivo))
    return _vista(solicitud)


def cancelar(id: UUID, motivo: str, por: str) -> SolicitudVista:
    solicitud = _obtener(id)
    solicitud.cancelar(motivo, por)
    publicar(SolicitudCancelada(**_ids(solicitud), motivo=solicitud.motivo))
    return _vista(solicitud)


def obtener(id: UUID) -> SolicitudVista:
    return _vista(_obtener(id))


def por_codigo(codigo: str) -> SolicitudVista:
    solicitud = next((s for s in _solicitudes.values() if s.codigo == codigo.strip().upper()), None)
    if solicitud is None:
        raise NoEncontrado(f"No existe la solicitud {codigo}.")
    return _vista(solicitud)


def bandeja(colectivo: Colectivo | None = None, estados: set[Estado] | None = None) -> list[SolicitudVista]:
    """Solicitudes de un colectivo, las más nuevas primero (RN-01). Sin colectivo: todas (administrador y reportes)."""
    return _vistas(s for s in _solicitudes.values()
                   if (colectivo is None or COLECTIVO_DEL_FLUJO[s.flujo] == colectivo)
                   and (not estados or s.estado in estados))


def de_solicitante(solicitante_id: UUID) -> list[SolicitudVista]:
    return _vistas(s for s in _solicitudes.values() if s.solicitante_id == solicitante_id)


def _obtener(id: UUID) -> Solicitud:
    if id not in _solicitudes:
        raise NoEncontrado(f"No existe la solicitud {id}.")
    return _solicitudes[id]


def _ids(s: Solicitud) -> dict:
    return {"solicitud_id": s.id, "codigo": s.codigo, "solicitante_id": s.solicitante_id, "flujo": s.flujo}


def _vistas(solicitudes) -> list[SolicitudVista]:
    return [_vista(s) for s in sorted(solicitudes, key=lambda s: s.historial[0].fecha, reverse=True)]


def _vista(s: Solicitud) -> SolicitudVista:
    solicitante = directorio.solicitante(s.solicitante_id)
    return SolicitudVista(**asdict(s), colectivo=COLECTIVO_DEL_FLUJO[s.flujo], solicitante_nombre=solicitante.nombre,
                          telefono=solicitante.telefono, recibida=s.historial[0].fecha)
