"""Contrato público de puntos: regla con versión y libro de movimientos que solo crece (RN-05, RN-06)."""
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from pydantic import BaseModel

from app.compartido.eventos import Evento, publicar, suscribir
from app.compartido.tipos import ErrorDeNegocio, Flujo
from app.modulos.puntos.dominio import Regla
from app.modulos.solicitudes import contrato as solicitudes


class ReglaVista(BaseModel):
    version: int
    base: dict[Flujo, int]
    por_kg: dict[Flujo, Decimal]


class NuevaRegla(BaseModel):
    base: dict[Flujo, int]
    por_kg: dict[Flujo, Decimal]


class Movimiento(BaseModel):
    id: UUID
    solicitante_id: UUID
    puntos: int
    codigo: str
    regla_version: int
    explicacion: str
    fecha: datetime


class Saldo(BaseModel):
    solicitante_id: UUID
    saldo: int
    movimientos: list[Movimiento]


class PuntosAcreditados(Evento):
    solicitante_id: UUID
    codigo: str
    flujo: Flujo
    kg: Decimal | None
    puntos: int
    saldo: int
    explicacion: str


# ponytail: en memoria hasta que entre Postgres.
_reglas = [Regla(1, {Flujo.ORGANICO: 10, Flujo.RECICLABLE: 10}, {Flujo.ORGANICO: Decimal(1), Flujo.RECICLABLE: Decimal(1)})]
_movimientos: list[Movimiento] = []


def regla_vigente() -> ReglaVista:
    regla = _reglas[-1]
    return ReglaVista(version=regla.version, base=regla.base, por_kg=regla.por_kg)


def cambiar_regla(nueva: NuevaRegla) -> ReglaVista:
    """Crea una versión nueva; las anteriores quedan para explicar los movimientos viejos."""
    if set(nueva.base) != set(Flujo) or set(nueva.por_kg) != set(Flujo):
        raise ErrorDeNegocio("La regla necesita valores para los dos flujos.")
    if min([*nueva.base.values(), *nueva.por_kg.values()]) < 0:
        raise ErrorDeNegocio("Los valores no pueden ser negativos.")
    _reglas.append(Regla(_reglas[-1].version + 1, nueva.base, nueva.por_kg))
    return regla_vigente()


def saldo(solicitante_id: UUID) -> Saldo:
    propios = [m for m in _movimientos if m.solicitante_id == solicitante_id]
    return Saldo(solicitante_id=solicitante_id, saldo=sum(m.puntos for m in propios), movimientos=propios)


def escuchar() -> None:
    suscribir(solicitudes.RecoleccionRegistrada, _acreditar)


def _acreditar(e: solicitudes.RecoleccionRegistrada) -> None:
    regla = _reglas[-1]
    puntos, explicacion = regla.calcular(e.flujo, e.kg)
    _movimientos.append(Movimiento(id=uuid4(), solicitante_id=e.solicitante_id, puntos=puntos, codigo=e.codigo,
                                   regla_version=regla.version, explicacion=explicacion,
                                   fecha=datetime.now(timezone.utc)))
    publicar(PuntosAcreditados(solicitante_id=e.solicitante_id, codigo=e.codigo, flujo=e.flujo, kg=e.kg, puntos=puntos,
                               saldo=saldo(e.solicitante_id).saldo, explicacion=explicacion))
