"""PostgreSQL (ADR-0001): un esquema por módulo, sin claves foráneas entre módulos y create_all al arrancar.
Una operación es una transacción; si ya hay una abierta, se une a ella (así puntos y recolección van juntos).
Los efectos hacia afuera (WhatsApp) corren después del commit."""
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from contextvars import ContextVar

from sqlalchemy import Engine, MetaData, create_engine, text
from sqlalchemy.engine import Connection

from app.compartido.configuracion import variable

# La base de docker-compose.yml; en producción DATABASE_URL es obligatoria.
LOCAL = "postgresql+psycopg://ecoconecta:solo-para-desarrollo-local@localhost:5440/ecoconecta"

metadata = MetaData()
_motor: Engine | None = None
_conexion: ContextVar[Connection | None] = ContextVar("conexion", default=None)
_despues: ContextVar[list[Callable] | None] = ContextVar("despues", default=None)


def motor() -> Engine:
    global _motor
    if _motor is None:
        _motor = create_engine(variable("DATABASE_URL", LOCAL), pool_pre_ping=True)
    return _motor


def crear_tablas() -> None:
    with motor().begin() as c:
        for esquema in sorted({tabla.schema for tabla in metadata.tables.values()}):
            c.execute(text(f'CREATE SCHEMA IF NOT EXISTS "{esquema}"'))
    metadata.create_all(motor())


@contextmanager
def transaccion() -> Iterator[Connection]:
    actual = _conexion.get()
    if actual is not None:
        yield actual
        return
    pendientes: list[Callable] = []
    with motor().begin() as c:
        token_conexion, token_pendientes = _conexion.set(c), _despues.set(pendientes)
        try:
            yield c
        finally:
            _conexion.reset(token_conexion)
            _despues.reset(token_pendientes)
    for efecto in pendientes:
        efecto()


def despues_del_commit(efecto: Callable) -> bool:
    """Deja el efecto para después del commit. Devuelve False si no hay transacción abierta."""
    pendientes = _despues.get()
    if pendientes is None:
        return False
    pendientes.append(efecto)
    return True
