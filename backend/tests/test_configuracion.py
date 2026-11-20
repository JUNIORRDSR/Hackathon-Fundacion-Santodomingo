"""En producción no hay claves por defecto: con una clave publicada se podría falsificar una sesión (ADR-0004)."""
import pytest

from app.compartido.configuracion import variable


def test_en_produccion_una_variable_que_falta_detiene_el_arranque(monkeypatch):
    monkeypatch.setenv("ENTORNO", "produccion")
    monkeypatch.delenv("CLAVE_SESION", raising=False)
    with pytest.raises(RuntimeError, match="CLAVE_SESION"):
        variable("CLAVE_SESION", "solo-para-desarrollo-local")


def test_en_local_se_usa_el_valor_de_desarrollo_y_si_existe_manda_el_entorno(monkeypatch):
    monkeypatch.setenv("ENTORNO", "local")
    monkeypatch.delenv("CLAVE_DEMO", raising=False)
    assert variable("CLAVE_DEMO", "ecoconecta-demo") == "ecoconecta-demo"
    monkeypatch.setenv("CLAVE_DEMO", "otra-clave")
    assert variable("CLAVE_DEMO", "ecoconecta-demo") == "otra-clave"
