"""Tablas de whatsapp, en su propio esquema (ADR-0001)."""
from sqlalchemy import Column, DateTime, Integer, String, Table, Text
from sqlalchemy.dialects.postgresql import JSONB

from app.compartido.bd import metadata

# Estado de cada número: el paso del registro o del bot, y quién de la coordinación lo atiende (ADR-0007).
conversaciones = Table(
    "conversaciones", metadata,
    Column("telefono", String(16), primary_key=True),
    Column("memoria", JSONB, nullable=False),
    Column("control", String(80)),  # vacío: responde el bot
    Column("actualizada", DateTime(timezone=True), nullable=False),
    schema="whatsapp",
)

# Todo lo que entra y sale por WhatsApp: el monitor de la coordinación y los reintentos salen de aquí.
mensajes = Table(
    "mensajes", metadata,
    Column("id", Integer, primary_key=True, autoincrement=True),
    Column("telefono", String(16), nullable=False, index=True),
    Column("direccion", String(8), nullable=False),  # entrante | saliente
    Column("autor", String(14), nullable=False),  # vecino | bot | aviso | coordinacion
    Column("texto", Text, nullable=False),
    Column("media_url", Text),
    Column("estado", String(8)),  # enviado | fallido; vacío en los entrantes
    Column("enviado_en", DateTime(timezone=True), nullable=False),
    schema="whatsapp",
)
