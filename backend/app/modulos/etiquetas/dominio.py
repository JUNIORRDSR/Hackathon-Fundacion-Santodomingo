"""El QR de la bolsa: un prefijo con versión y el ID del hogar o negocio, sin datos personales (ADR-0015)."""
from uuid import UUID

PREFIJO = "EC1:"


def contenido(solicitante_id: UUID) -> str:
    return f"{PREFIJO}{solicitante_id}"


def leer(texto: str) -> UUID | None:
    """El ID que lleva la etiqueta, o None si el código no es de EcoConecta."""
    valor = texto.strip()
    if not valor.upper().startswith(PREFIJO):
        return None
    try:
        return UUID(valor[len(PREFIJO):])
    except ValueError:
        return None
