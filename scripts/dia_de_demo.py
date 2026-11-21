"""Carga un día normal de EcoConecta por la API: vecinos, solicitudes, recolecciones y canjes. Todo ficticio (Ley 1581).

Uso: python scripts/dia_de_demo.py [URL]   (por defecto http://localhost:8000; pide la clave de admin si no es la de demo)
Se puede correr varias veces: lo que ya existe no se repite.
"""
import http.cookiejar
import json
import os
import sys
import urllib.error
import urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000").rstrip("/") + "/api"
CLAVE = os.getenv("CLAVE_DEMO", "ecoconecta-demo")
HOY = datetime.now(ZoneInfo("America/Bogota")).date().isoformat()
abridor = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))

# Lugares de los vecinos de abajo, por su número (ADR-0014): conjunto o sector, o la zona sin conjuntos.
LUGARES = ("Brisas de San Pablo", "Corredor comercial", "Sector Salón Comunal", "Manzana 15")
# (teléfono ficticio, nombre, tipo, lugar, dirección, flujo, franja, qué pasa hoy)
# qué pasa hoy: pendiente · asignada · HH:MM (programada) · HH:MM+kg (recolectada) · rechazo
VECINOS = [
    ("+573000000020", "Marta Salcedo", "hogar", 0, "Torre 3 apto 201", "organico", "manana", "07:30+4.5"),
    ("+573000000021", "Frutería El Mango", "unidad_productiva", 1, "Local 12", "organico",
     "manana", "08:00+26"),
    ("+573000000022", "José Rincón", "hogar", 2, "Casa 9", "organico", "tarde", "09:30"),
    ("+573000000023", "Restaurante Sazón Caribe", "unidad_productiva", 1, "Local 5", "organico",
     "manana", "11:00"),
    ("+573000000024", "Camila Torres", "hogar", 0, "Torre 8 apto 502", "organico", "tarde", "15:00"),
    ("+573000000025", "Panadería El Trigal", "unidad_productiva", 1, "Local 2", "organico",
     "noche", "17:30"),
    ("+573000000026", "Elena Rojas", "hogar", 3, "Casa 3", "organico", "manana", "rechazo"),
    ("+573000000027", "Hugo Pineda", "hogar", 2, "Casa 14", "organico", "tarde", "pendiente"),
    ("+573000000028", "Café La Palma", "unidad_productiva", 1, "Local 9", "organico", "manana",
     "pendiente"),
    ("+573000000029", "Familia Ríos", "hogar", 3, "Casa 1", "organico", "noche", "pendiente"),
    ("+573000000030", "Tienda Don Pedro", "unidad_productiva", 1, "Local 7", "reciclable",
     "manana", "08:30+22"),
    ("+573000000031", "Rosa Mejía", "hogar", 0, "Torre 1 apto 104", "reciclable", "manana", "10:00"),
    ("+573000000032", "Droguería Vida", "unidad_productiva", 1, "Local 14", "reciclable", "tarde",
     "14:00"),
    ("+573000000033", "Andrés Gómez", "hogar", 2, "Casa 6", "reciclable", "tarde", "asignada"),
    ("+573000000034", "Valentina Cruz", "hogar", 3, "Casa 12", "reciclable", "noche", "pendiente"),
    ("+573000000035", "Ferretería La Llave", "unidad_productiva", 1, "Local 20", "reciclable",
     "manana", "pendiente"),
]
CANJES = ["+573000000021", "+573000000030"]  # con lo recolectado hoy ya les alcanza: piden por WhatsApp
COLECTIVO = {"organico": "huerteros", "reciclable": "recicladores"}


def llamar(ruta, cuerpo=None, metodo=None):
    datos = None if cuerpo is None else json.dumps(cuerpo).encode()
    pedido = urllib.request.Request(BASE + ruta, data=datos, method=metodo,
                                    headers={"Content-Type": "application/json"})
    with abridor.open(pedido) as respuesta:
        texto = respuesta.read().decode()
    return json.loads(texto) if texto else None


def lugares_por_nombre():
    """Nombre del conjunto (o de la zona sin conjuntos) → (zona_id, conjunto_id)."""
    lugares = {}
    for zona in llamar("/directorio/zonas"):
        lugares[zona["nombre"]] = (zona["id"], None)
        lugares.update({c["nombre"]: (zona["id"], c["id"]) for c in zona["conjuntos"]})
    return lugares


def vecino(telefono, nombre, tipo, lugar, direccion, existentes):
    if telefono in existentes:
        return existentes[telefono]
    zona_id, conjunto_id = lugar
    return llamar("/directorio/solicitantes", {"telefono": telefono, "nombre": nombre, "tipo": tipo,
                                              "zona_id": zona_id, "conjunto_id": conjunto_id,
                                              "direccion": direccion, "autoriza_datos": True})["id"]


def llevar_el_dia(solicitud, plan, encargado):
    """Asigna, programa y cierra según el plan; cada paso dispara el aviso real al vecino."""
    if plan == "pendiente" or solicitud["estado"] != "recibida":
        return
    hora, _, kg = plan.partition("+")
    asignacion = {"encargado_id": encargado, "dia": HOY, "hora": hora if ":" in hora else None}
    llamar(f"/solicitudes/{solicitud['id']}/asignacion", asignacion)
    if plan == "rechazo":
        llamar(f"/solicitudes/{solicitud['id']}/rechazo", {"motivo": "Venían mezclados con plástico y vidrio"})
    elif kg:
        llamar(f"/solicitudes/{solicitud['id']}/recoleccion", {"kg": float(kg)})


def main():
    llamar("/acceso/entrar", {"usuario": "admin", "clave": CLAVE})
    lugares = lugares_por_nombre()
    existentes = {s["telefono"]: s["id"] for s in llamar("/directorio/solicitantes")}
    abiertas = {(s["solicitante_id"], s["colectivo"]) for s in llamar("/solicitudes")}
    encargados = {c: [e["id"] for e in llamar(f"/directorio/encargados?colectivo={c}")] for c in COLECTIVO.values()}
    for i, (telefono, nombre, tipo, lugar, direccion, flujo, franja, plan) in enumerate(VECINOS):
        solicitante = vecino(telefono, nombre, tipo, lugares[LUGARES[lugar % len(LUGARES)]], direccion, existentes)
        if (solicitante, COLECTIVO[flujo]) in abiertas:
            continue
        solicitud = llamar("/solicitudes", {"solicitante_id": solicitante, "flujo": flujo, "preferencia": franja})
        equipo = encargados[COLECTIVO[flujo]]
        llevar_el_dia(solicitud, plan, equipo[i % len(equipo)])
    for telefono in CANJES:
        for texto in ("4", "1"):
            llamar("/whatsapp/simulador", {"telefono": telefono, "texto": texto})
    resumen = llamar("/solicitudes")
    print(f"{len(resumen)} solicitudes · {len(llamar('/puntos/canjes?estado=pedido'))} canjes por entregar")


if __name__ == "__main__":
    try:
        main()
    except urllib.error.HTTPError as error:
        sys.exit(f"La API respondió {error.code}: {error.read().decode()}")
