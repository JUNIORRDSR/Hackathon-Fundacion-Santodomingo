"""El contenido del QR de la bolsa (ADR-0015): ida y vuelta, y cualquier otro código no se toma por etiqueta."""
from uuid import uuid4

import pytest

from app.modulos.etiquetas.dominio import contenido, leer


def test_la_etiqueta_lleva_solo_el_id_del_hogar():
    solicitante_id = uuid4()
    assert contenido(solicitante_id) == f"EC1:{solicitante_id}"
    assert leer(contenido(solicitante_id)) == solicitante_id
    assert leer(f"  ec1:{str(solicitante_id).upper()}\n") == solicitante_id  # la cámara no siempre respeta mayúsculas


@pytest.mark.parametrize("texto", ["", "ORG-0042", "https://ecoconecta.co", "EC1:", "EC1:no-es-un-id", "EC2:1234"])
def test_otros_codigos_no_son_etiquetas(texto):
    assert leer(texto) is None
