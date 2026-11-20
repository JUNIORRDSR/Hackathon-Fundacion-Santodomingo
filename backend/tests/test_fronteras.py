"""Falla si un módulo importa el interior de otro: entre módulos solo se cruza por contrato.py (ADR-0001)."""
import ast
from pathlib import Path

MODULOS = Path(__file__).resolve().parents[1] / "app" / "modulos"


def _destinos(nodo: ast.AST) -> list[str]:
    """Rutas importadas completas, por ejemplo app.modulos.directorio.contrato."""
    if isinstance(nodo, ast.Import):
        return [a.name for a in nodo.names]
    if isinstance(nodo, ast.ImportFrom) and nodo.module:
        return [f"{nodo.module}.{a.name}" for a in nodo.names]
    return []


def test_entre_modulos_solo_se_importa_el_contrato():
    violaciones = []
    for archivo in MODULOS.rglob("*.py"):
        propio = archivo.relative_to(MODULOS).parts[0]
        for nodo in ast.walk(ast.parse(archivo.read_text(encoding="utf-8"))):
            for destino in _destinos(nodo):
                partes = destino.split(".")
                ajeno = partes[:2] == ["app", "modulos"] and len(partes) > 2 and partes[2] != propio
                if ajeno and (len(partes) < 4 or partes[3] != "contrato"):
                    violaciones.append(f"{propio}/{archivo.name} importa {destino}")
    assert not violaciones, "\n".join(violaciones)


def test_el_dominio_no_conoce_frameworks():
    for archivo in MODULOS.rglob("dominio.py"):
        texto = archivo.read_text(encoding="utf-8")
        assert "fastapi" not in texto and "sqlalchemy" not in texto, archivo
