"""Formato en español para mensajes y reportes. Colombia no tiene horario de verano: UTC-5 fijo."""
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal

from app.compartido.tipos import Flujo

HORA_COLOMBIA = timezone(timedelta(hours=-5))
NOMBRE_FLUJO = {Flujo.ORGANICO: "orgánicos", Flujo.RECICLABLE: "reciclables"}
_DIAS = ("lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo")
_MESES = ("enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre",
          "noviembre", "diciembre")


def fecha_larga(d: date) -> str:
    """2026-11-21 → «sábado 21 de noviembre»"""
    return f"{_DIAS[d.weekday()]} {d.day} de {_MESES[d.month - 1]}"


def hora_corta(t: time) -> str:
    """19:00 → «7:00 p. m.»"""
    return f"{t.hour % 12 or 12}:{t.minute:02d} {'a. m.' if t.hour < 12 else 'p. m.'}"


def kilos(kg: Decimal) -> str:
    """Decimal('2.50') → «2,5»"""
    return format(kg.normalize(), "f").replace(".", ",")


def dia_local(momento: datetime) -> date:
    return momento.astimezone(HORA_COLOMBIA).date()
