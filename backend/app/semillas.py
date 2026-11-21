"""Datos de demostración, todos ficticios (Ley 1581). Los lugares salen de docs/reto/contexto-barrio.md."""
from app.compartido.configuracion import variable
from app.compartido.tipos import Colectivo, Flujo
from app.modulos.acceso import contrato as acceso
from app.modulos.contenidos import contrato as contenidos
from app.modulos.directorio import contrato as directorio
from app.modulos.puntos import contrato as puntos

C = contenidos


def sembrar() -> None:
    if not puntos.premios():
        for nombre, costo in PREMIOS:
            puntos.guardar_premio(puntos.NuevoPremio(nombre=nombre, costo=costo), ejemplo=True)
    if directorio.zonas():
        return
    _lugares_y_encargados()
    _usuarios(variable("CLAVE_DEMO", "ecoconecta-demo"))
    for pieza in PIEZAS:
        contenidos.crear(pieza)


# Zonas y sus conjuntos o sectores (ADR-0016); el Corredor comercial no tiene conjuntos.
LUGARES = {
    "Corredor comercial": (),
    "Etapa 1": ("Sector Salón Comunal", "Sector Sede"),
    "Etapa 2": ("Manzana 13", "Manzana 14", "Manzana 15", "Manzana 16", "Manzana 19"),
    "Etapa 3": ("Álamos", "Parques de Bolívar 1", "Parques de Bolívar 2"),
    "Etapa 4": ("Brisas de San Pablo", "Mirasol", "Portobelo", "Aurora"),
}
ENCARGADOS = (("Huertero Uno", Colectivo.HUERTEROS, ("Corredor comercial", "Brisas de San Pablo")),
              ("Huertera Dos", Colectivo.HUERTEROS, ("Etapa 1", "Etapa 2")),
              ("Reciclador Uno", Colectivo.RECICLADORES, ("Brisas de San Pablo",)),
              ("Recicladora Dos", Colectivo.RECICLADORES, ("Corredor comercial", "Etapa 1", "Etapa 2")))


def _lugares_y_encargados() -> None:
    """Un encargado que cubre una zona cubre todos sus conjuntos (o la zona misma, si no tiene)."""
    ids = {}
    for nombre_zona, nombres in LUGARES.items():
        zona = directorio.crear_zona(nombre_zona)
        conjuntos = [directorio.crear_conjunto(zona.id, nombre) for nombre in nombres]
        ids[nombre_zona] = [c.id for c in conjuntos] or [zona.id]
        ids.update({c.nombre: [c.id] for c in conjuntos})
    for nombre, colectivo, lugares in ENCARGADOS:
        directorio.registrar_encargado(directorio.NuevoEncargado(
            nombre=nombre, colectivo=colectivo, lugares=[id_lugar for lugar in lugares for id_lugar in ids[lugar]]))


def _usuarios(clave: str) -> None:
    for usuario, nombre, rol, colectivo in (
            ("rosa", "Rosa Herrera", acceso.Rol.COORDINADOR, Colectivo.HUERTEROS),
            ("carlos", "Carlos Mendoza", acceso.Rol.COORDINADOR, Colectivo.RECICLADORES),
            ("fundacion", "Fundación Santo Domingo", acceso.Rol.ADMINISTRADOR, None)):
        acceso.crear_usuario(acceso.NuevoUsuario(usuario=usuario, nombre=nombre, rol=rol, colectivo=colectivo,
                                                 clave=clave))


def _guia(titulo: str, categoria: str, descripcion: str, pasos: list[str]) -> C.NuevoContenido:
    """Las guías de capacitación que diseñó Daniela; son de ejemplo hasta tener el material de la fundación."""
    flujo = {"organico": Flujo.ORGANICO, "reciclable": Flujo.RECICLABLE}.get(categoria)
    return C.NuevoContenido(titulo=titulo, proposito=C.Proposito.EDUCACION, audiencia=C.Audiencia.SOLICITANTE,
                            flujo=flujo, formato=C.Formato.TEXTO, categoria=categoria, texto_corto=descripcion,
                            pasos=pasos)


PIEZAS = [
    _guia("Residuos orgánicos", "organico",
          "Identifica los restos de origen vegetal que puedes separar en casa o en tu negocio.",
          ["Aparta cáscaras de frutas, restos de verduras y café usado.",
           "Retira bolsas, etiquetas y ligas antes de guardar los restos.",
           "Reserva un recipiente separado y mantenlo tapado."]),
    _guia("Residuos reciclables (aprovechables)", "reciclable",
          "Prepara los materiales que pueden recuperarse para que conserven su valor.",
          ["Separa papel y cartón secos, botellas plásticas, latas y envases de vidrio.",
           "Vacía y seca los envases antes de guardarlos.",
           "Confirma con el programa local qué materiales recibe."]),
    _guia("Qué evitar mezclar", "mezclas",
          "Mantén separados los materiales para facilitar el manejo de cada grupo.",
          ["Evita mezclar restos de comida con papel, cartón y envases.",
           "Mantén pañales, papel higiénico y servilletas sucias aparte.",
           "Separa pilas y residuos peligrosos para entregarlos en puntos habilitados."]),
    _guia("Buenas prácticas", "practicas",
          "Adopta hábitos sencillos para mantener ordenado el lugar donde separas.",
          ["Usa recipientes identificados y fáciles de limpiar.",
           "Acuerda con tu hogar o negocio dónde va cada grupo.",
           "Mantén los residuos protegidos de la lluvia hasta la entrega."]),
    C.NuevoContenido(titulo="Cómo separar tus residuos", proposito=C.Proposito.EDUCACION,
                     audiencia=C.Audiencia.SOLICITANTE, formato=C.Formato.VIDEO, categoria="practicas",
                     texto_corto="Video breve de aproximadamente 30 segundos."),
    C.NuevoContenido(titulo="Cómo pedir la recolección por WhatsApp", proposito=C.Proposito.TUTORIAL,
                     audiencia=C.Audiencia.SOLICITANTE, formato=C.Formato.TEXTO, categoria="practicas",
                     texto_corto="Escribe HOLA, elige 1 para orgánicos o 2 para reciclables y tu horario. Te "
                                 "confirmamos día, hora y quién pasa."),
    C.NuevoContenido(titulo="Cómo usar la bandeja", proposito=C.Proposito.TUTORIAL,
                     audiencia=C.Audiencia.COORDINADOR, formato=C.Formato.TEXTO,
                     texto_corto="Abre una solicitud pendiente, elige al encargado que sugiere el sistema, pon día y "
                                 "hora y confirma. Cuando te reporten la recolección, registra los kilos."),
]
# Valores de ejemplo hasta que la fundación los fije (ADR-0008).
PREMIOS = (("Plántula de la huerta", 30), ("Abono orgánico, 1 kg", 45), ("Paquete de bolsas para orgánicos", 60))
