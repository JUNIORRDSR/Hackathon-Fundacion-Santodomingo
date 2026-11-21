"""El monitor recibe cambios confirmados y conserva el estado de lectura por usuario."""
import asyncio
from contextlib import aclosing
from uuid import uuid4

from fastapi.testclient import TestClient

from app.compartido.bd import transaccion
from app.main import app
from app.modulos.whatsapp.eventos_monitor import GENERAL, LECTURA, EventosMonitor, notificar


def test_stream_del_monitor_requiere_sesion():
    assert TestClient(app).get("/api/whatsapp/eventos").status_code == 401


def test_notifica_solo_despues_del_commit_y_las_lecturas_son_individuales():
    asyncio.run(_probar_eventos())


async def _probar_eventos():
    eventos = EventosMonitor()
    lector, otro = uuid4(), uuid4()
    try:
        async with aclosing(eventos.flujo(lector)) as primero, aclosing(eventos.flujo(otro)) as segundo:
            assert (await anext(primero)).startswith(":")
            assert (await anext(segundo)).startswith(":")
            assert await asyncio.wait_for(anext(primero), 5) == GENERAL
            assert await asyncio.wait_for(anext(segundo), 5) == GENERAL
            await asyncio.to_thread(_revertir)
            await asyncio.to_thread(_confirmar, lector)
            assert await asyncio.wait_for(anext(primero), 5) == LECTURA
            siguiente = asyncio.create_task(anext(segundo))
            entregados, _ = await asyncio.wait({siguiente}, timeout=0.1)
            assert not entregados
            await asyncio.to_thread(_confirmar)
            assert await asyncio.wait_for(siguiente, 5) == GENERAL
    finally:
        await eventos.cerrar()


def _confirmar(lector=None):
    with transaccion() as c:
        notificar(c, lector)


def _revertir():
    class RevertirPrueba(Exception):
        pass

    try:
        with transaccion() as c:
            notificar(c)
            raise RevertirPrueba
    except RevertirPrueba:
        pass
