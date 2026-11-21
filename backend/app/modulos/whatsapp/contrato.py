"""Contrato de whatsapp (ADR-0003): los puertos Transporte (Jorge) y Conversador (Leonardo) y las Herramientas del bot.
El registro y la autorización de datos no pasan por el conversador: son deterministas (Ley 1581)."""
from datetime import date, time
from typing import Protocol
from uuid import UUID

from pydantic import BaseModel, Field

from app.compartido.tipos import Canal, Flujo, Franja, NoEncontrado
from app.modulos.contenidos import contrato as contenidos
from app.modulos.directorio import contrato as directorio
from app.modulos.puntos import contrato as puntos
from app.modulos.solicitudes import contrato as solicitudes


class MensajeEntrante(BaseModel):
    telefono: str = Field(pattern=directorio.TELEFONO)  # E.164: el transporte le quita el «whatsapp:»
    texto: str = Field("", max_length=2000)
    media_url: str | None = None


class MensajeSaliente(BaseModel):
    telefono: str
    texto: str
    media_url: str | None = None


class Transporte(Protocol):
    """Lo implementa Jorge (Twilio o Cloud API). Su webhook convierte lo que llega en MensajeEntrante y llama a
    bot.recibir; todo lo que sale pasa por enviar."""

    def enviar(self, mensaje: MensajeSaliente) -> None: ...


class Turno(BaseModel):
    """Lo que el conversador sabe de cada mensaje: ni teléfono ni dirección (§9: datos mínimos al modelo)."""

    nombre: str
    texto: str
    media_url: str | None = None


class Respuesta(BaseModel):
    textos: list[str]
    memoria: dict = {}  # estado de la conversación; el sistema lo guarda por número


class SolicitudResumida(BaseModel):
    """Lo que el bot ve de una solicitud: sin datos personales."""

    codigo: str
    flujo: Flujo
    estado: solicitudes.Estado
    dia: date | None
    hora: time | None


class Herramientas:
    """Lo único que el bot puede hacer; la identidad la ata el sistema, no el modelo (§9).
    El diálogo ejecuta estas operaciones. La coordinación asigna, programa y cierra las solicitudes."""

    def __init__(self, solicitante_id: UUID):
        self._id = solicitante_id

    def pedir_recoleccion(self, flujo: Flujo, preferencia: Franja, observaciones: str = "",
                          foto_url: str | None = None) -> SolicitudResumida:
        """Registra una solicitud, con la foto si la mandó. ErrorDeNegocio si ya hay una abierta del mismo flujo."""
        nueva = solicitudes.NuevaSolicitud(solicitante_id=self._id, flujo=flujo, preferencia=preferencia,
                                           observaciones=observaciones, canal=Canal.WHATSAPP, foto_url=foto_url)
        return _resumir(solicitudes.registrar(nueva))

    def mis_solicitudes(self) -> list[SolicitudResumida]:
        return [_resumir(s) for s in solicitudes.de_solicitante(self._id)]

    def cancelar(self, codigo: str) -> SolicitudResumida:
        solicitud = solicitudes.por_codigo(codigo)
        if solicitud.solicitante_id != self._id:
            raise NoEncontrado(f"No existe la solicitud {codigo}.")
        cancelada = solicitudes.cancelar(solicitud.id, "La canceló el solicitante por WhatsApp.", por="solicitante")
        return _resumir(cancelada)

    def mis_puntos(self) -> int:
        """Lo disponible: el saldo menos lo apartado en canjes por entregar."""
        return puntos.disponible(self._id)

    def aprender(self, flujo: Flujo | None = None) -> list[contenidos.ContenidoVista]:
        return contenidos.capacitacion_publica(flujo)

    def premios(self) -> list[puntos.PremioVista]:
        return puntos.premios(solo_activos=True)

    def pedir_canje(self, premio_id: UUID) -> puntos.CanjeVista:
        """Aparta los puntos y da el código que se muestra en la huerta. ErrorDeNegocio si no le alcanza."""
        return puntos.pedir(self._id, premio_id)


class Conversador(Protocol):
    """Recibe el turno y la memoria. Actúa con las herramientas y devuelve textos y estado."""

    def responder(self, turno: Turno, memoria: dict, herramientas: Herramientas) -> Respuesta: ...


def _resumir(s: solicitudes.SolicitudVista) -> SolicitudResumida:
    return SolicitudResumida(codigo=s.codigo, flujo=s.flujo, estado=s.estado, dia=s.dia, hora=s.hora)
