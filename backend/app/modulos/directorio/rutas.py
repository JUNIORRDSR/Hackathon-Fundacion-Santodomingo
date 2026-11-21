"""Rutas semanales de recolección y horarios que se pueden compartir con el barrio."""
from typing import Annotated
from uuid import UUID, uuid4

from pydantic import BaseModel, Field, StringConstraints, field_validator, model_validator
from sqlalchemy import and_, insert, or_, select, update

from app.compartido.bd import transaccion
from app.compartido.tipos import Colectivo, ErrorDeNegocio, NoEncontrado
from app.modulos.directorio import tablas as t
from app.modulos.directorio.lugares import reservar_conjunto, zona

Dia = Annotated[int, Field(strict=True, ge=0, le=6)]  # lunes a domingo
Hora = Annotated[str, Field(pattern=r"^(?:[01][0-9]|2[0-3]):[0-5][0-9]$")]


class HorarioRuta(BaseModel):
    nombre: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=80)]
    colectivo: Colectivo
    dias: list[Dia] = Field(min_length=1, max_length=7)
    hora_inicio: Hora
    hora_fin: Hora


class DatosRuta(HorarioRuta):
    encargado_id: UUID
    zona_id: UUID
    conjunto_id: UUID | None = None
    publicada: bool = False

    @field_validator("dias")
    @classmethod
    def ordenar_dias(cls, dias: list[int]) -> list[int]:
        if len(set(dias)) != len(dias):
            raise ValueError("Selecciona cada día una sola vez.")
        return sorted(dias)

    @model_validator(mode="after")
    def validar_horario(self):
        if self.hora_inicio >= self.hora_fin:
            raise ValueError("La hora de fin debe ser posterior a la de inicio.")
        return self


class RutaVista(DatosRuta):
    id: UUID
    disponible: bool


class RutaPublica(HorarioRuta):
    id: UUID
    zona: str
    conjunto: str | None


_rutas = t.rutas_recoleccion
_referencias = (_rutas.join(t.encargados, _rutas.c.encargado_id == t.encargados.c.id)
                .join(t.zonas, _rutas.c.zona_id == t.zonas.c.id)
                .outerjoin(t.conjuntos, _rutas.c.conjunto_id == t.conjuntos.c.id))
_disponible = and_(t.encargados.c.activo, t.zonas.c.activo,
                   or_(_rutas.c.conjunto_id.is_(None), t.conjuntos.c.activo))


def _consulta():
    return select(_rutas, t.encargados.c.colectivo, _disponible.label("disponible")).select_from(_referencias)


def rutas(colectivo: Colectivo | None) -> list[RutaVista]:
    consulta = _consulta().order_by(t.zonas.c.nombre, _rutas.c.nombre, _rutas.c.id)
    if colectivo is not None:
        consulta = consulta.where(t.encargados.c.colectivo == colectivo)
    with transaccion() as c:
        return [RutaVista.model_validate(fila) for fila in c.execute(consulta).mappings()]


def ruta(id: UUID) -> RutaVista:
    with transaccion() as c:
        fila = c.execute(_consulta().where(_rutas.c.id == id)).mappings().first()
    if fila is None:
        raise NoEncontrado("No existe la ruta.")
    return RutaVista.model_validate(fila)


def rutas_publicas() -> list[RutaPublica]:
    consulta = (select(_rutas.c.id, _rutas.c.nombre, t.encargados.c.colectivo, t.zonas.c.nombre.label("zona"),
                       t.conjuntos.c.nombre.label("conjunto"), _rutas.c.dias, _rutas.c.hora_inicio, _rutas.c.hora_fin)
                .select_from(_referencias).where(_rutas.c.publicada, _disponible)
                .order_by(t.zonas.c.nombre, _rutas.c.nombre, _rutas.c.id))
    with transaccion() as c:
        return [RutaPublica.model_validate(fila) for fila in c.execute(consulta).mappings()]


def _validar_referencias(c, datos: DatosRuta) -> None:
    etapa = zona(datos.zona_id)
    sector = next((item for item in etapa.conjuntos if item.id == datos.conjunto_id), None)
    if datos.conjunto_id and (sector is None or not reservar_conjunto(datos.conjunto_id)):
        raise ErrorDeNegocio("El sector no pertenece a la zona elegida.")
    encargado = c.execute(select(t.encargados).where(t.encargados.c.id == datos.encargado_id)).first()
    if encargado is None or encargado.colectivo != datos.colectivo:
        raise ErrorDeNegocio("Elige un responsable de tu equipo.")
    if datos.publicada and not (encargado.activo and etapa.activo and (sector is None or sector.activo)):
        raise ErrorDeNegocio("Para publicar la ruta, el responsable y el territorio deben estar activos.")


def crear_ruta(datos: DatosRuta) -> RutaVista:
    id = uuid4()
    with transaccion() as c:
        _validar_referencias(c, datos)
        c.execute(insert(_rutas).values(id=id, **datos.model_dump(exclude={"colectivo"})))
        return ruta(id)


def actualizar_ruta(id: UUID, datos: DatosRuta) -> RutaVista:
    with transaccion() as c:
        if ruta(id).colectivo != datos.colectivo:
            raise ErrorDeNegocio("Solo puedes reasignar la ruta dentro de su equipo.")
        _validar_referencias(c, datos)
        c.execute(update(_rutas).where(_rutas.c.id == id).values(datos.model_dump(exclude={"colectivo"})))
        return ruta(id)
