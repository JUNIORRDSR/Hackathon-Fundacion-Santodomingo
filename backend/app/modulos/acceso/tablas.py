"""Tablas de acceso, en su propio esquema (ADR-0001)."""
from sqlalchemy import Column, String, Table, Uuid

from app.compartido.bd import metadata

usuarios = Table(
    "usuarios", metadata,
    Column("id", Uuid, primary_key=True),
    Column("usuario", String(40), nullable=False, unique=True),
    Column("nombre", String(80), nullable=False),
    Column("rol", String(14), nullable=False),
    Column("colectivo", String(14)),
    Column("clave", String(200), nullable=False),  # sal y hash scrypt; nunca la clave
    schema="acceso",
)
