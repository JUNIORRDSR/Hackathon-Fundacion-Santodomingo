"""Contrato de reportes: solo lee los contratos de los demás y no expone datos personales (RN-07)."""
import csv
import io
from collections import defaultdict
from datetime import date
from decimal import Decimal

from pydantic import BaseModel

from app.compartido.formato import dia_local
from app.compartido.tipos import Colectivo, Flujo
from app.modulos.directorio import contrato as directorio
from app.modulos.solicitudes import contrato as solicitudes


class Fila(BaseModel):
    flujo: Flujo
    estado: solicitudes.Estado
    cantidad: int
    kg: Decimal


class Resumen(BaseModel):
    desde: date
    hasta: date
    total_solicitudes: int
    total_kg: Decimal
    filas: list[Fila]


def resumen(desde: date, hasta: date, colectivo: Colectivo | None = None) -> Resumen:
    """Resumen por flujo, estado y periodo (§5.6). Los kilos suman las recolecciones pesadas."""
    grupos = defaultdict(list)
    for s in _en_periodo(desde, hasta, colectivo):
        grupos[(s.flujo, s.estado)].append(s)
    filas = [Fila(flujo=f, estado=e, cantidad=len(g), kg=sum((s.kg or Decimal(0) for s in g), Decimal(0)))
             for (f, e), g in sorted(grupos.items())]
    return Resumen(desde=desde, hasta=hasta, total_solicitudes=sum(f.cantidad for f in filas),
                   total_kg=sum((f.kg for f in filas), Decimal(0)), filas=filas)


def csv_de_solicitudes(desde: date, hasta: date, colectivo: Colectivo | None = None) -> str:
    """Una fila por solicitud, sin nombre, teléfono ni dirección."""
    salida = io.StringIO()
    escritor = csv.writer(salida)
    escritor.writerow(["codigo", "flujo", "estado", "zona", "canal", "recibida", "dia", "kg"])
    for s in _en_periodo(desde, hasta, colectivo):
        escritor.writerow([s.codigo, s.flujo, s.estado, directorio.zona(s.zona_id).nombre, s.canal,
                           dia_local(s.recibida), s.dia or "", s.kg or ""])
    return salida.getvalue()


def _en_periodo(desde: date, hasta: date, colectivo: Colectivo | None) -> list[solicitudes.SolicitudVista]:
    return [s for s in solicitudes.bandeja(colectivo) if desde <= dia_local(s.recibida) <= hasta]
