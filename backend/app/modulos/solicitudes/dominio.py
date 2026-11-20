"""La Solicitud: agregado del núcleo. Reglas puras: sin base de datos ni FastAPI (ADR-0001).

RECIBIDA → ASIGNADA → PROGRAMADA → RECOLECTADA | RECHAZADA; CANCELADA desde cualquier estado abierto.
"""
from dataclasses import dataclass, field
from datetime import date, datetime, time, timezone
from decimal import Decimal
from enum import StrEnum
from uuid import UUID, uuid4

from app.compartido.tipos import Canal, ErrorDeNegocio, Flujo, Franja


class Estado(StrEnum):
    RECIBIDA = "recibida"
    ASIGNADA = "asignada"
    PROGRAMADA = "programada"
    RECOLECTADA = "recolectada"
    RECHAZADA = "rechazada"
    CANCELADA = "cancelada"


ABIERTOS = frozenset({Estado.RECIBIDA, Estado.ASIGNADA, Estado.PROGRAMADA})
PREFIJO = {Flujo.ORGANICO: "ORG", Flujo.RECICLABLE: "REC"}


@dataclass
class Cambio:
    fecha: datetime
    estado: Estado
    por: str  # id del coordinador, o «solicitante»
    nota: str = ""


@dataclass
class Solicitud:
    codigo: str
    solicitante_id: UUID
    flujo: Flujo
    zona_id: UUID
    direccion: str
    preferencia: Franja
    observaciones: str
    canal: Canal
    id: UUID = field(default_factory=uuid4)
    estado: Estado = Estado.RECIBIDA
    encargado_id: UUID | None = None
    asignada_por: UUID | None = None  # RN-03: queda asociada al coordinador y al encargado
    dia: date | None = None
    hora: time | None = None
    kg: Decimal | None = None
    motivo: str = ""
    historial: list[Cambio] = field(default_factory=list)  # RN-04

    @classmethod
    def recibir(cls, por: str, **datos) -> "Solicitud":
        solicitud = cls(**datos)
        solicitud._anotar(por, f"por {solicitud.canal.value}")
        return solicitud

    def asignar(self, encargado_id: UUID, por: UUID) -> None:
        self._exigir(ABIERTOS, "asignar")
        self.encargado_id, self.asignada_por = encargado_id, por
        if self.estado == Estado.RECIBIDA:
            self.estado = Estado.ASIGNADA
        self._anotar(str(por), f"encargado {encargado_id}")

    def programar(self, dia: date, hora: time, por: UUID) -> None:
        # RN-02: no hay programación sin persona encargada, día y hora.
        self._exigir({Estado.ASIGNADA, Estado.PROGRAMADA}, "programar")
        self.dia, self.hora, self.estado = dia, hora, Estado.PROGRAMADA
        self._anotar(str(por), f"{dia.isoformat()} {hora.strftime('%H:%M')}")

    def registrar_recoleccion(self, kg: Decimal | None, por: UUID) -> None:
        self._exigir({Estado.PROGRAMADA}, "registrar la recolección de")
        if kg is not None and kg <= 0:
            raise ErrorDeNegocio("Los kilos deben ser mayores que cero.")
        self.kg, self.estado = kg, Estado.RECOLECTADA
        self._anotar(str(por), "sin pesar" if kg is None else f"{kg} kg")

    def rechazar(self, motivo: str, por: UUID) -> None:
        self._exigir({Estado.PROGRAMADA}, "rechazar")
        self._cerrar(Estado.RECHAZADA, motivo, str(por))

    def cancelar(self, motivo: str, por: str) -> None:
        self._exigir(ABIERTOS, "cancelar")
        self._cerrar(Estado.CANCELADA, motivo, por)

    def _cerrar(self, estado: Estado, motivo: str, por: str) -> None:
        if not motivo.strip():
            raise ErrorDeNegocio("Hace falta un motivo.")
        self.estado, self.motivo = estado, motivo.strip()
        self._anotar(por, self.motivo)

    def _exigir(self, permitidos, accion: str) -> None:
        if self.estado not in permitidos:
            raise ErrorDeNegocio(f"No se puede {accion} una solicitud {self.estado.value}.")

    def _anotar(self, por: str, nota: str = "") -> None:
        self.historial.append(Cambio(datetime.now(timezone.utc), self.estado, por, nota))
