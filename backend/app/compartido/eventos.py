"""Eventos de dominio y bus en memoria (ADR-0001).

- suscribir: el manejador corre dentro de la operación y de su transacción; si falla, falla todo (puntos).
- suscribir_despues: efectos hacia afuera (WhatsApp). Corren después del commit y un fallo se registra sin tumbar nada.
"""
import logging
from collections import defaultdict
from collections.abc import Callable
from datetime import datetime, timezone
from functools import partial

from pydantic import BaseModel, Field

from app.compartido import bd

log = logging.getLogger("eventos")


class Evento(BaseModel):
    ocurrido: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


_dentro: dict[type, list[Callable]] = defaultdict(list)
_despues: dict[type, list[Callable]] = defaultdict(list)


def suscribir(tipo: type[Evento], manejador: Callable) -> None:
    if manejador not in _dentro[tipo]:
        _dentro[tipo].append(manejador)


def suscribir_despues(tipo: type[Evento], manejador: Callable) -> None:
    if manejador not in _despues[tipo]:
        _despues[tipo].append(manejador)


def publicar(evento: Evento) -> None:
    for manejador in _dentro[type(evento)]:
        manejador(evento)
    for manejador in _despues[type(evento)]:
        efecto = partial(_sin_tumbar, manejador, evento)
        if not bd.despues_del_commit(efecto):
            efecto()


def _sin_tumbar(manejador: Callable, evento: Evento) -> None:
    try:
        manejador(evento)
    except Exception:
        log.exception("Falló %s con %s", getattr(manejador, "__name__", manejador), type(evento).__name__)
