"""Contrato público de directorio: solicitantes, encargados y zonas."""
import re
from datetime import datetime, timezone
from enum import StrEnum
from uuid import UUID, uuid4

from pydantic import BaseModel, Field
from sqlalchemy import insert, select, update

from app.compartido.bd import transaccion
from app.compartido.eventos import Evento, publicar
from app.compartido.tipos import Colectivo, ErrorDeNegocio, NoEncontrado, TipoGenerador
from app.modulos.directorio import tablas as t

TELEFONO = r"^\+\d{8,15}$"  # E.164, como lo entrega WhatsApp
# Un nombre o alias: letras de cualquier idioma, hasta seis palabras. Sin cifras ni enlaces: llega a cada prompt.
NOMBRE = re.compile(r"[^\W\d_]+(?:[ '.-][^\W\d_]+){0,5}")


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


class CambioEncargado(BaseModel):
    """Edición desde la tablet: un encargado inactivo sale de las sugerencias y conserva su historial."""

    nombre: str = Field(min_length=2, max_length=60)
    zonas: list[UUID] = []
    activo: bool = True


class SolicitanteHabilitado(Evento):
    solicitante_id: UUID


def registrar_solicitante(nuevo: NuevoSolicitante, habilitado: bool) -> SolicitanteVista:
    """Por WhatsApp entra PENDIENTE; por registro asistido o lista piloto de la fundación, habilitado (RN-08)."""
    if not nuevo.autoriza_datos:
        raise ErrorDeNegocio("Sin autorización de datos no se puede registrar (Ley 1581).")
    with transaccion() as c:
        if solicitante_por_telefono(nuevo.telefono):
            raise ErrorDeNegocio("Ese número ya está registrado.")
        zona(nuevo.zona_id)
        solicitante_nuevo = SolicitanteVista(
            id=uuid4(),
            estado=EstadoSolicitante.HABILITADO if habilitado else EstadoSolicitante.PENDIENTE,
            autorizo_en=datetime.now(timezone.utc),
            **nuevo.model_dump(exclude={"autoriza_datos"}),
        )
        c.execute(insert(t.solicitantes).values(solicitante_nuevo.model_dump()))
        return solicitante_nuevo


def habilitar(id: UUID) -> SolicitanteVista:
    with transaccion() as c:
        actual = solicitante(id)
        if actual.estado != EstadoSolicitante.HABILITADO:
            c.execute(update(t.solicitantes).where(t.solicitantes.c.id == id)
                      .values(estado=EstadoSolicitante.HABILITADO))
            actual.estado = EstadoSolicitante.HABILITADO
            publicar(SolicitanteHabilitado(solicitante_id=id))
        return actual


def nombre_valido(nombre: str) -> str | None:
    """El nombre sin espacios de más, o None si no parece un nombre o alias de 2 a 40 caracteres."""
    limpio = " ".join(nombre.split())
    return limpio if 2 <= len(limpio) <= 40 and NOMBRE.fullmatch(limpio) else None


def cambiar_nombre(id: UUID, nombre: str) -> SolicitanteVista:
    """El vecino cambia por WhatsApp cómo lo llaman; el resto de su registro lo edita la coordinación."""
    limpio = nombre_valido(nombre)
    if limpio is None:
        raise ErrorDeNegocio("El nombre debe tener solo letras, entre 2 y 40 caracteres.")
    with transaccion() as c:
        actual = solicitante(id)
        c.execute(update(t.solicitantes).where(t.solicitantes.c.id == id).values(nombre=limpio))
    return actual.model_copy(update={"nombre": limpio})


def solicitante(id: UUID) -> SolicitanteVista:
    return (_uno(select(t.solicitantes).where(t.solicitantes.c.id == id), SolicitanteVista)
            or _no_existe("el solicitante", id))


def solicitante_por_telefono(telefono: str) -> SolicitanteVista | None:
    return _uno(select(t.solicitantes).where(t.solicitantes.c.telefono == telefono), SolicitanteVista)


def solicitantes(estado: EstadoSolicitante | None = None) -> list[SolicitanteVista]:
    consulta = select(t.solicitantes).order_by(t.solicitantes.c.autorizo_en)
    if estado is not None:
        consulta = consulta.where(t.solicitantes.c.estado == estado)
    return _todos(consulta, SolicitanteVista)


def crear_zona(nombre: str) -> ZonaVista:
    nueva = ZonaVista(id=uuid4(), nombre=nombre)
    with transaccion() as c:
        c.execute(insert(t.zonas).values(nueva.model_dump()))
    return nueva


def zonas() -> list[ZonaVista]:
    return _todos(select(t.zonas).order_by(t.zonas.c.nombre), ZonaVista)


def zona(id: UUID) -> ZonaVista:
    return _uno(select(t.zonas).where(t.zonas.c.id == id), ZonaVista) or _no_existe("la zona", id)


def registrar_encargado(nuevo: NuevoEncargado) -> EncargadoVista:
    for id_zona in nuevo.zonas:
        zona(id_zona)
    encargado_nuevo = EncargadoVista(id=uuid4(), **nuevo.model_dump())
    with transaccion() as c:
        c.execute(insert(t.encargados).values({**encargado_nuevo.model_dump(),
                                               "zonas": [str(z) for z in encargado_nuevo.zonas]}))
    return encargado_nuevo


def actualizar_encargado(id: UUID, cambio: CambioEncargado) -> EncargadoVista:
    actual = encargado(id)
    for id_zona in cambio.zonas:
        zona(id_zona)
    nuevo = actual.model_copy(update=cambio.model_dump())
    with transaccion() as c:
        c.execute(update(t.encargados).where(t.encargados.c.id == id).values(
            nombre=nuevo.nombre, zonas=[str(z) for z in nuevo.zonas], activo=nuevo.activo))
    return nuevo


def encargado(id: UUID) -> EncargadoVista:
    return _uno(select(t.encargados).where(t.encargados.c.id == id), EncargadoVista) or _no_existe("el encargado", id)


def encargados(colectivo: Colectivo | None = None) -> list[EncargadoVista]:
    consulta = select(t.encargados).order_by(t.encargados.c.nombre)
    if colectivo is not None:
        consulta = consulta.where(t.encargados.c.colectivo == colectivo)
    return _todos(consulta, EncargadoVista)


def sugerir_encargados(colectivo: Colectivo, zona_id: UUID) -> list[EncargadoVista]:
    """Solo sugiere: asigna el coordinador (§9). Primero quienes cubren la zona."""
    return sorted((e for e in encargados(colectivo) if e.activo), key=lambda e: zona_id not in e.zonas)


def _uno(consulta, modelo):
    with transaccion() as c:
        fila = c.execute(consulta).first()
    return modelo.model_validate(dict(fila._mapping)) if fila else None


def _todos(consulta, modelo) -> list:
    with transaccion() as c:
        return [modelo.model_validate(dict(fila._mapping)) for fila in c.execute(consulta).all()]


def _no_existe(que: str, id: UUID):
    raise NoEncontrado(f"No existe {que} {id}.")
