"""Datos de demostración, todos ficticios (Ley 1581). Las zonas salen de docs/reto/contexto-barrio.md."""
import os

from app.compartido.tipos import Colectivo, Flujo
from app.modulos.acceso import contrato as acceso
from app.modulos.contenidos import contrato as contenidos
from app.modulos.directorio import contrato as directorio

C = contenidos


def sembrar() -> None:
    if directorio.zonas():
        return
    brisas, corredor, etapa1, etapa2 = (directorio.crear_zona(nombre) for nombre in
                                        ("Brisas de San Pablo", "Corredor comercial", "Etapa 1", "Etapa 2"))
    for nombre, colectivo, zonas in (("Huertero Uno", Colectivo.HUERTEROS, (corredor, brisas)),
                                     ("Huertera Dos", Colectivo.HUERTEROS, (etapa1, etapa2)),
                                     ("Reciclador Uno", Colectivo.RECICLADORES, (brisas,)),
                                     ("Recicladora Dos", Colectivo.RECICLADORES, (corredor, etapa1, etapa2))):
        directorio.registrar_encargado(directorio.NuevoEncargado(nombre=nombre, colectivo=colectivo,
                                                                 zonas=[z.id for z in zonas]))
    clave = os.getenv("CLAVE_DEMO", "ecoconecta-demo")
    for usuario, nombre, rol, colectivo in (
            ("huerteros", "Coordinación de huerteros", acceso.Rol.COORDINADOR, Colectivo.HUERTEROS),
            ("recicladores", "Coordinación de recicladores", acceso.Rol.COORDINADOR, Colectivo.RECICLADORES),
            ("admin", "Administración de la fundación", acceso.Rol.ADMINISTRADOR, None)):
        acceso.crear_usuario(acceso.NuevoUsuario(usuario=usuario, nombre=nombre, rol=rol, colectivo=colectivo,
                                                 clave=clave))
    for pieza in PIEZAS:
        contenidos.crear(pieza)


PIEZAS = [
    C.NuevoContenido(titulo="Qué va en la bolsa de orgánicos", proposito=C.Proposito.EDUCACION,
                     audiencia=C.Audiencia.SOLICITANTE, flujo=Flujo.ORGANICO, formato=C.Formato.TEXTO,
                     texto_corto="Cáscaras de frutas y verduras, restos de comida, cuncho de café y hojas. Sin plástico, "
                                 "vidrio, metal ni papel higiénico. (Texto de ejemplo: validarlo con la huerta.)"),
    C.NuevoContenido(titulo="Qué va en la bolsa de reciclables", proposito=C.Proposito.EDUCACION,
                     audiencia=C.Audiencia.SOLICITANTE, flujo=Flujo.RECICLABLE, formato=C.Formato.TEXTO,
                     texto_corto="Cartón, papel, botellas plásticas, vidrio y latas, limpios y secos. Aplasta cajas y "
                                 "botellas para que quepa más. (Texto de ejemplo: validarlo con los recicladores.)"),
    C.NuevoContenido(titulo="Cómo pedir la recolección por WhatsApp", proposito=C.Proposito.TUTORIAL,
                     audiencia=C.Audiencia.SOLICITANTE, formato=C.Formato.TEXTO,
                     texto_corto="Escribe HOLA, elige 1 para orgánicos o 2 para reciclables y tu horario. Te "
                                 "confirmamos día, hora y quién pasa."),
    C.NuevoContenido(titulo="Cómo usar la bandeja", proposito=C.Proposito.TUTORIAL,
                     audiencia=C.Audiencia.COORDINADOR, formato=C.Formato.TEXTO,
                     texto_corto="Toca una solicitud nueva, elige al encargado que sugiere el sistema, pon día y hora y "
                                 "toca Asignar y programar. Cuando te reporten la recolección, registra los kilos."),
]
