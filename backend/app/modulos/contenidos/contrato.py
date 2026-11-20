"""Contrato público de contenidos: educación ambiental y tutoriales, por audiencia."""
from enum import StrEnum
from uuid import UUID, uuid4

from pydantic import BaseModel, Field

from app.compartido.tipos import Flujo, NoEncontrado


class Proposito(StrEnum):
    EDUCACION = "educacion"
    TUTORIAL = "tutorial"


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


# ponytail: en memoria hasta que entre Postgres.
_contenidos: dict[UUID, ContenidoVista] = {}


def listar(audiencia: Audiencia | None = None, flujo: Flujo | None = None,
           proposito: Proposito | None = None) -> list[ContenidoVista]:
    """Con flujo, trae los de ese flujo y los generales."""
    return [c for c in _contenidos.values() if c.activo
            and (audiencia is None or c.audiencia == audiencia)
            and (flujo is None or c.flujo in (None, flujo))
            and (proposito is None or c.proposito == proposito)]


def crear(nuevo: NuevoContenido) -> ContenidoVista:
    contenido = ContenidoVista(id=uuid4(), **nuevo.model_dump())
    _contenidos[contenido.id] = contenido
    return contenido


def actualizar(id: UUID, datos: NuevoContenido) -> ContenidoVista:
    if id not in _contenidos:
        raise NoEncontrado(f"No existe el contenido {id}.")
    _contenidos[id] = ContenidoVista(id=id, **datos.model_dump())
    return _contenidos[id]


def para_rechazo(flujo: Flujo) -> ContenidoVista | None:
    """La pieza que se manda tras un rechazo: el error vuelve a la persona como aprendizaje."""
    return next((c for c in listar(Audiencia.SOLICITANTE, flujo, Proposito.EDUCACION) if c.flujo == flujo), None)
