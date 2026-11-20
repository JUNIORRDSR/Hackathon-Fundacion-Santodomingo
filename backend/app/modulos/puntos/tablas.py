"""Tablas de puntos, en su propio esquema (ADR-0001)."""
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Table, Text, Uuid
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
