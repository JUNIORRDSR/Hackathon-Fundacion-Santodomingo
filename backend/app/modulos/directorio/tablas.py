"""Tablas de directorio, en su propio esquema (ADR-0001)."""
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Table, Uuid
from sqlalchemy.dialects.postgresql import JSONB

from app.compartido.bd import metadata

zonas = Table(
    "zonas", metadata,
    Column("id", Uuid, primary_key=True),
    Column("nombre", String(60), nullable=False, unique=True),
    schema="directorio",
)

solicitantes = Table(
    "solicitantes", metadata,
    Column("id", Uuid, primary_key=True),
    Column("telefono", String(16), nullable=False, unique=True),
    Column("nombre", String(60), nullable=False),
    Column("tipo", String(20), nullable=False),
    Column("zona_id", Uuid, ForeignKey("directorio.zonas.id"), nullable=False),
    Column("direccion", String(120), nullable=False),
    Column("estado", String(12), nullable=False),
    Column("autorizo_en", DateTime(timezone=True), nullable=False),  # Ley 1581
    schema="directorio",
)

encargados = Table(
    "encargados", metadata,
    Column("id", Uuid, primary_key=True),
    Column("nombre", String(60), nullable=False),
    Column("colectivo", String(14), nullable=False),
    Column("zonas", JSONB, nullable=False),  # ids de las zonas que cubre
    Column("activo", Boolean, nullable=False),
    schema="directorio",
)
