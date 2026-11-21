"""Normaliza lo que escribe o dicta el vecino para el registro y el diálogo local."""
from unicodedata import combining, normalize


def normalizar(texto: str) -> str:
    """Omite tildes para poder entender respuestas escritas o transcritas."""
    normalizado = normalize("NFKD", texto.casefold())
    return "".join(letra for letra in normalizado if not combining(letra))
