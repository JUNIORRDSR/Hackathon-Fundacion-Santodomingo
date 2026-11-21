"""Contrato de etiquetas: el QR o el código escrito de cada hogar lleva, al pesar, a su solicitud abierta (ADR-0015).
Compone directorio y solicitudes por sus contratos; lo único propio es el número de cada hogar."""
from uuid import UUID

from pydantic import BaseModel
from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert

from app.compartido.bd import transaccion
from app.compartido.tipos import Colectivo, NoEncontrado, TipoGenerador
from app.modulos.directorio import contrato as directorio
from app.modulos.etiquetas import dominio
from app.modulos.etiquetas import tablas as t
from app.modulos.solicitudes import contrato as solicitudes

contenido = dominio.contenido


class EtiquetaVista(BaseModel):
    """Lo que va impreso en el sticker o en el papel: sin teléfono ni dirección."""

    solicitante_id: UUID
    nombre: str
    tipo: TipoGenerador
    zona: str
    habilitado: bool
    contenido: str  # lo que lleva el QR
    codigo: str  # lo que se escribe a mano en la bolsa si no hay sticker


class Lectura(BaseModel):
    etiqueta: EtiquetaVista
    solicitudes: list[solicitudes.SolicitudVista]  # las abiertas que puede ver quien escanea


def etiquetas() -> list[EtiquetaVista]:
    """Una por hogar o negocio habilitado, para imprimirlas en stickers o en papel."""
    habilitados = directorio.solicitantes(directorio.EstadoSolicitante.HABILITADO)
    zonas = {zona.id: zona.nombre for zona in directorio.zonas()}
    codigos = _codigos([s.id for s in habilitados])
    return [_vista(s, zonas, codigos[s.id]) for s in habilitados]


def codigo(solicitante_id: UUID) -> str:
    """El código del hogar; se le asigna la primera vez que alguien lo pide."""
    return _codigos([solicitante_id])[solicitante_id]


def leer(texto: str, colectivo: Colectivo | None) -> Lectura:
    """Lo que leyó la cámara o lo que estaba escrito en la bolsa: el hogar y sus solicitudes abiertas del
    colectivo. Con colectivo None las trae todas (administrador)."""
    solicitante_id = dominio.leer(texto) or _de_codigo(texto)
    solicitante = directorio.solicitante(solicitante_id)
    abiertas = [s for s in solicitudes.de_solicitante(solicitante_id)
                if s.estado in solicitudes.ABIERTOS and colectivo in (None, s.colectivo)]
    zonas = {solicitante.zona_id: directorio.zona(solicitante.zona_id).nombre}
    return Lectura(etiqueta=_vista(solicitante, zonas, codigo(solicitante_id)), solicitudes=abiertas)


def _de_codigo(texto: str) -> UUID:
    numero = dominio.numero(texto)
    if numero is None:
        raise NoEncontrado("Ese código no es de EcoConecta: revisa los números o escanea el QR.")
    with transaccion() as c:
        solicitante_id = c.execute(select(t.codigos.c.solicitante_id).where(t.codigos.c.numero == numero)).scalar()
    if solicitante_id is None:
        raise NoEncontrado(f"No hay un hogar con el código {texto.strip()}.")
    return solicitante_id


def _codigos(ids: list[UUID]) -> dict[UUID, str]:
    """Numera a quien no tiene, en el orden dado. Con el candado, dos pantallas que piden a la vez no gastan
    números del consecutivo: la segunda espera y ya los encuentra."""
    with transaccion() as c:
        ya = select(t.codigos.c.solicitante_id).where(t.codigos.c.solicitante_id.in_(ids))
        if len(set(c.execute(ya).scalars())) < len(set(ids)):
            c.execute(text("SELECT pg_advisory_xact_lock(4208)"))
            tienen = set(c.execute(ya).scalars())
            nuevos = [{"solicitante_id": i, "numero": t.consecutivo.next_value()}
                      for i in dict.fromkeys(ids) if i not in tienen]
            if nuevos:
                c.execute(insert(t.codigos).values(nuevos))
        filas = c.execute(select(t.codigos).where(t.codigos.c.solicitante_id.in_(ids))).all()
    return {fila.solicitante_id: dominio.codigo(fila.numero) for fila in filas}


def _vista(s: directorio.SolicitanteVista, zonas: dict[UUID, str], codigo_hogar: str) -> EtiquetaVista:
    return EtiquetaVista(solicitante_id=s.id, nombre=s.nombre, tipo=s.tipo, zona=zonas.get(s.zona_id, ""),
                         habilitado=s.estado == directorio.EstadoSolicitante.HABILITADO, contenido=contenido(s.id),
                         codigo=codigo_hogar)
