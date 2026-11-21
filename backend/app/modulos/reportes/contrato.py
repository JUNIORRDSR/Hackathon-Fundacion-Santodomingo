"""Contrato de reportes: solo lee los contratos de los demás. El CSV no lleva datos personales; el desglose por
vecino muestra su nombre solo a la coordinación que ya lo atiende (RN-07)."""
import csv
import io
from collections import defaultdict
from datetime import date
from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel

from app.compartido.formato import dia_local
from app.compartido.tipos import Colectivo, Flujo
from app.modulos.directorio import contrato as directorio
from app.modulos.puntos import contrato as puntos
from app.modulos.solicitudes import contrato as solicitudes


class Fila(BaseModel):
    flujo: Flujo
    estado: solicitudes.Estado
    cantidad: int
    kg: Decimal


class Agrupacion(StrEnum):
    CONJUNTO = "conjunto"
    ZONA = "zona"
    ENCARGADO = "encargado"
    VECINO = "vecino"


class FilaDesglose(BaseModel):
    nombre: str
    solicitudes: int
    recolecciones: int
    kg: Decimal
    puntos: int


class KilosDelDia(BaseModel):
    dia: date
    kg: Decimal


class Resumen(BaseModel):
    desde: date
    hasta: date
    total_solicitudes: int
    total_kg: Decimal
    filas: list[Fila]
    recolecciones: int = 0
    vecinos: int = 0
    puntos: int = 0
    por_dia: list[KilosDelDia] = []


def resumen(desde: date, hasta: date, colectivo: Colectivo | None = None) -> Resumen:
    """Resumen por flujo, estado y periodo (§5.6). Los kilos suman las recolecciones pesadas."""
    lista = _en_periodo(desde, hasta, colectivo)
    grupos, kilos = defaultdict(list), defaultdict(Decimal)
    for s in lista:
        grupos[(s.flujo, s.estado)].append(s)
        if s.kg:
            kilos[s.dia or dia_local(s.recibida)] += s.kg
    filas = [Fila(flujo=f, estado=e, cantidad=len(g), kg=sum((s.kg or Decimal(0) for s in g), Decimal(0)))
             for (f, e), g in sorted(grupos.items())]
    ganados = puntos.puntos_por_codigo()
    return Resumen(desde=desde, hasta=hasta, total_solicitudes=len(lista),
                   total_kg=sum((f.kg for f in filas), Decimal(0)), filas=filas,
                   recolecciones=sum(1 for s in lista if s.estado == "recolectada"),
                   vecinos=len({s.solicitante_id for s in lista}), puntos=sum(ganados.get(s.codigo, 0) for s in lista),
                   por_dia=[KilosDelDia(dia=d, kg=k) for d, k in sorted(kilos.items())])


def desglose(desde: date, hasta: date, colectivo: Colectivo | None, por: Agrupacion) -> list[FilaDesglose]:
    """RF-18: cuánto se pidió, se recolectó y se pesó en el periodo, por grupo y de mayor a menor en kilos."""
    clave = _clave_de(por)
    grupos = defaultdict(list)
    for s in _en_periodo(desde, hasta, colectivo):
        grupos[clave(s)].append(s)
    ganados = puntos.puntos_por_codigo()
    filas = [FilaDesglose(nombre=nombre, solicitudes=len(g),
                          recolecciones=sum(1 for s in g if s.estado == "recolectada"),
                          kg=sum((s.kg or Decimal(0) for s in g), Decimal(0)),
                          puntos=sum(ganados.get(s.codigo, 0) for s in g)) for nombre, g in grupos.items()]
    return sorted(filas, key=lambda f: (-f.kg, f.nombre))


def _clave_de(por: Agrupacion):
    if por == Agrupacion.ENCARGADO:
        nombres = {e.id: e.nombre for e in directorio.encargados()}
        return lambda s: nombres.get(s.encargado_id, "Sin asignar")
    if por == Agrupacion.VECINO:
        return lambda s: s.solicitante_nombre
    if por == Agrupacion.ZONA:
        return lambda s: s.zona
    return lambda s: s.conjunto or s.zona


def csv_de_solicitudes(desde: date, hasta: date, colectivo: Colectivo | None = None) -> str:
    """Una fila por solicitud, sin nombre, teléfono ni dirección; el conjunto sirve para la tarifa multiusuario."""
    salida = io.StringIO("﻿")
    salida.seek(0, io.SEEK_END)
    escritor = csv.writer(salida, delimiter=";")
    escritor.writerow(["codigo", "flujo", "estado", "zona", "conjunto", "canal", "recibida", "dia", "kg"])
    for s in _en_periodo(desde, hasta, colectivo):
        escritor.writerow([s.codigo, s.flujo, s.estado, s.zona, s.conjunto or "", s.canal,
                           dia_local(s.recibida), s.dia or "", str(s.kg or "").replace(".", ",")])
    return salida.getvalue()


def _en_periodo(desde: date, hasta: date, colectivo: Colectivo | None) -> list[solicitudes.SolicitudVista]:
    return [s for s in solicitudes.bandeja(colectivo) if desde <= dia_local(s.recibida) <= hasta]
