"""Tablas de directorio, en su propio esquema (ADR-0001). Lugares en dos niveles: zona y conjunto (ADR-0016)."""
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Table, UniqueConstraint, Uuid
from sqlalchemy.dialects.postgresql import JSONB

from app.compartido.bd import metadata

zonas = Table(
    "zonas", metadata,
    Column("id", Uuid, primary_key=True),
    Column("nombre", String(60), nullable=False, unique=True),
    Column("activo", Boolean, nullable=False, default=True),
    schema="directorio",
)

conjuntos = Table(
    "conjuntos", metadata,
    Column("id", Uuid, primary_key=True),
    Column("zona_id", Uuid, ForeignKey("directorio.zonas.id"), nullable=False),
    Column("nombre", String(60), nullable=False),
    Column("activo", Boolean, nullable=False, default=True),
    UniqueConstraint("zona_id", "nombre"),
    schema="directorio",
)

solicitantes = Table(
    "solicitantes", metadata,
    Column("id", Uuid, primary_key=True),
    Column("telefono", String(16), nullable=False, unique=True),
    Column("nombre", String(60), nullable=False),
    Column("tipo", String(20), nullable=False),
    Column("zona_id", Uuid, ForeignKey("directorio.zonas.id"), nullable=False),
    Column("conjunto_id", Uuid, ForeignKey("directorio.conjuntos.id")),  # vacío si su zona no tiene conjuntos
    Column("direccion", String(120), nullable=False),  # torre, apartamento, casa o local
    Column("estado", String(12), nullable=False),
    Column("autorizo_en", DateTime(timezone=True), nullable=False),  # Ley 1581
    Column("registrado_por", String(60)),  # quien lo registró desde la tableta; vacío si llegó por WhatsApp
    schema="directorio",
)

encargados = Table(
    "encargados", metadata,
    Column("id", Uuid, primary_key=True),
    Column("nombre", String(60), nullable=False),
    Column("colectivo", String(14), nullable=False),
    Column("lugares", JSONB, nullable=False),  # ids de los conjuntos (o zonas sin conjuntos) que cubre
    Column("activo", Boolean, nullable=False),
    schema="directorio",
)
