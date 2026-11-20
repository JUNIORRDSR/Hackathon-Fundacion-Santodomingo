"""Variables de entorno. En producción no hay valores por defecto: si falta una, la app no arranca (ADR-0004)."""
import os


def variable(nombre: str, valor_local: str) -> str:
    valor = os.getenv(nombre)
    if valor:
        return valor
    if os.getenv("ENTORNO") == "produccion":
        raise RuntimeError(f"Falta la variable de entorno {nombre}.")
    return valor_local
