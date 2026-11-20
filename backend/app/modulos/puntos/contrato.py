"""Contrato público de puntos: regla con versión y libro de movimientos que solo crece (RN-05, RN-06)."""
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID, uuid4

from pydantic import BaseModel
from sqlalchemy import insert, select

from app.compartido.bd import transaccion
from app.compartido.eventos import Evento, publicar, suscribir
from app.compartido.tipos import ErrorDeNegocio, Flujo
from app.modulos.puntos import tablas as t
from app.modulos.puntos.dominio import Regla
from app.modulos.solicitudes import contrato as solicitudes

# Valores de ejemplo hasta que la fundación los valide.
INICIAL = Regla(1, base={Flujo.ORGANICO: 10, Flujo.RECICLABLE: 10},
                por_kg={Flujo.ORGANICO: Decimal(1), Flujo.RECICLABLE: Decimal(1)})


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


def regla_vigente() -> ReglaVista:
    with transaccion() as c:
        regla = _vigente(c)
    return ReglaVista(version=regla.version, base=regla.base, por_kg=regla.por_kg)


def cambiar_regla(nueva: NuevaRegla) -> ReglaVista:
    """Crea una versión nueva; las anteriores quedan para explicar los movimientos viejos."""
    if set(nueva.base) != set(Flujo) or set(nueva.por_kg) != set(Flujo):
        raise ErrorDeNegocio("La regla necesita valores para los dos flujos.")
    if min([*nueva.base.values(), *nueva.por_kg.values()]) < 0:
        raise ErrorDeNegocio("Los valores no pueden ser negativos.")
    with transaccion() as c:
        _guardar_regla(c, Regla(_vigente(c).version + 1, nueva.base, nueva.por_kg))
    return regla_vigente()


def saldo(solicitante_id: UUID) -> Saldo:
    with transaccion() as c:
        filas = c.execute(select(t.movimientos).where(t.movimientos.c.solicitante_id == solicitante_id)
                          .order_by(t.movimientos.c.fecha)).all()
    movimientos = [Movimiento.model_validate(dict(fila._mapping)) for fila in filas]
    return Saldo(solicitante_id=solicitante_id, saldo=sum(m.puntos for m in movimientos), movimientos=movimientos)


def escuchar() -> None:
    suscribir(solicitudes.RecoleccionRegistrada, _acreditar)


def _acreditar(e: solicitudes.RecoleccionRegistrada) -> None:
    """Corre dentro de la transacción de la recolección: o quedan las dos cosas o ninguna."""
    with transaccion() as c:
        regla = _vigente(c)
        puntos, explicacion = regla.calcular(e.flujo, e.kg)
        c.execute(insert(t.movimientos).values(id=uuid4(), solicitante_id=e.solicitante_id, puntos=puntos,
                                               codigo=e.codigo, regla_version=regla.version, explicacion=explicacion,
                                               fecha=datetime.now(timezone.utc)))
        publicar(PuntosAcreditados(solicitante_id=e.solicitante_id, codigo=e.codigo, flujo=e.flujo, kg=e.kg,
                                   puntos=puntos, saldo=saldo(e.solicitante_id).saldo, explicacion=explicacion))


def _vigente(c) -> Regla:
    fila = c.execute(select(t.reglas).order_by(t.reglas.c.version.desc()).limit(1)).first()
    if fila is None:
        _guardar_regla(c, INICIAL)
        return INICIAL
    return Regla(fila.version, {Flujo(k): int(v) for k, v in fila.base.items()},
                 {Flujo(k): Decimal(v) for k, v in fila.por_kg.items()})


def _guardar_regla(c, regla: Regla) -> None:
    c.execute(insert(t.reglas).values(version=regla.version, base={k.value: v for k, v in regla.base.items()},
                                      por_kg={k.value: str(v) for k, v in regla.por_kg.items()},
                                      creada=datetime.now(timezone.utc)))
