"""Alta por WhatsApp, determinista: autorización de datos (Ley 1581) y datos mínimos. Queda PENDIENTE (RN-08)."""
from app.compartido.tipos import TipoGenerador
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


def _nombre_o_alias(texto: str, telefono: str, memoria: dict) -> list[str]:
    if len(texto) < 2:
        return ["Escribe tu nombre o cómo quieres que te llamemos."]
    directorio.registrar_solicitante(directorio.NuevoSolicitante(
        telefono=telefono, nombre=texto[:60], tipo=memoria["tipo"], zona_id=memoria["zona_id"],
        direccion=memoria["direccion"], autoriza_datos=True), habilitado=False)
    memoria.clear()
    return [f"Listo, {texto[:60]}. La coordinación revisa tu registro y te avisamos por aquí."]


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
}
