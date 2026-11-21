"""La historia de demostración (SEMBRAR_HISTORIA=1): llena hoy, los meses pasados y los canjes, una sola vez.
Corre dentro de una transacción que se deshace al final, para no cambiar lo que ven las demás pruebas."""
from datetime import datetime

import pytest
from sqlalchemy import func, select

from app import semillas, semillas_historia
from app.main import app  # noqa: F401  crea las tablas y siembra lo básico, como al arrancar
from app.compartido import bd
from app.compartido.formato import HORA_COLOMBIA
from app.modulos.puntos import tablas as tp
from app.modulos.solicitudes import tablas as ts


class Deshacer(Exception):
    pass


def test_siembra_la_historia_una_sola_vez():
    semillas.sembrar()
    hoy, s = datetime.now(HORA_COLOMBIA).date(), ts.solicitudes.c
    with pytest.raises(Deshacer), bd.transaccion() as c:
        semillas_historia.sembrar()

        def contar(tabla, *condiciones):
            return c.execute(select(func.count()).select_from(tabla).where(*condiciones)).scalar()

        total = contar(ts.solicitudes)
        assert contar(ts.solicitudes, s.dia == hoy) >= 30  # el cronograma de hoy, de los dos colectivos
        assert contar(ts.solicitudes, s.dia < hoy, s.estado == "programada") >= 6  # kilos por validar desde ayer
        assert contar(ts.solicitudes, s.estado == "recolectada", s.dia < hoy) > 300  # tres meses para los informes
        assert contar(ts.solicitudes, s.estado == "recibida") >= 10  # esperan asignación
        assert contar(tp.canjes, tp.canjes.c.estado == "pedido") > 0
        semillas_historia.sembrar()  # la segunda vez no repite nada
        assert contar(ts.solicitudes) == total
        raise Deshacer
