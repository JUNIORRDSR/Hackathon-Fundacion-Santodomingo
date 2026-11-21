from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app


RUTAS = "/api/directorio/rutas"


def _sesion(usuario):
    cliente = TestClient(app)
    respuesta = cliente.post("/api/acceso/entrar", json={"usuario": usuario, "clave": "ecoconecta-demo"})
    assert respuesta.status_code == 200, respuesta.text
    return cliente


def _equipo():
    cliente = _sesion("carlos")
    respuesta = cliente.post("/api/directorio/zonas", json={"nombre": f"Etapa de prueba {uuid4().hex[:8]}"})
    assert respuesta.status_code == 201, respuesta.text
    zona = respuesta.json()
    respuesta = cliente.post(f"/api/directorio/zonas/{zona['id']}/conjuntos", json={"nombre": "Sector de prueba"})
    assert respuesta.status_code == 201, respuesta.text
    conjunto = respuesta.json()
    respuesta = cliente.post("/api/directorio/encargados", json={
        "nombre": "Recicladora de prueba", "colectivo": "recicladores", "lugares": [conjunto["id"]]})
    assert respuesta.status_code == 201, respuesta.text
    encargado = respuesta.json()
    datos = {"nombre": "Ruta del sector", "colectivo": "recicladores", "zona_id": zona["id"],
             "conjunto_id": conjunto["id"], "encargado_id": encargado["id"], "dias": [0, 3],
             "hora_inicio": "08:00", "hora_fin": "11:30"}
    return cliente, zona, conjunto, encargado, datos


def test_crear_editar_y_publicar_ruta_sin_exponer_al_encargado():
    cliente, zona, conjunto, encargado, datos = _equipo()
    publico = TestClient(app)
    creada = cliente.post(RUTAS, json=datos)
    assert creada.status_code == 201, creada.text
    id_ruta = creada.json()["id"]
    assert creada.json()["encargado_id"] == encargado["id"]
    assert id_ruta in {r["id"] for r in cliente.get(RUTAS).json()}
    assert id_ruta not in {r["id"] for r in publico.get(RUTAS + "/publicas").json()}
    cambio = {**datos, "dias": [2, 0], "hora_inicio": "09:00", "publicada": True}
    editada = cliente.put(f"{RUTAS}/{id_ruta}", json=cambio)
    assert editada.status_code == 200, editada.text
    ruta_publica = next(r for r in publico.get(RUTAS + "/publicas").json() if r["id"] == id_ruta)
    assert ruta_publica == {"id": id_ruta, "nombre": datos["nombre"], "colectivo": "recicladores",
                            "zona": zona["nombre"], "conjunto": conjunto["nombre"], "dias": [0, 2],
                            "hora_inicio": "09:00", "hora_fin": "11:30"}
    url_encargado = f"/api/directorio/encargados/{encargado['id']}"
    assert cliente.patch(url_encargado, json={**encargado, "activo": False}).status_code == 200
    assert id_ruta not in {r["id"] for r in publico.get(RUTAS + "/publicas").json()}
    assert cliente.put(f"{RUTAS}/{id_ruta}", json={**cambio, "publicada": False}).status_code == 200


def test_rutas_validan_territorio_horario_y_permisos_por_equipo():
    cliente, zona, _, _, datos = _equipo()
    huerteros = _sesion("rosa")
    publico = TestClient(app)
    assert publico.get(RUTAS).status_code == 401
    assert publico.post(RUTAS, json=datos).status_code == 401
    assert huerteros.post(RUTAS, json=datos).status_code == 403
    assert huerteros.post(RUTAS, json={**datos, "colectivo": "huerteros"}).status_code == 409
    assert cliente.post(RUTAS, json={**datos, "hora_fin": "07:59"}).status_code == 422
    assert cliente.post(RUTAS, json={**datos, "dias": []}).status_code == 422
    assert cliente.post(RUTAS, json={**datos, "zona_id": str(uuid4())}).status_code == 404
    otra = cliente.post("/api/directorio/zonas", json={"nombre": f"Etapa {uuid4().hex[:8]}"}).json()
    assert cliente.post(RUTAS, json={**datos, "zona_id": otra["id"]}).status_code == 409
    respuesta = cliente.post(RUTAS, json={**datos, "conjunto_id": None, "publicada": True})
    assert respuesta.status_code == 201, respuesta.text
    id_ruta = respuesta.json()["id"]
    assert id_ruta not in {r["id"] for r in huerteros.get(RUTAS).json()}
    assert huerteros.put(f"{RUTAS}/{id_ruta}", json=datos).status_code == 403
    assert cliente.put(f"{RUTAS}/{id_ruta}", json={**datos, "colectivo": "huerteros"}).status_code == 403
    assert cliente.patch(f"/api/directorio/zonas/{zona['id']}", json={**zona, "activo": False}).status_code == 200
    assert id_ruta not in {r["id"] for r in publico.get(RUTAS + "/publicas").json()}
