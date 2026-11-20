"""Contrato de acceso: quién entra a la tablet y qué colectivo ve (ADR-0004, RN-01, RN-07)."""
import hashlib
import hmac
import os
from enum import StrEnum
from uuid import UUID, uuid4

from fastapi import HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import insert, select

from app.compartido.bd import transaccion
from app.compartido.tipos import Colectivo, ErrorDeNegocio
from app.modulos.acceso import tablas as t


class Rol(StrEnum):
    COORDINADOR = "coordinador"
    ADMINISTRADOR = "administrador"


class Usuario(BaseModel):
    id: UUID
    usuario: str
    nombre: str
    rol: Rol
    colectivo: Colectivo | None = None  # solo los coordinadores


class NuevoUsuario(BaseModel):
    usuario: str = Field(min_length=3, max_length=40)
    nombre: str = Field(min_length=2, max_length=80)
    rol: Rol
    colectivo: Colectivo | None = None
    clave: str = Field(min_length=8, max_length=128)


def crear_usuario(nuevo: NuevoUsuario) -> Usuario:
    if (nuevo.rol == Rol.COORDINADOR) != (nuevo.colectivo is not None):
        raise ErrorDeNegocio("Un coordinador tiene colectivo; un administrador no.")
    usuario = Usuario(id=uuid4(), **nuevo.model_dump(exclude={"clave"}))
    with transaccion() as c:
        if c.execute(select(t.usuarios.c.id).where(t.usuarios.c.usuario == nuevo.usuario)).first():
            raise ErrorDeNegocio("Ese usuario ya existe.")
        c.execute(insert(t.usuarios).values(**usuario.model_dump(), clave=_hash(nuevo.clave)))
    return usuario


def autenticar(usuario: str, clave: str) -> Usuario | None:
    with transaccion() as c:
        fila = c.execute(select(t.usuarios).where(t.usuarios.c.usuario == usuario)).first()
    if fila is None or not _verificar(clave, fila.clave):
        return None
    return Usuario.model_validate(dict(fila._mapping))


def usuario_actual(request: Request) -> Usuario:
    """Dependencia de FastAPI para todos los routers: 401 sin sesión."""
    datos = request.session.get("usuario")
    if not datos:
        raise HTTPException(401, "Inicia sesión.")
    return Usuario.model_validate(datos)


def colectivo_visible(u: Usuario, pedido: Colectivo | None) -> Colectivo | None:
    """El coordinador ve solo su colectivo; el administrador, el que pida o todos."""
    return u.colectivo if u.rol == Rol.COORDINADOR else pedido


def exigir_colectivo(u: Usuario, colectivo: Colectivo) -> None:
    if u.rol == Rol.COORDINADOR and u.colectivo != colectivo:
        raise HTTPException(403, "Eso es de otro colectivo.")


def exigir_administrador(u: Usuario) -> None:
    if u.rol != Rol.ADMINISTRADOR:
        raise HTTPException(403, "Solo el administrador puede hacerlo.")


def _hash(clave: str) -> str:
    sal = os.urandom(16)
    return f"{sal.hex()}:{_scrypt(clave, sal)}"


def _verificar(clave: str, guardado: str) -> bool:
    sal, esperado = guardado.split(":")
    return hmac.compare_digest(_scrypt(clave, bytes.fromhex(sal)), esperado)


def _scrypt(clave: str, sal: bytes) -> str:
    return hashlib.scrypt(clave.encode(), salt=sal, n=2**14, r=8, p=1).hex()
