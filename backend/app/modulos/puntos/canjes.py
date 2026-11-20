"""Canje de puntos (ADR-0008): el vecino lo pide por WhatsApp, los puntos quedan apartados y la huerta lo entrega."""
from datetime import datetime, timezone
from enum import StrEnum
from uuid import UUID, uuid4

from pydantic import BaseModel, Field
from sqlalchemy import func, insert, select, update

from app.compartido.bd import transaccion
from app.compartido.eventos import Evento, publicar
from app.compartido.tipos import ErrorDeNegocio, NoEncontrado
from app.modulos.directorio import contrato as directorio
from app.modulos.puntos import tablas as t


class NuevoPremio(BaseModel):
    nombre: str = Field(min_length=2, max_length=80)
    costo: int = Field(gt=0)
    activo: bool = True


class PremioVista(NuevoPremio):
    id: UUID
    ejemplo: bool


class EstadoCanje(StrEnum):
    PEDIDO = "pedido"
    ENTREGADO = "entregado"
    CANCELADO = "cancelado"


class CanjeVista(BaseModel):
    id: UUID
    codigo: str
    solicitante_id: UUID
    solicitante_nombre: str
    telefono: str
    premio: str
    costo: int
    estado: EstadoCanje
    pedido_en: datetime
    cerrado_en: datetime | None


class CanjeEntregado(Evento):
    solicitante_id: UUID
    codigo: str
    premio: str
    saldo: int


def premios(solo_activos: bool = False) -> list[PremioVista]:
    consulta = select(t.premios).order_by(t.premios.c.costo, t.premios.c.nombre)
    if solo_activos:
        consulta = consulta.where(t.premios.c.activo)
    with transaccion() as c:
        return [PremioVista.model_validate(dict(f._mapping)) for f in c.execute(consulta)]


def guardar_premio(nuevo: NuevoPremio, id: UUID | None = None, ejemplo: bool = False) -> PremioVista:
    """Sin id crea el premio; con id lo edita y deja de ser de ejemplo."""
    with transaccion() as c:
        if id is None:
            id = uuid4()
            c.execute(insert(t.premios).values(id=id, ejemplo=ejemplo, **nuevo.model_dump()))
        elif not c.execute(update(t.premios).where(t.premios.c.id == id)
                           .values(ejemplo=False, **nuevo.model_dump())).rowcount:
            raise NoEncontrado("No existe ese premio.")
    return next(p for p in premios() if p.id == id)


def disponible(solicitante_id: UUID) -> int:
    """El saldo del libro menos lo apartado en canjes por entregar."""
    with transaccion() as c:
        saldo = c.execute(select(func.coalesce(func.sum(t.movimientos.c.puntos), 0))
                          .where(t.movimientos.c.solicitante_id == solicitante_id)).scalar_one()
        return saldo - _apartado(c, solicitante_id)


def pedir(solicitante_id: UUID, premio_id: UUID) -> CanjeVista:
    # ponytail: dos pedidos simultáneos del mismo vecino podrían apartar de más; bloquear por solicitante si pasa.
    premio = next((p for p in premios(solo_activos=True) if p.id == premio_id), None)
    if premio is None:
        raise NoEncontrado("Ese premio ya no está disponible.")
    faltan = premio.costo - disponible(solicitante_id)
    if faltan > 0:
        raise ErrorDeNegocio(f"Te faltan {faltan} puntos para {premio.nombre}.")
    with transaccion() as c:
        numero = c.execute(select(t.consecutivo_canje.next_value())).scalar_one()
        codigo = f"CAN-{numero:04d}"
        c.execute(insert(t.canjes).values(id=uuid4(), codigo=codigo, solicitante_id=solicitante_id,
                                          premio=premio.nombre, costo=premio.costo, estado=EstadoCanje.PEDIDO,
                                          pedido_en=datetime.now(timezone.utc)))
    return por_codigo(codigo)


def canjes(estado: EstadoCanje | None = None, solicitante_id: UUID | None = None) -> list[CanjeVista]:
    consulta = select(t.canjes).order_by(t.canjes.c.pedido_en.desc())
    if estado:
        consulta = consulta.where(t.canjes.c.estado == estado)
    if solicitante_id:
        consulta = consulta.where(t.canjes.c.solicitante_id == solicitante_id)
    with transaccion() as c:
        return [_vista(f) for f in c.execute(consulta)]


def por_codigo(codigo: str) -> CanjeVista:
    with transaccion() as c:
        fila = c.execute(select(t.canjes).where(t.canjes.c.codigo == codigo.strip().upper())).first()
    if fila is None:
        raise NoEncontrado(f"No existe el canje {codigo}.")
    return _vista(fila)


def entregar(codigo: str, por: str) -> CanjeVista:
    """Descuenta del libro con el código del canje: el movimiento negativo explica a dónde se fueron los puntos."""
    with transaccion() as c:
        canje = _cerrar(codigo, EstadoCanje.ENTREGADO, por)
        version = c.execute(select(func.max(t.reglas.c.version))).scalar_one()
        c.execute(insert(t.movimientos).values(id=uuid4(), solicitante_id=canje.solicitante_id, puntos=-canje.costo,
                                               codigo=canje.codigo, regla_version=version,
                                               explicacion=f"Canje {canje.codigo}: {canje.premio}",
                                               fecha=datetime.now(timezone.utc)))
        publicar(CanjeEntregado(solicitante_id=canje.solicitante_id, codigo=canje.codigo, premio=canje.premio,
                                saldo=disponible(canje.solicitante_id)))
    return por_codigo(codigo)


def cancelar(codigo: str, por: str) -> CanjeVista:
    """Los puntos apartados vuelven a estar disponibles."""
    return _cerrar(codigo, EstadoCanje.CANCELADO, por)


def _cerrar(codigo: str, estado: EstadoCanje, por: str) -> CanjeVista:
    canje = por_codigo(codigo)
    if canje.estado != EstadoCanje.PEDIDO:
        raise ErrorDeNegocio(f"El canje {canje.codigo} ya está {canje.estado}.")
    with transaccion() as c:
        c.execute(update(t.canjes).where(t.canjes.c.id == canje.id)
                  .values(estado=estado, cerrado_en=datetime.now(timezone.utc), cerrado_por=por))
    return por_codigo(codigo)


def _apartado(c, solicitante_id: UUID) -> int:
    return c.execute(select(func.coalesce(func.sum(t.canjes.c.costo), 0)).where(
        t.canjes.c.solicitante_id == solicitante_id, t.canjes.c.estado == EstadoCanje.PEDIDO)).scalar_one()


def _vista(fila) -> CanjeVista:
    solicitante = directorio.solicitante(fila.solicitante_id)
    return CanjeVista(solicitante_nombre=solicitante.nombre, telefono=solicitante.telefono, **dict(fila._mapping))
