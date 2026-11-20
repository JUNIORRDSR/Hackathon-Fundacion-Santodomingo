"""Tablas de solicitudes, en su propio esquema. A otros módulos se refiere por ID, sin claves foráneas (ADR-0001)."""
from sqlalchemy import Column, Date, DateTime, Index, Numeric, Sequence, String, Table, Text, Time, Uuid, text
from sqlalchemy.dialects.postgresql import JSONB

from app.compartido.bd import metadata
from app.compartido.tipos import Flujo

solicitudes = Table(
    "solicitudes", metadata,
    Column("id", Uuid, primary_key=True),
    Column("codigo", String(12), nullable=False, unique=True),
    Column("solicitante_id", Uuid, nullable=False, index=True),  # directorio
    Column("flujo", String(12), nullable=False),
    Column("zona_id", Uuid, nullable=False),  # directorio
    Column("direccion", String(120), nullable=False),
    Column("preferencia", String(10), nullable=False),
    Column("observaciones", Text, nullable=False),
    Column("canal", String(12), nullable=False),
    Column("estado", String(12), nullable=False),
    Column("encargado_id", Uuid),  # directorio
    Column("asignada_por", Uuid),  # acceso
    Column("dia", Date),
    Column("hora", Time),
    Column("kg", Numeric(6, 2)),
    Column("motivo", Text, nullable=False),
    Column("historial", JSONB, nullable=False),
    Column("recibida", DateTime(timezone=True), nullable=False),
    schema="solicitudes",
)

# Una sola solicitud abierta por solicitante y flujo, aunque dos pedidos lleguen a la vez.
Index("una_abierta_por_flujo", solicitudes.c.solicitante_id, solicitudes.c.flujo, unique=True,
      postgresql_where=text("estado IN ('recibida', 'asignada', 'programada')"))

consecutivos = {flujo: Sequence(f"consecutivo_{flujo.value}", schema="solicitudes", metadata=metadata) for flujo in Flujo}
