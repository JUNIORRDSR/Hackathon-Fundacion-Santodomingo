"""La etiqueta de la bolsa, sin datos personales (ADR-0015): el QR lleva el ID del hogar y, si no hay sticker, se
escribe a mano su código, un número corto con dígito verificador."""
import re
from uuid import UUID

PREFIJO = "EC1:"


def contenido(solicitante_id: UUID) -> str:
    return f"{PREFIJO}{solicitante_id}"


def leer(texto: str) -> UUID | None:
    """El ID que lleva el QR, o None si no es una etiqueta de EcoConecta."""
    valor = texto.strip()
    if not valor.upper().startswith(PREFIJO):
        return None
    try:
        return UUID(valor[len(PREFIJO):])
    except ValueError:
        return None


def codigo(numero: int) -> str:
    """El código para escribir a mano: el número del hogar y, al final, su dígito verificador."""
    return f"{numero}{_verificador(str(numero))}"


def numero(texto: str) -> int | None:
    """El número del hogar si el código escrito cuadra; None si no es un código o hay un dígito mal copiado."""
    digitos = re.sub(r"[\s-]", "", texto)
    if not re.fullmatch(r"[0-9]{4,8}", digitos) or _verificador(digitos[:-1]) != digitos[-1]:
        return None
    return int(digitos[:-1])


def _verificador(cuerpo: str) -> str:
    """Luhn: delata cualquier dígito mal copiado y casi cualquier par de dígitos seguidos cambiados de orden."""
    total = 0
    for posicion, digito in enumerate(reversed(cuerpo)):
        valor = int(digito) * (2 if posicion % 2 == 0 else 1)
        total += valor - 9 if valor > 9 else valor
    return str(-total % 10)
