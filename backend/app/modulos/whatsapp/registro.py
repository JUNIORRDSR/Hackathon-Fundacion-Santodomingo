"""Alta por WhatsApp, determinista: autorización de datos (Ley 1581) y datos mínimos. Queda PENDIENTE (RN-08)."""
from app.compartido.tipos import TipoGenerador
from app.modulos.directorio import contrato as directorio
from app.modulos.whatsapp.respuestas import texto as plantilla


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
    directorio.registrar_solicitante(directorio.NuevoSolicitante(
        telefono=telefono, nombre=texto[:60], tipo=memoria["tipo"], zona_id=memoria["zona_id"],
        direccion=memoria["direccion"], autoriza_datos=True), habilitado=False)
    memoria.clear()
    return [plantilla("registro_recibido", nombre=texto[:60])]


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
}
