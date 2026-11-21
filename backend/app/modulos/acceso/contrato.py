"""Contrato de acceso: quién entra a la tablet y qué colectivo ve (ADR-0004, RN-01, RN-07)."""
import hashlib
import hmac
import os
from collections.abc import Iterator
from contextlib import contextmanager
from enum import StrEnum
from typing import Annotated
from uuid import UUID, uuid4

from fastapi import HTTPException, Request
from pydantic import BaseModel, Field, StringConstraints, field_validator
from sqlalchemy import Row, select, text, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError

from app.compartido.bd import transaccion
from app.compartido.tipos import Colectivo, ErrorDeNegocio, NoEncontrado
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
    correo: str | None = None
    telefono: str | None = None
    activo: bool = True


class NuevoUsuario(BaseModel):
    usuario: str = Field(min_length=3, max_length=40)
    nombre: str = Field(min_length=2, max_length=80)
    rol: Rol
    colectivo: Colectivo | None = None
    clave: str = Field(min_length=8, max_length=128)


class Perfil(BaseModel):
    usuario: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=40)]
    nombre: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=80)]
    correo: str | None = Field(default=None, max_length=254, pattern=r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
    telefono: str | None = Field(default=None, max_length=32, pattern=r"^\+?[0-9 ()\-.]+$")

    @field_validator("correo", "telefono", mode="before")
    @classmethod
    def contacto_opcional(cls, valor):
        return (valor.strip() or None) if isinstance(valor, str) else valor


class ConfiguracionUsuario(Perfil):
    rol: Rol
    colectivo: Colectivo | None = None
    activo: bool


def preparar_esquema() -> None:
    t.actualizar_esquema()


def crear_usuario(nuevo: NuevoUsuario) -> Usuario:
    _validar_colectivo(nuevo.rol, nuevo.colectivo)
    usuario = Usuario(id=uuid4(), **nuevo.model_dump(exclude={"clave"}))
    guardar = insert(t.usuarios).values(**usuario.model_dump(), clave=_hash(nuevo.clave))
    with transaccion() as c:
        guardado = c.execute(guardar.on_conflict_do_nothing(index_elements=["usuario"]).returning(t.usuarios.c.id))
        if guardado.scalar_one_or_none() is None:
            raise ErrorDeNegocio("Ese usuario ya existe.")
    return usuario


def autenticar(usuario: str, clave: str) -> tuple[Usuario, int] | None:
    with transaccion() as c:
        fila = c.execute(select(t.usuarios).where(t.usuarios.c.usuario == usuario)).first()
    if fila is None or not fila.activo or not _verificar(clave, fila.clave):
        return None
    return Usuario.model_validate(fila._mapping), fila.version_sesion


def usuario_actual(request: Request) -> Usuario:
    datos = request.session.get("usuario", {})
    if "id" in datos:
        fila = _buscar_usuario(UUID(datos["id"]))
        if fila is not None and fila.activo and fila.version_sesion == datos.get("version", 0):
            return Usuario.model_validate(fila._mapping)
        request.session.clear()
    raise HTTPException(401, "Inicia sesión.")


def administrador_actual(request: Request) -> Usuario:
    usuario = usuario_actual(request)
    exigir_administrador(usuario)
    return usuario


@contextmanager
def administrar(request: Request) -> Iterator[Usuario]:
    """Serializa los cambios de cuentas y comprueba la autorización dentro de la transacción."""
    with transaccion() as c:
        c.execute(text("SELECT pg_advisory_xact_lock(4208)"))
        yield administrador_actual(request)


def listar_usuarios() -> list[Usuario]:
    with transaccion() as c:
        filas = c.execute(select(t.usuarios).order_by(t.usuarios.c.nombre, t.usuarios.c.usuario))
        return [Usuario.model_validate(fila) for fila in filas.mappings()]


def editar_usuario(admin: Usuario, id_usuario: UUID, datos: ConfiguracionUsuario) -> Usuario:
    if admin.id == id_usuario and (not datos.activo or datos.rol != Rol.ADMINISTRADOR):
        raise ErrorDeNegocio("No puedes desactivar tu cuenta ni quitarle el rol de administrador.")
    _validar_colectivo(datos.rol, datos.colectivo)
    fila = _buscar_usuario(id_usuario)
    if fila is None:
        raise NoEncontrado("No encontramos esa cuenta.")
    valores = datos.model_dump()
    if fila.activo != datos.activo:
        valores["version_sesion"] = fila.version_sesion + 1
    return _actualizar_usuario(id_usuario, valores)


def editar_perfil(id_usuario: UUID, datos: Perfil) -> Usuario:
    return _actualizar_usuario(id_usuario, datos.model_dump())


def restablecer_clave(admin: Usuario, id_usuario: UUID, clave: str) -> None:
    if admin.id == id_usuario:
        raise ErrorDeNegocio("Cambia tu clave desde Mi perfil con tu clave actual.")
    _guardar_clave(id_usuario, clave)


def cambiar_mi_clave(admin: Usuario, actual: str, clave: str) -> None:
    fila = _buscar_usuario(admin.id)
    if fila is None or len(actual) > 128 or not _verificar(actual, fila.clave):
        raise ErrorDeNegocio("La clave actual es incorrecta.")
    _guardar_clave(admin.id, clave)


def _buscar_usuario(id_usuario: UUID) -> Row | None:
    with transaccion() as c:
        return c.execute(select(t.usuarios).where(t.usuarios.c.id == id_usuario)).first()


def _actualizar_usuario(id_usuario: UUID, valores: dict) -> Usuario:
    try:
        with transaccion() as c:
            guardar = update(t.usuarios).where(t.usuarios.c.id == id_usuario).values(**valores)
            fila = c.execute(guardar.returning(t.usuarios)).mappings().one_or_none()
    except IntegrityError as error:
        if getattr(error.orig, "sqlstate", None) != "23505":
            raise
        raise ErrorDeNegocio("Ese usuario ya existe.") from error
    if fila is None:
        raise NoEncontrado("No encontramos esa cuenta.")
    return Usuario.model_validate(fila)


def _guardar_clave(id_usuario: UUID, clave: str) -> None:
    if not 8 <= len(clave) <= 128:
        raise ErrorDeNegocio("La clave debe tener entre 8 y 128 caracteres.")
    _actualizar_usuario(id_usuario, {"clave": _hash(clave), "version_sesion": t.usuarios.c.version_sesion + 1})


def _validar_colectivo(rol: Rol, colectivo: Colectivo | None) -> None:
    if (rol == Rol.COORDINADOR) != (colectivo is not None):
        raise ErrorDeNegocio("Un coordinador tiene colectivo; un administrador no.")


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
