"""Lugares del barrio en dos niveles, zona y conjunto (ADR-0017)."""
from collections import defaultdict
from collections.abc import Callable
from typing import Annotated
from uuid import UUID, uuid4

from pydantic import BaseModel, StringConstraints
from sqlalchemy import delete, insert, select, update
from sqlalchemy.exc import IntegrityError

from app.compartido.bd import transaccion
from app.compartido.tipos import ErrorDeNegocio, NoEncontrado
from app.modulos.directorio import tablas as t


class NuevoLugar(BaseModel):
    nombre: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=60)]


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
    try:
        with transaccion() as c:
            consulta = update(t.conjuntos).where(t.conjuntos.c.id == id).values(**cambio.model_dump())
            fila = c.execute(consulta.returning(t.conjuntos)).mappings().one_or_none()
    except IntegrityError as error:
        if getattr(error.orig, "sqlstate", None) != "23505":
            raise
        raise ErrorDeNegocio("Esa zona ya tiene un conjunto con ese nombre.") from error
    return ConjuntoVista.model_validate(fila) if fila else _no_existe("el conjunto", id)


def eliminar_conjunto(id: UUID, tiene_historial: Callable[[UUID], bool]) -> None:
    with transaccion() as c:
        lugar = select(t.conjuntos.c.id).where(t.conjuntos.c.id == id)
        if c.scalar(lugar.with_for_update()) is None:
            _no_existe("el conjunto", id)
        uso = _uso_del_conjunto(c, id)
        if uso is None and tiene_historial(id):
            uso = "solicitudes en el historial"
        if uso:
            raise ErrorDeNegocio(f"Este lugar tiene {uso}. Puedes desactivarlo desde Editar.")
        c.execute(delete(t.conjuntos).where(t.conjuntos.c.id == id))


def _uso_del_conjunto(c, id: UUID) -> str | None:
    referencias = (
        ("vecinos registrados", t.solicitantes.c.conjunto_id == id),
        ("rutas asociadas", t.rutas_recoleccion.c.conjunto_id == id),
        ("encargados asignados", t.encargados.c.lugares.contains([str(id)])),
    )
    return next((uso for uso, condicion in referencias if c.scalar(select(select(1).where(condicion).exists()))), None)


def reservar_conjunto(id: UUID) -> bool:
    """Mantiene el conjunto hasta que se guarde la referencia en esta transacción."""
    with transaccion() as c:
        consulta = select(t.conjuntos.c.id).where(t.conjuntos.c.id == id).with_for_update(read=True, key_share=True)
        return c.scalar(consulta) is not None


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
    if conjunto_id is not None and (all(c.id != conjunto_id for c in actual.conjuntos)
                                    or not reservar_conjunto(conjunto_id)):
        raise ErrorDeNegocio("Ese conjunto no es de la zona elegida.")


def existe_lugar(id: UUID) -> bool:
    with transaccion() as c:
        return c.scalar(select(t.zonas.c.id).where(t.zonas.c.id == id)) is not None or reservar_conjunto(id)


def _sin_repetir(c, consulta, mensaje: str) -> None:
    if c.execute(consulta).first():
        raise ErrorDeNegocio(mensaje)


def _no_existe(que: str, id: UUID):
    raise NoEncontrado(f"No existe {que} {id}.")
