"""Tablas de puntos, en su propio esquema (ADR-0001)."""
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Sequence, String, Table, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB

from app.compartido.bd import metadata

reglas = Table(
    "reglas", metadata,
    Column("version", Integer, primary_key=True, autoincrement=False),
    Column("base", JSONB, nullable=False),
    Column("por_kg", JSONB, nullable=False),
    Column("creada", DateTime(timezone=True), nullable=False),
    schema="puntos",
)

# Libro que solo crece: nada se actualiza ni se borra. Una recolección acredita una sola vez (código único).
movimientos = Table(
    "movimientos", metadata,
    Column("id", Uuid, primary_key=True),
    Column("solicitante_id", Uuid, nullable=False, index=True),  # directorio
    Column("puntos", Integer, nullable=False),
    Column("codigo", String(12), nullable=False, unique=True),  # solicitudes
    Column("regla_version", Integer, ForeignKey("puntos.reglas.version"), nullable=False),
    Column("explicacion", Text, nullable=False),
    Column("fecha", DateTime(timezone=True), nullable=False),
    schema="puntos",
)

# Catálogo de premios (ADR-0008). Los de ejemplo quedan marcados hasta que la fundación fije los valores.
premios = Table(
    "premios", metadata,
    Column("id", Uuid, primary_key=True),
    Column("nombre", Text, nullable=False),
    Column("costo", Integer, nullable=False),
    Column("activo", Boolean, nullable=False, default=True),
    Column("ejemplo", Boolean, nullable=False, default=False),
    schema="puntos",
)

# Un canje aparta puntos al pedirlo y los descuenta del libro al entregarlo.
canjes = Table(
    "canjes", metadata,
    Column("id", Uuid, primary_key=True),
    Column("codigo", String(12), nullable=False, unique=True),
    Column("solicitante_id", Uuid, nullable=False, index=True),  # directorio
    Column("premio", Text, nullable=False),
    Column("costo", Integer, nullable=False),
    Column("estado", String(12), nullable=False),
    Column("pedido_en", DateTime(timezone=True), nullable=False),
    Column("cerrado_en", DateTime(timezone=True)),
    Column("cerrado_por", Text),
    schema="puntos",
)
consecutivo_canje = Sequence("consecutivo_canje", schema="puntos", metadata=metadata)
