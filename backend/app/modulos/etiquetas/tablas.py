"""Tablas de etiquetas: el número de cada hogar para su código escrito (ADR-0015). El hogar va por ID (ADR-0001)."""
from sqlalchemy import Column, Integer, Sequence, Table, Uuid

from app.compartido.bd import metadata

codigos = Table(
    "codigos", metadata,
    Column("solicitante_id", Uuid, primary_key=True),  # directorio
    Column("numero", Integer, nullable=False, unique=True),
    schema="etiquetas",
)

# Desde 100 los códigos tienen cuatro cifras, y uno con ceros adelante (0042) nunca es de un hogar.
consecutivo = Sequence("consecutivo", start=100, schema="etiquetas", metadata=metadata)
