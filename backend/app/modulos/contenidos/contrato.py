"""Contrato público de contenidos: educación ambiental y tutoriales, por audiencia."""
from datetime import datetime, timezone
from enum import StrEnum
from uuid import UUID, uuid4

from pydantic import BaseModel, Field
from sqlalchemy import insert, or_, select, update

from app.compartido.bd import transaccion
from app.compartido.tipos import Flujo, NoEncontrado
from app.modulos.contenidos import tablas as t


class Proposito(StrEnum):
    EDUCACION = "educacion"
    TUTORIAL = "tutorial"
    CANJE = "canje"  # qué se puede canjear con los puntos; lo edita el administrador


class Audiencia(StrEnum):
    SOLICITANTE = "solicitante"  # le llega por WhatsApp
    COORDINADOR = "coordinador"  # Ayuda en la tablet
    ENCARGADO = "encargado"  # el coordinador se lo muestra en la tablet: video o imagen, sin texto


class Formato(StrEnum):
    VIDEO = "video"
    IMAGEN = "imagen"
    TEXTO = "texto"


class NuevoContenido(BaseModel):
    titulo: str = Field(min_length=3, max_length=80)
    proposito: Proposito
    audiencia: Audiencia
    flujo: Flujo | None = None  # None: general
    formato: Formato
    texto_corto: str = Field(max_length=600)  # cuerpo del mensaje de WhatsApp
    url: str | None = None  # video o imagen pública
    activo: bool = True


class ContenidoVista(NuevoContenido):
    id: UUID


def listar(audiencia: Audiencia | None = None, flujo: Flujo | None = None,
           proposito: Proposito | None = None) -> list[ContenidoVista]:
    """Con flujo, trae los de ese flujo y los generales."""
    tabla = t.contenidos
    consulta = select(tabla).where(tabla.c.activo).order_by(tabla.c.creado)
    if audiencia is not None:
        consulta = consulta.where(tabla.c.audiencia == audiencia)
    if flujo is not None:
        consulta = consulta.where(or_(tabla.c.flujo.is_(None), tabla.c.flujo == flujo))
    if proposito is not None:
        consulta = consulta.where(tabla.c.proposito == proposito)
    with transaccion() as c:
        return [ContenidoVista.model_validate(dict(fila._mapping)) for fila in c.execute(consulta).all()]


def crear(nuevo: NuevoContenido) -> ContenidoVista:
    contenido = ContenidoVista(id=uuid4(), **nuevo.model_dump())
    with transaccion() as c:
        c.execute(insert(t.contenidos).values(**contenido.model_dump(), creado=datetime.now(timezone.utc)))
    return contenido


def actualizar(id: UUID, datos: NuevoContenido) -> ContenidoVista:
    with transaccion() as c:
        if c.execute(update(t.contenidos).where(t.contenidos.c.id == id).values(**datos.model_dump())).rowcount == 0:
            raise NoEncontrado(f"No existe el contenido {id}.")
    return ContenidoVista(id=id, **datos.model_dump())


def para_rechazo(flujo: Flujo) -> ContenidoVista | None:
    """La pieza que se manda tras un rechazo: el error vuelve a la persona como aprendizaje."""
    return next((c for c in listar(Audiencia.SOLICITANTE, flujo, Proposito.EDUCACION) if c.flujo == flujo), None)
