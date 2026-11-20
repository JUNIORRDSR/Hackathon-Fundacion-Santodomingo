"""Alta por WhatsApp, determinista: autorización (Ley 1581), datos mínimos y primer pedido. Queda PENDIENTE (RN-08)."""
from app.compartido.formato import NOMBRE_FLUJO
from app.compartido.tipos import Flujo, Franja, TipoGenerador
from app.modulos.directorio import contrato as directorio

AUTORIZACION = ("¡Hola! Soy EcoConecta, de la Fundación Santo Domingo. Para coordinar tus recolecciones guardamos tu "
                "número, tu nombre, tu zona y tu dirección, y solo los usamos para eso. ¿Lo autorizas?\n1 Sí\n2 No")


def responder(texto: str, telefono: str, memoria: dict) -> list[str]:
    """Avanza un paso del registro; la memoria guarda en qué paso va y lo ya respondido."""
    return _PASOS[memoria.get("paso", "inicio")](texto.strip(), telefono, memoria)


def _inicio(texto: str, telefono: str, memoria: dict) -> list[str]:
    memoria["paso"] = "autorizacion"
    return [AUTORIZACION]


def _autorizacion(texto: str, telefono: str, memoria: dict) -> list[str]:
    if texto != "1":
        memoria.clear()
        return ["Sin tu autorización no podemos registrarte. Si cambias de opinión, escribe HOLA."]
    memoria["paso"] = "tipo"
    return ["¿Eres\n1 Hogar\n2 Negocio?"]


def _tipo(texto: str, telefono: str, memoria: dict) -> list[str]:
    if texto not in ("1", "2"):
        return ["Responde 1 si eres un hogar o 2 si eres un negocio."]
    tipo = TipoGenerador.HOGAR if texto == "1" else TipoGenerador.UNIDAD_PRODUCTIVA
    memoria.update(paso="zona", tipo=tipo.value)
    return [_menu_zonas()]


def _zona(texto: str, telefono: str, memoria: dict) -> list[str]:
    zonas = directorio.zonas()
    if not texto.isdigit() or not 1 <= int(texto) <= len(zonas):
        return [_menu_zonas()]
    memoria.update(paso="direccion", zona_id=str(zonas[int(texto) - 1].id))
    return ["Escribe tu dirección: torre y apartamento, o el nombre y la dirección del negocio."]


def _direccion(texto: str, telefono: str, memoria: dict) -> list[str]:
    if len(texto) < 3:
        return ["Escribe la dirección completa, por favor."]
    memoria.update(paso="nombre", direccion=texto[:120])
    return ["¿Cómo te llamamos?"]


PRIMER_FLUJO = "¿Qué quieres entregar primero?\n1 Orgánicos (restos de comida)\n2 Reciclables (papel, plástico, vidrio)"
FRANJAS = {"1": Franja.MANANA, "2": Franja.TARDE, "3": Franja.NOCHE}
NOMBRE_FRANJA = {Franja.MANANA: "en la mañana", Franja.TARDE: "en la tarde", Franja.NOCHE: "en la noche"}


def _nombre_o_alias(texto: str, telefono: str, memoria: dict) -> list[str]:
    if len(texto) < 2:
        return ["Escribe tu nombre o cómo quieres que te llamemos."]
    memoria.update(paso="primer_flujo", nombre=texto[:60])
    return [PRIMER_FLUJO]


def _primer_flujo(texto: str, telefono: str, memoria: dict) -> list[str]:
    if texto not in ("1", "2"):
        return [PRIMER_FLUJO]
    memoria.update(paso="primera_franja", flujo=(Flujo.ORGANICO if texto == "1" else Flujo.RECICLABLE).value)
    return ["¿A qué hora te queda mejor que pasen?\n1 Mañana\n2 Tarde\n3 Noche"]


def _primera_franja(texto: str, telefono: str, memoria: dict) -> list[str]:
    """Registra al vecino pendiente y guarda su primer pedido: entra solo cuando la coordinación lo acepte."""
    if texto not in FRANJAS:
        return ["Responde 1 para la mañana, 2 para la tarde o 3 para la noche."]
    directorio.registrar_solicitante(directorio.NuevoSolicitante(
        telefono=telefono, nombre=memoria["nombre"], tipo=memoria["tipo"], zona_id=memoria["zona_id"],
        direccion=memoria["direccion"], autoriza_datos=True), habilitado=False)
    nombre, flujo, franja = memoria["nombre"], Flujo(memoria["flujo"]), FRANJAS[texto]
    memoria.clear()
    memoria["pedido_en_espera"] = {"flujo": flujo.value, "preferencia": franja.value}
    return [f"Listo, {nombre}. Guardamos tu pedido de {NOMBRE_FLUJO[flujo]} {NOMBRE_FRANJA[franja]}. Cuando la "
            "coordinación apruebe tu registro te enviamos el código para tu bolsa."]


def _menu_zonas() -> str:
    opciones = (f"{i} {zona.nombre}" for i, zona in enumerate(directorio.zonas(), start=1))
    return "¿En qué zona estás?\n" + "\n".join(opciones)


_PASOS = {
    "inicio": _inicio,
    "autorizacion": _autorizacion,
    "tipo": _tipo,
    "zona": _zona,
    "direccion": _direccion,
    "nombre": _nombre_o_alias,
    "primer_flujo": _primer_flujo,
    "primera_franja": _primera_franja,
}
