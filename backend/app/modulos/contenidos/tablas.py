"""Tablas de contenidos, en su propio esquema (ADR-0001)."""
from sqlalchemy import Boolean, Column, DateTime, String, Table, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB

from app.compartido.bd import metadata

contenidos = Table(
    "contenidos", metadata,
    Column("id", Uuid, primary_key=True),
    Column("titulo", String(80), nullable=False),
    Column("proposito", String(10), nullable=False),
    Column("audiencia", String(12), nullable=False),
    Column("flujo", String(12)),  # vacío: general
    Column("formato", String(8), nullable=False),
    Column("texto_corto", String(600), nullable=False),
    Column("url", Text),
    Column("activo", Boolean, nullable=False),
    Column("categoria", String(12), nullable=False),
    Column("pasos", JSONB, nullable=False),
    Column("subtitulos_url", Text),
    Column("transcripcion", Text),
    Column("creado", DateTime(timezone=True), nullable=False),
    schema="contenidos",
)
