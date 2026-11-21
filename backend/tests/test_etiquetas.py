"""La etiqueta de la bolsa (ADR-0015): el QR va y vuelve, y el código escrito delata los dígitos mal copiados."""
from uuid import uuid4

import pytest

from app.modulos.etiquetas.dominio import codigo, contenido, leer, numero


def test_la_etiqueta_lleva_solo_el_id_del_hogar():
    solicitante_id = uuid4()
    assert contenido(solicitante_id) == f"EC1:{solicitante_id}"
    assert leer(contenido(solicitante_id)) == solicitante_id
    assert leer(f"  ec1:{str(solicitante_id).upper()}\n") == solicitante_id  # la cámara no siempre respeta mayúsculas


@pytest.mark.parametrize("texto", ["", "ORG-0042", "https://ecoconecta.co", "EC1:", "EC1:no-es-un-id", "EC2:1234"])
def test_otros_codigos_no_son_etiquetas(texto):
    assert leer(texto) is None


def test_el_codigo_escrito_lleva_digito_verificador():
    assert codigo(100) == "1008" and numero("1008") == 100
    assert numero(" 10-08 ") == 100  # con espacios o guion, como lo copie cada quien
    assert all(numero(c) is None for c in ("1009", "1018", "0108", "1080"))  # un dígito o dos seguidos cambiados


@pytest.mark.parametrize("texto", ["", "100", "ORG-0042", "REC-0017", "EC1:1234", "１００８", "10a8"])
def test_lo_que_no_es_un_codigo_de_hogar(texto):
    assert numero(texto) is None
