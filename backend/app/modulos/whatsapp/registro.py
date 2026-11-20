"""Alta por WhatsApp, determinista: autorización (Ley 1581), datos mínimos y primer pedido. Queda PENDIENTE (RN-08).
Los textos viven en respuestas.json (Jorge)."""
from app.compartido.formato import NOMBRE_FLUJO
from app.compartido.tipos import Flujo, Franja, TipoGenerador
from app.modulos.directorio import contrato as directorio
from app.modulos.whatsapp.respuestas import texto as plantilla

FRANJAS = {"1": Franja.MANANA, "2": Franja.TARDE, "3": Franja.NOCHE}
NOMBRE_FRANJA = {Franja.MANANA: "en la mañana", Franja.TARDE: "en la tarde", Franja.NOCHE: "en la noche"}


def responder(texto: str, telefono: str, memoria: dict) -> list[str]:
    """Avanza un paso del registro; la memoria guarda en qué paso va y lo ya respondido."""
    return _PASOS[memoria.get("paso", "inicio")](texto.strip(), telefono, memoria)


def _inicio(texto: str, telefono: str, memoria: dict) -> list[str]:
    memoria["paso"] = "autorizacion"
    return [plantilla("registro_autorizacion", opciones="1 Sí\n2 No")]


def _autorizacion(texto: str, telefono: str, memoria: dict) -> list[str]:
    if texto != "1":
        memoria.clear()
        return [plantilla("registro_no_autorizado")]
    memoria["paso"] = "tipo"
    return [plantilla("registro_tipo", opciones="1 Hogar\n2 Negocio")]


def _tipo(texto: str, telefono: str, memoria: dict) -> list[str]:
    if texto not in ("1", "2"):
        return [plantilla("registro_tipo_invalido", hogar="1", negocio="2")]
    tipo = TipoGenerador.HOGAR if texto == "1" else TipoGenerador.UNIDAD_PRODUCTIVA
    memoria.update(paso="zona", tipo=tipo.value)
    return [_menu_zonas()]


def _zona(texto: str, telefono: str, memoria: dict) -> list[str]:
    zonas = directorio.zonas()
    if not texto.isdigit() or not 1 <= int(texto) <= len(zonas):
        return [_menu_zonas()]
    memoria.update(paso="direccion", zona_id=str(zonas[int(texto) - 1].id))
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
    if texto not in ("1", "2"):
        return [_primer_flujo_pregunta()]
    memoria.update(paso="primera_franja", flujo=(Flujo.ORGANICO if texto == "1" else Flujo.RECICLABLE).value)
    return [plantilla("registro_primera_franja", opciones="1 Mañana\n2 Tarde\n3 Noche")]


def _primera_franja(texto: str, telefono: str, memoria: dict) -> list[str]:
    """Registra al vecino pendiente y guarda su primer pedido: entra solo cuando la coordinación lo acepte."""
    if texto not in FRANJAS:
        return [plantilla("registro_franja_invalida")]
    directorio.registrar_solicitante(directorio.NuevoSolicitante(
        telefono=telefono, nombre=memoria["nombre"], tipo=memoria["tipo"], zona_id=memoria["zona_id"],
        direccion=memoria["direccion"], autoriza_datos=True), habilitado=False)
    nombre, flujo, franja = memoria["nombre"], Flujo(memoria["flujo"]), FRANJAS[texto]
    memoria.clear()
    memoria["pedido_en_espera"] = {"flujo": flujo.value, "preferencia": franja.value}
    return [plantilla("registro_recibido", nombre=nombre, flujo=NOMBRE_FLUJO[flujo], franja=NOMBRE_FRANJA[franja])]


def _menu_zonas() -> str:
    opciones = (f"{i} {zona.nombre}" for i, zona in enumerate(directorio.zonas(), start=1))
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
