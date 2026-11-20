"""Tablas de whatsapp, en su propio esquema (ADR-0001)."""
from sqlalchemy import Column, DateTime, Integer, String, Table, Text, func
from sqlalchemy.dialects.postgresql import JSONB

from app.compartido.bd import metadata

# Estado de la conversación de cada número: el paso del registro o del menú, o la memoria del LLM.
conversaciones = Table(
    "conversaciones", metadata,
    Column("telefono", String(16), primary_key=True),
    Column("memoria", JSONB, nullable=False),
    Column("actualizada", DateTime(timezone=True), nullable=False),
    schema="whatsapp",
)

entregas = Table(
    "entregas", metadata,
    Column("sid", String(34), primary_key=True),
    Column("recibida_en", DateTime(timezone=True), server_default=func.now(), nullable=False),
    schema="whatsapp",
)

# Todo lo que sale por WhatsApp, enviado o fallido: sirve para reintentar y es la bandeja del simulador.
mensajes = Table(
    "mensajes", metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("telefono", String(16), nullable=False, index=True),
    Column("texto", Text, nullable=False),
    Column("media_url", Text),
    Column("estado", String(8), nullable=False),
    Column("enviado_en", DateTime(timezone=True), nullable=False),
    schema="whatsapp",
)
