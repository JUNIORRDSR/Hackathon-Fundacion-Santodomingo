"""Reglas para revisar si los residuos de una foto están bien separados (ADR-0007): qué se le pide al modelo, cómo
se lee su respuesta y qué texto fijo recibe la persona. Solo librería estándar y núcleo compartido."""
import json
from enum import StrEnum
from typing import NamedTuple

from app.compartido.formato import NOMBRE_FLUJO
from app.compartido.tipos import Flujo


class Veredicto(StrEnum):
    BIEN_SEPARADO = "bien_separado"
    MAL_SEPARADO = "mal_separado"
    NO_CONCLUYENTE = "no_concluyente"  # foto borrosa u oscura, bolsa cerrada, no son residuos o error técnico


class Problema(StrEnum):
    """Lo que se le explica a la persona. Son texto: contenidos puede asociarles piezas sin importar este módulo."""

    ORGANICO_EN_RECICLABLES = "organico_en_reciclables"
    RECICLABLE_EN_ORGANICOS = "reciclable_en_organicos"
    ORDINARIO_MEZCLADO = "ordinario_mezclado"  # lo que no se recoge: papel higiénico, servilletas usadas, pañales
    ENVASES_SUCIOS = "envases_sucios"
    RESIDUO_PELIGROSO = "residuo_peligroso"
    FOTO_NO_VALIDA = "foto_no_valida"


class Lectura(NamedTuple):
    veredicto: Veredicto
    flujo: Flujo | None
    problemas: list[Problema]


# Código de colores de la Resolución 2184 de 2019. Qué orgánicos recibe la huerta (carne, huesos, lácteos) está por
# validar con ella: mientras tanto valen todos los restos de comida.
REGLAS = (
    "Revisas fotos de residuos para un programa comunitario de reciclaje en Barranquilla, Colombia. La persona va a "
    "entregar lo que se ve en la foto.\n"
    "- Reciclables: plástico, vidrio, metal, papel, cartón y cajas de bebidas, limpios y secos.\n"
    "- Orgánicos: restos de comida, cáscaras de frutas y verduras, cuncho de café y hojas.\n"
    "- Ordinarios, que no se recogen: papel higiénico, servilletas usadas, pañales y empaques sucios de comida.\n"
    "- Peligrosos, que no van con nada: pilas, medicamentos, jeringas y vidrio roto.\n"
    "Marca cada problema que veas: organico_en_reciclables (comida entre reciclables), reciclable_en_organicos "
    "(plástico, vidrio, metal o papel entre orgánicos), ordinario_mezclado, envases_sucios (reciclables con comida o "
    "líquido) y residuo_peligroso. Si la persona dijo qué va a entregar, compáralo con eso; si no, busca mezclas. "
    "Si la foto está borrosa u oscura, la bolsa está cerrada o no se ven residuos, marca foto_no_valida y no adivines. "
    "flujo_detectado es organico o reciclable, o null si hay mezcla o no se distingue."
)

ESQUEMA = {
    "type": "object",
    "properties": {
        "veredicto": {"type": "string", "enum": [v.value for v in Veredicto]},
        "flujo_detectado": {"anyOf": [{"type": "string", "enum": [f.value for f in Flujo]}, {"type": "null"}]},
        "problemas": {"type": "array", "items": {"type": "string", "enum": [p.value for p in Problema]}},
    },
    "required": ["veredicto", "flujo_detectado", "problemas"],
    "additionalProperties": False,
}

EXPLICACION = {
    Problema.ORGANICO_EN_RECICLABLES: "Hay restos de comida con los reciclables: la comida va con los orgánicos.",
    Problema.RECICLABLE_EN_ORGANICOS: "Hay plástico, vidrio, metal o papel con los orgánicos: eso va con los "
                                      "reciclables.",
    Problema.ORDINARIO_MEZCLADO: "Hay papel higiénico, servilletas usadas o pañales: eso va a la basura.",
    Problema.ENVASES_SUCIOS: "Hay envases sucios: enjuágalos y sécalos antes de entregarlos.",
    Problema.RESIDUO_PELIGROSO: "Hay algo peligroso, como vidrio roto, pilas o medicamentos: sepáralo y no lo "
                                "entregues con lo demás.",
}
BIEN_SEPARADO = "¡Muy bien! Tu bolsa se ve bien separada."
OTRA_FOTO = "No alcanzamos a ver bien tus residuos. Manda otra foto con la bolsa abierta y buena luz."
SIN_REVISAR = "Ahora no pudimos revisar la foto. Puedes pedir la recolección igual."
CIERRE = "Igual puedes pedir la recolección: quien la recoge revisa la bolsa."


def pedido(flujo: Flujo | None) -> str:
    """Lo único que acompaña la foto: el flujo, nunca datos de la persona (§9)."""
    if flujo is None:
        return "La persona no dijo qué va a entregar."
    return f"La persona dice que va a entregar {NOMBRE_FLUJO[flujo]}."


def leer(texto: str) -> Lectura:
    """Lee la respuesta del modelo. Levanta ValueError, KeyError o TypeError si no cumple el esquema."""
    datos = json.loads(texto)
    problemas = [Problema(p) for p in datos["problemas"]]
    flujo = Flujo(datos["flujo_detectado"]) if datos["flujo_detectado"] else None
    return Lectura(_coherente(Veredicto(datos["veredicto"]), problemas), flujo, problemas)


def mensaje(lectura: Lectura) -> str:
    if lectura.veredicto == Veredicto.BIEN_SEPARADO:
        return BIEN_SEPARADO
    if lectura.veredicto == Veredicto.NO_CONCLUYENTE:
        return OTRA_FOTO
    explicaciones = [EXPLICACION[p] for p in lectura.problemas if p in EXPLICACION]
    return "\n".join(["Revisamos tu foto y hay algo para mejorar:", *explicaciones, CIERRE])


def _coherente(veredicto: Veredicto, problemas: list[Problema]) -> Veredicto:
    """Si el modelo se contradice, mandan los problemas que vio."""
    if Problema.FOTO_NO_VALIDA in problemas:
        return Veredicto.NO_CONCLUYENTE
    return Veredicto.MAL_SEPARADO if problemas else veredicto
