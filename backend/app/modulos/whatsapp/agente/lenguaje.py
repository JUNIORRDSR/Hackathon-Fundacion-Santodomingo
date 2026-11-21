"""Minimiza los datos enviados a Azure y reconoce intentos explícitos de cambiar sus reglas."""
import re
from unicodedata import combining, normalize


INTENCIONES = (
    "saludo", "recoleccion", "organico", "reciclable", "estado", "puntos", "canjes", "aprender",
    "aprender_organico", "aprender_reciclable", "informacion", "desconocido",
)
_DOMINIO = frozenset((
    "ecoconecta servicio proyecto recoleccion recoger recogen recojan recolectar recolectan recolector "
    "organico organicos organica organicas reciclaje reciclar reciclable reciclables residuo residuos material "
    "materiales compost compostaje cascara cascaras fruta frutas verdura verduras restos basura desechos bolsa "
    "carton cajas caja papel vidrio plastico botellas botella latas lata estado solicitud solicitudes pedido "
    "pedidos recogeran pendiente programaron programada programado agenda punto puntos saldo acumulados "
    "canje canjes canjear premio premios recompensas aprender separar separacion clasificar guia guias "
    "funciona ofrecen reciben aceptan sirve tutorial manana tarde noche"
).split())
_CONTEXTO = frozenset((
    "a al con donde cuando como cual cuales que si no nunca sin solo tampoco ni o y el la los las me mis mi "
    "quiero quisiera necesito solicito solicitar pedir pido puedo puedes pueden saber ver consultar consulta tengo "
    "pasan haran hacen hacer es son cuanto cuantos queda quedan quedo llevo disponibles ayuda hola buenas"
).split())
_DATOS_PRIVADOS = frozenset((
    "direccion calle carrera avenida diagonal transversal barrio manzana apartamento torre lote bloque "
    "urbanizacion porteria telefono celular numero correo whatsapp contacto coordenadas ubicacion "
    "nombre apellido llamo alias cedula documento identificacion identidad cancelar cancelacion anular"
).split())
_DATO_EXPLICITO = re.compile(r"\d|@|://|\b[a-z0-9-]+\.[a-z]{2,}\b")
_INSTRUCCIONES_AJENAS = re.compile(
    r"\b(?:ignor\w*|olvid\w*|omit\w*|salt\w*|revel\w*|muestr\w*|repet\w*|copi\w*)\b.{0,65}"
    r"\b(?:instrucciones|reglas internas|prompt|guardrails|sistema)\b"
    r"|\b(?:system prompt|jailbreak|modo desarrollador|actua como administrador)\b"
)


def normalizar(texto: str) -> str:
    """Omite tildes para poder entender respuestas escritas o transcritas."""
    normalizado = normalize("NFKD", texto.casefold())
    return "".join(letra for letra in normalizado if not combining(letra))


def intenta_cambiar_reglas(texto: str) -> bool:
    return bool(_INSTRUCCIONES_AJENAS.search(" ".join(normalizar(texto).split())))


def para_azure(texto: str, memoria: dict) -> str:
    """Conserva vocabulario del servicio. Los flujos en curso se resuelven en el backend."""
    if len(texto) > 160 or {"pidiendo", "canjeando", "esperando_flujo"}.intersection(memoria):
        return ""
    limpio = normalizar(texto)
    if _DATO_EXPLICITO.search(limpio):
        return ""
    palabras = re.findall(r"[a-z]+", limpio)
    if _DATOS_PRIVADOS.intersection(palabras) or not _DOMINIO.intersection(palabras):
        return ""
    return " ".join(palabra for palabra in palabras if palabra in _DOMINIO or palabra in _CONTEXTO)
