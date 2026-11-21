from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import app
from app.modulos.acceso import contrato as acceso


CLAVE = "clave-inicial-pruebas"
NUEVA = "clave-nueva-pruebas"


def entrar(cliente, usuario, clave=CLAVE):
    return cliente.post("/api/acceso/entrar", json={"usuario": usuario, "clave": clave})


def cuenta(admin, rol="coordinador"):
    datos = {"usuario": f"prueba-{uuid4().hex}", "nombre": "Cuenta de prueba", "rol": rol, "clave": CLAVE,
             "colectivo": "huerteros" if rol == "coordinador" else None}
    respuesta = admin.post("/api/acceso/usuarios", json=datos)
    assert respuesta.status_code == 201
    return respuesta.json()


def administrador():
    usuario = acceso.crear_usuario(acceso.NuevoUsuario(
        usuario=f"prueba-{uuid4().hex}", nombre="Cuenta de administración", rol=acceso.Rol.ADMINISTRADOR, clave=CLAVE,
    ))
    admin = TestClient(app)
    assert entrar(admin, usuario.usuario).status_code == 200
    return admin


def perfil(cuenta, **cambios):
    datos = {campo: cuenta[campo] for campo in ("usuario", "nombre")}
    return {**datos, **cambios}


def test_solo_administradores_pueden_configurar_cuentas():
    admin, coordinador = administrador(), TestClient(app)
    usuario = cuenta(admin)
    ruta = f"/api/acceso/usuarios/{usuario['id']}"
    assert entrar(coordinador, usuario["usuario"]).status_code == 200
    assert TestClient(app).get("/api/acceso/usuarios").status_code == 401
    assert coordinador.get("/api/acceso/usuarios").status_code == 403
    assert coordinador.put(ruta, json=perfil(usuario, rol="administrador", activo=True)).status_code == 403
    assert coordinador.put(ruta + "/clave", json={"clave": NUEVA}).status_code == 403
    assert coordinador.put("/api/acceso/yo", json=perfil(usuario)).status_code == 403
    assert coordinador.put("/api/acceso/yo/clave", json={"actual": CLAVE, "clave": NUEVA}).status_code == 403


def test_editar_perfil_y_permisos_actualiza_la_sesion_abierta():
    admin, coordinador = administrador(), TestClient(app)
    usuario = cuenta(admin)
    assert entrar(coordinador, usuario["usuario"]).status_code == 200
    ruta = f"/api/acceso/usuarios/{usuario['id']}"
    datos = perfil(usuario, nombre="Nombre editado", correo="coord@example.org", telefono="+57 300 123 4567",
                   rol="administrador", activo=True)
    assert admin.put(ruta, json=datos).status_code == 200
    assert coordinador.get("/api/acceso/usuarios").status_code == 200
    assert coordinador.get("/api/acceso/yo").json()["correo"] == "coord@example.org"
    datos.update(rol="coordinador", colectivo="recicladores")
    assert admin.put(ruta, json=datos).status_code == 200
    assert coordinador.get("/api/acceso/usuarios").status_code == 403
    assert coordinador.get("/api/acceso/yo").json()["colectivo"] == "recicladores"
    assert all("clave" not in item for item in admin.get("/api/acceso/usuarios").json())


def test_desactivar_rechaza_ingreso_y_reactivar_no_recupera_la_sesion_anterior():
    admin, coordinador = administrador(), TestClient(app)
    usuario = cuenta(admin)
    assert entrar(coordinador, usuario["usuario"]).status_code == 200
    cookie = coordinador.cookies.get("session")
    ruta = f"/api/acceso/usuarios/{usuario['id']}"
    acceso = perfil(usuario, rol="coordinador", colectivo="huerteros", activo=False)
    assert admin.put(ruta, json=acceso).status_code == 200
    assert coordinador.get("/api/acceso/yo").json() is None
    assert entrar(coordinador, usuario["usuario"]).status_code == 401
    assert admin.put(ruta, json={**acceso, "activo": True}).status_code == 200
    coordinador.cookies.set("session", cookie)
    assert coordinador.get("/api/acceso/yo").json() is None
    assert entrar(TestClient(app), usuario["usuario"]).status_code == 200


def test_restablecer_clave_revoca_el_acceso_anterior():
    admin, coordinador = administrador(), TestClient(app)
    usuario = cuenta(admin)
    assert entrar(coordinador, usuario["usuario"]).status_code == 200
    ruta = f"/api/acceso/usuarios/{usuario['id']}/clave"
    assert admin.put(ruta, json={"clave": NUEVA}).status_code == 204
    assert coordinador.get("/api/acceso/yo").json() is None
    assert entrar(coordinador, usuario["usuario"]).status_code == 401
    assert entrar(coordinador, usuario["usuario"], NUEVA).status_code == 200


def test_administrador_edita_su_perfil_y_cambia_clave_con_la_actual():
    admin = administrador()
    propio = admin.get("/api/acceso/yo").json()
    nombre_usuario = f"perfil-{uuid4().hex}"
    datos = perfil(propio, nombre="Administración EcoConecta", usuario=nombre_usuario)
    assert admin.put("/api/acceso/yo", json=datos).status_code == 200
    assert admin.get("/api/acceso/yo").json()["usuario"] == nombre_usuario
    ruta = "/api/acceso/yo/clave"
    assert admin.put(ruta, json={"actual": "incorrecta", "clave": NUEVA}).status_code == 409
    assert admin.put(ruta, json={"actual": CLAVE, "clave": NUEVA}).status_code == 204
    assert admin.get("/api/acceso/yo").json() is None
    assert entrar(admin, nombre_usuario, CLAVE).status_code == 401
    assert entrar(admin, nombre_usuario, NUEVA).status_code == 200


def test_administrador_no_puede_quitar_su_propio_acceso():
    admin = administrador()
    propio = admin.get("/api/acceso/yo").json()
    ruta = f"/api/acceso/usuarios/{propio['id']}"
    assert admin.put(ruta, json=perfil(propio, rol="administrador", activo=False)).status_code == 409
    assert admin.put(ruta, json=perfil(propio, rol="coordinador", activo=True, colectivo="huerteros")).status_code == 409
    assert admin.put(ruta + "/clave", json={"clave": NUEVA}).status_code == 409


def test_validar_cambios_preserva_los_datos_guardados():
    admin = administrador()
    usuario, otra = cuenta(admin), cuenta(admin)
    ruta = f"/api/acceso/usuarios/{usuario['id']}"
    datos = perfil(usuario, activo=True, rol="coordinador", colectivo="huerteros")
    assert admin.put(ruta, json={**datos, "usuario": otra["usuario"]}).status_code == 409
    assert admin.put(ruta, json={**datos, "colectivo": None}).status_code == 409
    assert admin.put(ruta, json={**datos, "correo": "inválido"}).status_code == 422
    respuesta = admin.put(ruta + "/clave", json={"clave": "corta"})
    assert respuesta.status_code == 409
    assert "corta" not in respuesta.text
    assert entrar(TestClient(app), usuario["usuario"]).status_code == 200
