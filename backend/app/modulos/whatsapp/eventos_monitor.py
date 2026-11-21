"""Notificaciones del monitor después de confirmar los cambios en PostgreSQL."""
import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from threading import Event, Thread
from uuid import UUID

import psycopg
from fastapi import FastAPI
from sqlalchemy import Connection, func, select

from app.compartido.bd import motor

CANAL = "ecoconecta_whatsapp_monitor"
GENERAL = 'event: cambio\ndata: {"solo_lista":false}\n\n'
LECTURA = 'event: cambio\ndata: {"solo_lista":true}\n\n'
log = logging.getLogger("whatsapp.monitor")


def notificar(c: Connection, usuario_id: UUID | None = None) -> None:
    """PostgreSQL entrega el aviso únicamente si la transacción se confirma."""
    c.execute(select(func.pg_notify(CANAL, str(usuario_id) if usuario_id else "")))


class EventosMonitor:
    """Una conexión a PostgreSQL por proceso y un aviso pendiente por cliente SSE."""

    def __init__(self) -> None:
        self._loop = asyncio.get_running_loop()
        self._fin = Event()
        self._clientes: dict[asyncio.Queue[bool], str] = {}
        self._hilo = Thread(target=self._escuchar, name="whatsapp-listen", daemon=True)
        self._hilo.start()

    async def cerrar(self) -> None:
        self._fin.set()
        await asyncio.to_thread(self._hilo.join, 6)

    async def flujo(self, usuario_id: UUID) -> AsyncIterator[str]:
        cola: asyncio.Queue[bool] = asyncio.Queue(maxsize=1)
        self._clientes[cola] = str(usuario_id)
        try:
            yield ": conectado\n\n"
            while True:
                try:
                    solo_lista = await asyncio.wait_for(cola.get(), timeout=15)
                except TimeoutError:
                    yield ": mantener conexión\n\n"
                else:
                    yield LECTURA if solo_lista else GENERAL
        finally:
            self._clientes.pop(cola, None)

    def _escuchar(self) -> None:
        dsn = motor().url.set(drivername="postgresql").render_as_string(hide_password=False)
        while not self._fin.is_set():
            try:
                with psycopg.connect(dsn, autocommit=True, connect_timeout=5) as conexion:
                    conexion.execute("LISTEN " + CANAL)
                    self._publicar("")  # Recupera cambios durante la desconexión de PostgreSQL.
                    while not self._fin.is_set():
                        for aviso in conexion.notifies(timeout=1, stop_after=1):
                            self._publicar(aviso.payload)
            except psycopg.Error as error:
                log.warning("Escucha de WhatsApp interrumpida (%s)", type(error).__name__)
                self._fin.wait(2)

    def _publicar(self, usuario: str) -> None:
        if not self._fin.is_set():
            self._loop.call_soon_threadsafe(self._repartir, usuario)

    def _repartir(self, usuario: str) -> None:
        for cola, destinatario in self._clientes.items():
            if usuario and usuario != destinatario:
                continue
            anterior = cola.get_nowait() if cola.full() else True
            cola.put_nowait(anterior and bool(usuario))


@asynccontextmanager
async def ciclo_eventos(app: FastAPI) -> AsyncIterator[None]:
    eventos = EventosMonitor()
    app.state.eventos_whatsapp = eventos
    try:
        yield
    finally:
        await eventos.cerrar()
