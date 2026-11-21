"""Alta por WhatsApp, determinista: autorización (Ley 1581), datos mínimos y primer pedido. Queda PENDIENTE (RN-08).
Los textos viven en respuestas.json (Jorge)."""
from app.compartido.formato import NOMBRE_FLUJO
from app.compartido.tipos import Flujo, Franja, TipoGenerador
from app.modulos.directorio import contrato as directorio
from app.modulos.whatsapp.agente.lenguaje import normalizar
from app.modulos.whatsapp.respuestas import texto as plantilla

FRANJAS = {"1": Franja.MANANA, "2": Franja.TARDE, "3": Franja.NOCHE}
NOMBRE_FRANJA = {Franja.MANANA: "en la mañana", Franja.TARDE: "en la tarde", Franja.NOCHE: "en la noche"}
_HOGAR = frozenset(("1", "hogar", "casa", "mi hogar", "soy un hogar", "un hogar"))
_NEGOCIO = frozenset(("2", "negocio", "mi negocio", "soy un negocio", "un negocio"))
_ORGANICOS = frozenset(("1", "organico", "organicos", "restos de comida"))
_RECICLABLES = frozenset(("2", "reciclable", "reciclables", "reciclaje"))


def responder(texto: str, telefono: str, memoria: dict) -> list[str]:
    """Avanza un paso del registro; la memoria guarda en qué paso va y lo ya respondido."""
    return _PASOS[memoria.get("paso", "inicio")](texto.strip(), telefono, memoria)


def _inicio(texto: str, telefono: str, memoria: dict) -> list[str]:
    memoria["paso"] = "autorizacion"
    return [plantilla("registro_autorizacion", opciones="1 Sí\n2 No")]


def _autorizacion(texto: str, telefono: str, memoria: dict) -> list[str]:
    opcion = _opcion(texto.replace(",", " "))
    if opcion in ("2", "no", "no autorizo", "no gracias"):
        memoria.clear()
        return [plantilla("registro_no_autorizado")]
    if opcion not in ("1", "si", "si autorizo", "autorizo"):
        return [plantilla("registro_autorizacion_invalida")]
    memoria["paso"] = "tipo"
    return [plantilla("registro_tipo", opciones="1 Hogar\n2 Negocio")]


def _tipo(texto: str, telefono: str, memoria: dict) -> list[str]:
    opcion = _opcion(texto)
    if opcion not in _HOGAR and opcion not in _NEGOCIO:
        return [plantilla("registro_tipo_invalido", hogar="Hogar", negocio="Negocio")]
    tipo = TipoGenerador.HOGAR if opcion in _HOGAR else TipoGenerador.UNIDAD_PRODUCTIVA
    memoria.update(paso="zona", tipo=tipo.value)
    return [_menu_lugares(directorio.lugares_para_elegir())]


def _zona(texto: str, telefono: str, memoria: dict) -> list[str]:
    """Una sola pregunta por el lugar (ADR-0016): el número de la lista o el nombre del conjunto o sector."""
    lugares = directorio.lugares_para_elegir()
    opcion = _opcion(texto)
    if opcion.isdecimal() and 1 <= int(opcion) <= len(lugares):
        lugar = lugares[int(opcion) - 1]
    else:
        candidatos = [lugar for lugar in lugares if _opcion(lugar.nombre) == opcion]
        lugar = candidatos[0] if len(candidatos) == 1 else None
    if lugar is None:
        return [_menu_lugares(lugares)]
    memoria.update(paso="direccion", zona_id=str(lugar.zona_id),
                   conjunto_id=str(lugar.conjunto_id) if lugar.conjunto_id else None)
    return [plantilla("registro_direccion")]


def _direccion(texto: str, telefono: str, memoria: dict) -> list[str]:
    if len(texto) < 3:
        return [plantilla("registro_direccion_invalida")]
    memoria.update(paso="nombre", direccion=texto[:120])
    return [plantilla("registro_nombre")]


def _nombre_o_alias(texto: str, telefono: str, memoria: dict) -> list[str]:
    if len(texto) < 2:
        return [plantilla("registro_nombre_invalido")]
    memoria.update(paso="primer_flujo", nombre=texto[:60])
    return [_primer_flujo_pregunta()]


def _primer_flujo_pregunta() -> str:
    return plantilla("registro_primer_flujo", opciones="1 Orgánicos (restos de comida)\n2 Reciclables (papel, "
                                                       "plástico, vidrio)")


def _primer_flujo(texto: str, telefono: str, memoria: dict) -> list[str]:
    opcion = _opcion(texto)
    if opcion not in _ORGANICOS and opcion not in _RECICLABLES:
        return [_primer_flujo_pregunta()]
    flujo = Flujo.ORGANICO if opcion in _ORGANICOS else Flujo.RECICLABLE
    memoria.update(paso="primera_franja", flujo=flujo.value)
    return [plantilla("registro_primera_franja", opciones="1 Mañana\n2 Tarde\n3 Noche")]


def _primera_franja(texto: str, telefono: str, memoria: dict) -> list[str]:
    """Registra al vecino pendiente y guarda su primer pedido: entra solo cuando la coordinación lo acepte."""
    franja = _franja(_opcion(texto))
    if franja is None:
        return [plantilla("registro_franja_invalida")]
    directorio.registrar_solicitante(directorio.NuevoSolicitante(
        telefono=telefono, nombre=memoria["nombre"], tipo=memoria["tipo"], zona_id=memoria["zona_id"],
        conjunto_id=memoria.get("conjunto_id"), direccion=memoria["direccion"], autoriza_datos=True),
        habilitado=False)
    nombre, flujo = memoria["nombre"], Flujo(memoria["flujo"])
    memoria.clear()
    memoria["pedido_en_espera"] = {"flujo": flujo.value, "preferencia": franja.value}
    return [plantilla("registro_recibido", nombre=nombre, flujo=NOMBRE_FLUJO[flujo], franja=NOMBRE_FRANJA[franja])]


def _opcion(texto: str) -> str:
    return " ".join(normalizar(texto).split()).strip(" ¿?¡!.,")


def _franja(texto: str) -> Franja | None:
    if texto in FRANJAS:
        return FRANJAS[texto]
    limpia = texto.removeprefix("por la ").removeprefix("en la ").removeprefix("la ")
    return next((franja for franja in Franja if franja.value == limpia), None)


def _menu_lugares(lugares: list) -> str:
    opciones = (f"{i} {lugar.nombre}" + (f" ({lugar.zona})" if lugar.conjunto_id else "")
                for i, lugar in enumerate(lugares, start=1))
    return plantilla("registro_zona", opciones="\n".join(opciones))


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
