"""Eventos de dominio y bus en memoria (ADR-0001).

- suscribir: el manejador corre dentro de la operación; si falla, falla todo (por ejemplo, puntos).
- suscribir_despues: efectos hacia afuera (WhatsApp); un fallo se registra y no tumba la operación.
"""
import logging
from collections import defaultdict
from collections.abc import Callable
from datetime import datetime, timezone

from pydantic import BaseModel, Field

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
    # ponytail: «después» corre en el acto; con Postgres se difiere al commit de la sesión.
    for manejador in _despues[type(evento)]:
        try:
            manejador(evento)
        except Exception:
            log.exception("Falló %s con %s", getattr(manejador, "__name__", manejador), type(evento).__name__)
