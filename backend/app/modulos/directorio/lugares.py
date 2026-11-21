"""Lugares del barrio en dos niveles, zona y conjunto (ADR-0014). Nada se borra: se desactiva, por el historial."""
from collections import defaultdict
from uuid import UUID, uuid4

from pydantic import BaseModel, Field
from sqlalchemy import insert, select, update

from app.compartido.bd import transaccion
from app.compartido.tipos import ErrorDeNegocio, NoEncontrado
from app.modulos.directorio import tablas as t


class NuevoLugar(BaseModel):
    nombre: str = Field(min_length=2, max_length=60)


class CambioLugar(NuevoLugar):
    activo: bool = True


class ConjuntoVista(BaseModel):
    id: UUID
    zona_id: UUID
    nombre: str
    activo: bool = True


class ZonaVista(BaseModel):
    id: UUID
    nombre: str
    activo: bool = True
    conjuntos: list[ConjuntoVista] = []


class Lugar(BaseModel):
    """Una opción para ubicar a un vecino: un conjunto, o una zona que no tiene conjuntos."""

    nombre: str
    zona: str
    zona_id: UUID
    conjunto_id: UUID | None = None


def crear_zona(nombre: str) -> ZonaVista:
    nueva = ZonaVista(id=uuid4(), nombre=nombre.strip())
    with transaccion() as c:
        _sin_repetir(c, select(t.zonas.c.id).where(t.zonas.c.nombre == nueva.nombre),
                     "Ya existe una zona con ese nombre.")
        c.execute(insert(t.zonas).values(id=nueva.id, nombre=nueva.nombre, activo=True))
    return nueva


def cambiar_zona(id: UUID, cambio: CambioLugar) -> ZonaVista:
    zona(id)
    with transaccion() as c:
        c.execute(update(t.zonas).where(t.zonas.c.id == id).values(nombre=cambio.nombre.strip(), activo=cambio.activo))
    return zona(id)


def crear_conjunto(zona_id: UUID, nombre: str) -> ConjuntoVista:
    zona(zona_id)
    nuevo = ConjuntoVista(id=uuid4(), zona_id=zona_id, nombre=nombre.strip())
    with transaccion() as c:
        _sin_repetir(c, select(t.conjuntos.c.id).where(t.conjuntos.c.zona_id == zona_id,
                                                       t.conjuntos.c.nombre == nuevo.nombre),
                     "Esa zona ya tiene un conjunto con ese nombre.")
        c.execute(insert(t.conjuntos).values(nuevo.model_dump()))
    return nuevo


def cambiar_conjunto(id: UUID, cambio: CambioLugar) -> ConjuntoVista:
    conjunto(id)
    with transaccion() as c:
        c.execute(update(t.conjuntos).where(t.conjuntos.c.id == id)
                  .values(nombre=cambio.nombre.strip(), activo=cambio.activo))
    return conjunto(id)


def zonas() -> list[ZonaVista]:
    """Las zonas con sus conjuntos, por nombre; también las desactivadas, que el historial todavía nombra."""
    with transaccion() as c:
        filas_zonas = c.execute(select(t.zonas).order_by(t.zonas.c.nombre)).all()
        filas_conjuntos = c.execute(select(t.conjuntos).order_by(t.conjuntos.c.nombre)).all()
    por_zona = defaultdict(list)
    for fila in filas_conjuntos:
        por_zona[fila.zona_id].append(ConjuntoVista.model_validate(dict(fila._mapping)))
    return [ZonaVista(**dict(fila._mapping), conjuntos=por_zona[fila.id]) for fila in filas_zonas]


def zona(id: UUID) -> ZonaVista:
    return next((z for z in zonas() if z.id == id), None) or _no_existe("la zona", id)


def conjunto(id: UUID) -> ConjuntoVista:
    with transaccion() as c:
        fila = c.execute(select(t.conjuntos).where(t.conjuntos.c.id == id)).first()
    return ConjuntoVista.model_validate(dict(fila._mapping)) if fila else _no_existe("el conjunto", id)


def lugares_para_elegir() -> list[Lugar]:
    """Lo que elige el vecino: los conjuntos activos y las zonas activas que no tienen conjuntos activos."""
    lugares = []
    for z in (z for z in zonas() if z.activo):
        activos = [Lugar(nombre=c.nombre, zona=z.nombre, zona_id=z.id, conjunto_id=c.id)
                   for c in z.conjuntos if c.activo]
        lugares += activos or [Lugar(nombre=z.nombre, zona=z.nombre, zona_id=z.id)]
    return lugares


def validar_lugar(zona_id: UUID, conjunto_id: UUID | None) -> None:
    """El lugar de un vecino es un conjunto de su zona, o la zona sola si no tiene conjuntos."""
    actual = zona(zona_id)
    if conjunto_id is None and any(c.activo for c in actual.conjuntos):
        raise ErrorDeNegocio(f"Elige el conjunto o sector de {actual.nombre}.")
    if conjunto_id is not None and all(c.id != conjunto_id for c in actual.conjuntos):
        raise ErrorDeNegocio("Ese conjunto no es de la zona elegida.")


def existe_lugar(id: UUID) -> bool:
    return any(z.id == id or any(c.id == id for c in z.conjuntos) for z in zonas())


def _sin_repetir(c, consulta, mensaje: str) -> None:
    if c.execute(consulta).first():
        raise ErrorDeNegocio(mensaje)


def _no_existe(que: str, id: UUID):
    raise NoEncontrado(f"No existe {que} {id}.")
