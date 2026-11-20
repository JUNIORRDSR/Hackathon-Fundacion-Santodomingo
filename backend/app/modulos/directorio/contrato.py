"""Contrato público de directorio: solicitantes, encargados y zonas."""
from datetime import datetime, timezone
from enum import StrEnum
from uuid import UUID, uuid4

from pydantic import BaseModel, Field

from app.compartido.eventos import Evento, publicar
from app.compartido.tipos import Colectivo, ErrorDeNegocio, NoEncontrado, TipoGenerador

TELEFONO = r"^\+\d{8,15}$"  # E.164, como lo entrega WhatsApp


class EstadoSolicitante(StrEnum):
    PENDIENTE = "pendiente"  # se registró solo por WhatsApp; falta habilitarlo (RN-08)
    HABILITADO = "habilitado"


class NuevoSolicitante(BaseModel):
    """Solo los datos necesarios para atender (§5.1): nada de cédula, correo ni edad."""

    telefono: str = Field(pattern=TELEFONO)
    nombre: str = Field(min_length=2, max_length=60)  # nombre o alias
    tipo: TipoGenerador
    zona_id: UUID
    direccion: str = Field(min_length=3, max_length=120)  # torre y apartamento, o nombre y dirección del negocio
    autoriza_datos: bool  # Ley 1581: sin autorización no se registra


class SolicitanteVista(BaseModel):
    id: UUID
    telefono: str
    nombre: str
    tipo: TipoGenerador
    zona_id: UUID
    direccion: str
    estado: EstadoSolicitante
    autorizo_en: datetime


class ZonaVista(BaseModel):
    id: UUID
    nombre: str


class NuevoEncargado(BaseModel):
    nombre: str = Field(min_length=2, max_length=60)
    colectivo: Colectivo
    zonas: list[UUID] = []


class EncargadoVista(NuevoEncargado):
    id: UUID
    activo: bool = True


class SolicitanteHabilitado(Evento):
    solicitante_id: UUID


# ponytail: en memoria hasta que entre Postgres.
_zonas: dict[UUID, ZonaVista] = {}
_solicitantes: dict[UUID, SolicitanteVista] = {}
_encargados: dict[UUID, EncargadoVista] = {}


def registrar_solicitante(nuevo: NuevoSolicitante, habilitado: bool) -> SolicitanteVista:
    """Por WhatsApp entra PENDIENTE; por registro asistido o lista piloto de la fundación, habilitado (RN-08)."""
    if not nuevo.autoriza_datos:
        raise ErrorDeNegocio("Sin autorización de datos no se puede registrar (Ley 1581).")
    if solicitante_por_telefono(nuevo.telefono):
        raise ErrorDeNegocio("Ese número ya está registrado.")
    zona(nuevo.zona_id)
    solicitante = SolicitanteVista(
        id=uuid4(),
        estado=EstadoSolicitante.HABILITADO if habilitado else EstadoSolicitante.PENDIENTE,
        autorizo_en=datetime.now(timezone.utc),
        **nuevo.model_dump(exclude={"autoriza_datos"}),
    )
    _solicitantes[solicitante.id] = solicitante
    return solicitante.model_copy()


def habilitar(id: UUID) -> SolicitanteVista:
    solicitante = _solicitantes.get(id) or _no_existe("el solicitante", id)
    if solicitante.estado != EstadoSolicitante.HABILITADO:
        solicitante.estado = EstadoSolicitante.HABILITADO
        publicar(SolicitanteHabilitado(solicitante_id=id))
    return solicitante.model_copy()


def solicitante(id: UUID) -> SolicitanteVista:
    return (_solicitantes.get(id) or _no_existe("el solicitante", id)).model_copy()


def solicitante_por_telefono(telefono: str) -> SolicitanteVista | None:
    return next((s.model_copy() for s in _solicitantes.values() if s.telefono == telefono), None)


def solicitantes(estado: EstadoSolicitante | None = None) -> list[SolicitanteVista]:
    return [s.model_copy() for s in _solicitantes.values() if estado is None or s.estado == estado]


def crear_zona(nombre: str) -> ZonaVista:
    nueva = ZonaVista(id=uuid4(), nombre=nombre)
    _zonas[nueva.id] = nueva
    return nueva


def zonas() -> list[ZonaVista]:
    return list(_zonas.values())


def zona(id: UUID) -> ZonaVista:
    return _zonas.get(id) or _no_existe("la zona", id)


def registrar_encargado(nuevo: NuevoEncargado) -> EncargadoVista:
    for id_zona in nuevo.zonas:
        zona(id_zona)
    encargado_nuevo = EncargadoVista(id=uuid4(), **nuevo.model_dump())
    _encargados[encargado_nuevo.id] = encargado_nuevo
    return encargado_nuevo


def encargado(id: UUID) -> EncargadoVista:
    return _encargados.get(id) or _no_existe("el encargado", id)


def encargados(colectivo: Colectivo | None = None) -> list[EncargadoVista]:
    return [e for e in _encargados.values() if colectivo is None or e.colectivo == colectivo]


def sugerir_encargados(colectivo: Colectivo, zona_id: UUID) -> list[EncargadoVista]:
    """Solo sugiere: asigna el coordinador (§9). Primero quienes cubren la zona."""
    return sorted((e for e in encargados(colectivo) if e.activo), key=lambda e: zona_id not in e.zonas)


def _no_existe(que: str, id: UUID):
    raise NoEncontrado(f"No existe {que} {id}.")
