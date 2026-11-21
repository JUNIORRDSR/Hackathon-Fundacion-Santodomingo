"""Directorio del territorio (ADR-0014): zonas y conjuntos, registro desde la tableta y encargados por conjunto.
Corre después de test_reiniciar_base, que vacía la base: el teléfono 9 de test_clasificacion queda libre."""
from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from app.modulos.directorio import contrato as directorio

TELEFONO = "+573000000009"  # ficticio


def sesion(usuario: str) -> TestClient:
    cliente = TestClient(app)
    respuesta = cliente.post("/api/acceso/entrar", json={"usuario": usuario, "clave": "ecoconecta-demo"})
    assert respuesta.status_code == 200, respuesta.text
    return cliente


def test_registro_asistido_con_su_conjunto_y_encargado_por_conjunto():
    huerteros = sesion("huerteros")
    zona, conjunto = _crear_lugares(huerteros)
    vecino = _registrar_desde_la_tableta(huerteros, zona, conjunto)
    mensajes = huerteros.get("/api/whatsapp/simulador/mensajes", params={"telefono": TELEFONO}).json()
    assert any("te registró con tu autorización" in m["texto"] for m in mensajes)  # bienvenida con privacidad
    encargado = huerteros.post("/api/directorio/encargados", json={
        "nombre": "Encargada de Prueba", "colectivo": "huerteros", "lugares": [conjunto]}).json()
    solicitud = huerteros.post("/api/solicitudes", json={
        "solicitante_id": vecino["id"], "flujo": "organico", "preferencia": "manana"}).json()
    assert solicitud["conjunto"] == "Torre de Prueba"
    assert huerteros.get(f"/api/solicitudes/{solicitud['id']}/sugerencias").json()[0]["id"] == encargado["id"]
    _entregar_en_la_huerta(huerteros, vecino, encargado)
    _desactivar(huerteros, conjunto)


def _crear_lugares(cliente: TestClient) -> tuple[str, str]:
    """La coordinación crea zonas y conjuntos; un nombre repetido en la misma zona no entra."""
    zona = cliente.post("/api/directorio/zonas", json={"nombre": "Zona de Prueba " + uuid4().hex[:6]})
    assert zona.status_code == 201, zona.text
    ruta = f"/api/directorio/zonas/{zona.json()['id']}/conjuntos"
    conjunto = cliente.post(ruta, json={"nombre": "Torre de Prueba"})
    assert conjunto.status_code == 201, conjunto.text
    assert cliente.post(ruta, json={"nombre": "Torre de Prueba"}).status_code == 409
    return zona.json()["id"], conjunto.json()["id"]


def _registrar_desde_la_tableta(cliente: TestClient, zona: str, conjunto: str) -> dict:
    """Si la zona tiene conjuntos hay que elegir uno; con él entra habilitado y firmado por quien registra."""
    datos = {"telefono": TELEFONO, "nombre": "Vecina de Prueba", "tipo": "hogar", "zona_id": zona,
             "direccion": "Apto 101", "autoriza_datos": True}
    sin_conjunto = cliente.post("/api/directorio/solicitantes", json=datos)
    assert sin_conjunto.status_code == 409 and "Elige el conjunto" in sin_conjunto.json()["detail"]
    respuesta = cliente.post("/api/directorio/solicitantes", json={**datos, "conjunto_id": conjunto})
    assert respuesta.status_code == 201, respuesta.text
    vecino = respuesta.json()
    assert vecino["estado"] == "habilitado" and vecino["registrado_por"] == "Coordinación de huerteros"
    return vecino


def _entregar_en_la_huerta(cliente: TestClient, vecino: dict, encargado: dict) -> None:
    """RF-05: la entrega directa nace recolectada, suma puntos y le avisa al vecino, aunque tenga otra abierta."""
    respuesta = cliente.post("/api/solicitudes/entregas", json={
        "solicitante_id": vecino["id"], "flujo": "organico", "kg": 6.5, "encargado_id": encargado["id"]})
    assert respuesta.status_code == 201, respuesta.text
    entrega = respuesta.json()
    assert entrega["estado"] == "recolectada" and entrega["canal"] == "huerta" and float(entrega["kg"]) == 6.5
    assert cliente.get("/api/puntos/por-codigo").json()[entrega["codigo"]] > 0
    mensajes = cliente.get("/api/whatsapp/simulador/mensajes", params={"telefono": TELEFONO}).json()
    assert any(entrega["codigo"] in m["texto"] and "Ganaste" in m["texto"] for m in mensajes)
    reciclable = cliente.post("/api/solicitudes/entregas", json={
        "solicitante_id": vecino["id"], "flujo": "reciclable", "kg": 2, "encargado_id": encargado["id"]})
    assert reciclable.status_code == 403  # los huerteros no reciben reciclables (RN-01)


def _desactivar(cliente: TestClient, conjunto: str) -> None:
    """Un conjunto desactivado sigue en el catálogo, pero ya no se ofrece a quien se registra."""
    cambio = cliente.patch(f"/api/directorio/conjuntos/{conjunto}", json={"nombre": "Torre de Prueba", "activo": False})
    assert cambio.status_code == 200 and cambio.json()["activo"] is False
    assert all(str(lugar.conjunto_id) != conjunto for lugar in directorio.lugares_para_elegir())
