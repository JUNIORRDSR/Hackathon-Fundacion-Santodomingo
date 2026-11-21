"""Contrato de etiquetas: un QR por hogar o negocio que, al pesar, lleva a su solicitud abierta (ADR-0015).
No guarda nada propio: compone directorio y solicitudes por sus contratos."""
from uuid import UUID

from pydantic import BaseModel

from app.compartido.tipos import Colectivo, NoEncontrado, TipoGenerador
from app.modulos.directorio import contrato as directorio
from app.modulos.etiquetas import dominio
from app.modulos.solicitudes import contrato as solicitudes

contenido = dominio.contenido


class EtiquetaVista(BaseModel):
    """Lo que va impreso en el sticker: sin teléfono ni dirección."""

    solicitante_id: UUID
    nombre: str
    tipo: TipoGenerador
    zona: str
    habilitado: bool
    contenido: str


class Lectura(BaseModel):
    etiqueta: EtiquetaVista
    solicitudes: list[solicitudes.SolicitudVista]  # las abiertas que puede ver quien escanea


def etiquetas() -> list[EtiquetaVista]:
    """Una por hogar o negocio habilitado, para imprimirlas en hojas de stickers."""
    zonas = {zona.id: zona.nombre for zona in directorio.zonas()}
    return [_vista(s, zonas) for s in directorio.solicitantes(directorio.EstadoSolicitante.HABILITADO)]


def leer(texto: str, colectivo: Colectivo | None) -> Lectura:
    """El hogar de la etiqueta y sus solicitudes abiertas del colectivo; None las trae todas (administrador)."""
    solicitante_id = dominio.leer(texto)
    if solicitante_id is None:
        raise NoEncontrado("Ese código no es una etiqueta de EcoConecta.")
    solicitante = directorio.solicitante(solicitante_id)
    abiertas = [s for s in solicitudes.de_solicitante(solicitante_id)
                if s.estado in solicitudes.ABIERTOS and colectivo in (None, s.colectivo)]
    zonas = {solicitante.zona_id: directorio.zona(solicitante.zona_id).nombre}
    return Lectura(etiqueta=_vista(solicitante, zonas), solicitudes=abiertas)


def _vista(s: directorio.SolicitanteVista, zonas: dict[UUID, str]) -> EtiquetaVista:
    return EtiquetaVista(solicitante_id=s.id, nombre=s.nombre, tipo=s.tipo, zona=zonas.get(s.zona_id, ""),
                         habilitado=s.estado == directorio.EstadoSolicitante.HABILITADO, contenido=contenido(s.id))
