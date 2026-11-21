"""Tablas de acceso, en su propio esquema (ADR-0001)."""
from sqlalchemy import Boolean, Column, Integer, String, Table, Uuid, text

from app.compartido.bd import metadata, transaccion

usuarios = Table(
    "usuarios", metadata,
    Column("id", Uuid, primary_key=True),
    Column("usuario", String(40), nullable=False, unique=True),
    Column("nombre", String(80), nullable=False),
    Column("rol", String(14), nullable=False),
    Column("colectivo", String(14)),
    Column("clave", String(200), nullable=False),  # sal y hash scrypt; nunca la clave
    Column("correo", String(254)),
    Column("telefono", String(32)),
    Column("activo", Boolean, nullable=False, server_default=text("true")),
    Column("version_sesion", Integer, nullable=False, server_default=text("0")),
    schema="acceso",
)


def actualizar_esquema() -> None:
    """Incorpora los campos de configuración a las bases que ya tienen usuarios."""
    with transaccion() as c:
        c.execute(text("""
            ALTER TABLE acceso.usuarios
                ADD COLUMN IF NOT EXISTS correo varchar(254),
                ADD COLUMN IF NOT EXISTS telefono varchar(32),
                ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true,
                ADD COLUMN IF NOT EXISTS version_sesion integer NOT NULL DEFAULT 0
        """))
