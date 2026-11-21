"""Tablas de whatsapp, en su propio esquema (ADR-0001)."""
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Table, Text, Uuid, func
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

# El último mensaje entrante visto por cada usuario de coordinación en un hilo.
lecturas = Table(
    "lecturas", metadata,
    Column("usuario_id", Uuid, primary_key=True),
    Column("telefono", String(16), primary_key=True),
    Column("hasta_id", Integer, nullable=False),
    schema="whatsapp",
)

# Cada mensaje que entregó Twilio, por su SID: si Twilio reintenta el webhook, no se procesa dos veces (Jorge).
entregas = Table(
    "entregas", metadata,
    Column("sid", String(34), primary_key=True),
    Column("recibida_en", DateTime(timezone=True), server_default=func.now(), nullable=False),
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

# Un turno fallido se puede reintentar con el mensaje que el monitor ya mostró.
entregas_pendientes = Table(
    "entregas_pendientes", metadata,
    Column("sid", ForeignKey("whatsapp.entregas.sid"), primary_key=True),
    Column("mensaje_id", ForeignKey("whatsapp.mensajes.id"), nullable=False),
    schema="whatsapp",
)

# Quién escribe según Twilio (ADR-0016): su nombre de perfil, su usuario de WhatsApp y su BSUID. El BSUID sigue al
# vecino aunque oculte su número tras un usuario: así se reconoce a quien ya escribió.
contactos = Table(
    "contactos", metadata,
    Column("telefono", String(16), primary_key=True),
    Column("bsuid", String(140), unique=True),
    Column("usuario", String(64)),
    Column("perfil", String(80)),
    Column("visto_en", DateTime(timezone=True), nullable=False),
    schema="whatsapp",
)
