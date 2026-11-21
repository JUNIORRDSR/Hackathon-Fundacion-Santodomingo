"""Núcleo compartido: los nombres que todos los módulos usan igual.

Solo cambia con acuerdo del equipo (núcleo compartido, Evans cap. 14). Ver docs/GLOSARIO.md.
"""
from enum import StrEnum


class Flujo(StrEnum):
    ORGANICO = "organico"
    RECICLABLE = "reciclable"


class Colectivo(StrEnum):
    HUERTEROS = "huerteros"
    RECICLADORES = "recicladores"


# RN-01: cada flujo llega a su colectivo.
COLECTIVO_DEL_FLUJO = {Flujo.ORGANICO: Colectivo.HUERTEROS, Flujo.RECICLABLE: Colectivo.RECICLADORES}


class TipoGenerador(StrEnum):
    HOGAR = "hogar"
    UNIDAD_PRODUCTIVA = "unidad_productiva"


class Franja(StrEnum):
    """Preferencia horaria del solicitante."""

    MANANA = "manana"
    TARDE = "tarde"
    NOCHE = "noche"


class Canal(StrEnum):
    """Por dónde entró la solicitud (ADR-0003)."""

    WHATSAPP = "whatsapp"
    ASISTIDO = "asistido"
    SIMULADOR = "simulador"
    HUERTA = "huerta"  # entrega directa en la huerta o el punto de acopio (RF-05)


class ErrorDeNegocio(Exception):
    """Una regla del dominio impide la operación. La API responde 409 con el mensaje."""


class NoEncontrado(Exception):
    """No existe lo que se pidió. La API responde 404."""
