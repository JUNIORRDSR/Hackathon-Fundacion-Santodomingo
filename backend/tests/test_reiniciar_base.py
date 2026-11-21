"""Publicar la base (deploy/azure.sh con REINICIAR_BASE=1): borra una sola vez por sello y la app vuelve a sembrar."""
from app import semillas
from app.compartido import bd
from app.modulos.directorio import contrato as directorio


def test_un_sello_reinicia_la_base_una_sola_vez(monkeypatch):
    assert directorio.zonas()
    monkeypatch.setenv("REINICIAR_BASE", "prueba-20261120")
    assert bd.reiniciar_si_se_pidio() is True
    bd.crear_tablas()
    assert directorio.zonas() == []  # los esquemas quedaron vacíos
    semillas.sembrar()
    assert directorio.zonas()
    assert bd.reiniciar_si_se_pidio() is False  # el mismo sello no vuelve a borrar
    monkeypatch.delenv("REINICIAR_BASE")
    assert bd.reiniciar_si_se_pidio() is False
