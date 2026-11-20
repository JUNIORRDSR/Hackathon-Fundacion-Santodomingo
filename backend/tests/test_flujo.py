"""El escenario de demostración del reto (§11), de punta a punta, por la API y el simulador de WhatsApp."""
from fastapi.testclient import TestClient

from app.main import app

TELEFONO = "+573000000001"  # ficticio


def sesion(usuario: str) -> TestClient:
    cliente = TestClient(app)
    respuesta = cliente.post("/api/acceso/entrar", json={"usuario": usuario, "clave": "ecoconecta-demo"})
    assert respuesta.status_code == 200, respuesta.text
    return cliente


def test_escenario_de_demostracion():
    admin, huerteros, recicladores = sesion("admin"), sesion("huerteros"), sesion("recicladores")
    solicitante = _registrar_por_whatsapp_y_habilitar(admin)
    solicitud = _pedir_organicos(admin, huerteros)
    _comprobar_que_recicladores_no_la_ve(recicladores, solicitud)
    _asignar_programar_y_recoger(huerteros, solicitud)
    assert admin.get(f"/api/puntos/solicitantes/{solicitante['id']}").json()["saldo"] == 12  # RN-05, RN-06
    _comprobar_avisos(admin)
    assert huerteros.get("/api/reportes/resumen").json()["total_solicitudes"] >= 1


def _whatsapp(cliente: TestClient, texto: str) -> list[str]:
    respuesta = cliente.post("/api/whatsapp/simulador", json={"telefono": TELEFONO, "texto": texto})
    assert respuesta.status_code == 200, respuesta.text
    return respuesta.json()


def _registrar_por_whatsapp_y_habilitar(admin: TestClient) -> dict:
    """Una unidad productiva se registra por WhatsApp y queda pendiente hasta que la habilitan (RN-08)."""
    for texto in ("Hola", "1", "2", "2", "Restaurante La Esquina, local 3", "La Esquina"):
        _whatsapp(admin, texto)
    pendientes = admin.get("/api/directorio/solicitantes", params={"estado": "pendiente"}).json()
    solicitante = next(s for s in pendientes if s["telefono"] == TELEFONO)
    assert admin.post(f"/api/directorio/solicitantes/{solicitante['id']}/habilitacion").status_code == 200
    return solicitante


def _pedir_organicos(admin: TestClient, huerteros: TestClient) -> dict:
    """Pide orgánicos para la noche y la solicitud llega a la bandeja de huerteros (RN-01)."""
    _whatsapp(admin, "1")
    _whatsapp(admin, "3")
    recibidas = huerteros.get("/api/solicitudes", params={"estado": "recibida"}).json()
    return next(s for s in recibidas if s["telefono"] == TELEFONO)


def _comprobar_que_recicladores_no_la_ve(recicladores: TestClient, solicitud: dict) -> None:
    """RN-07: ni en su bandeja ni pidiéndola directamente."""
    assert all(s["id"] != solicitud["id"] for s in recicladores.get("/api/solicitudes").json())
    assert recicladores.get(f"/api/solicitudes/{solicitud['id']}").status_code == 403


def _asignar_programar_y_recoger(huerteros: TestClient, solicitud: dict) -> None:
    """El coordinador asigna al sugerido, programa (RN-02, RN-03) y registra la recolección con kilos."""
    url = f"/api/solicitudes/{solicitud['id']}"
    sugerido = huerteros.get(f"{url}/sugerencias").json()[0]
    assert huerteros.post(f"{url}/asignacion", json={"encargado_id": sugerido["id"]}).status_code == 200
    programada = huerteros.post(f"{url}/programacion", json={"dia": "2026-11-21", "hora": "19:00"})
    assert programada.json()["estado"] == "programada", programada.text
    assert huerteros.post(f"{url}/recoleccion", json={"kg": "2.5"}).json()["estado"] == "recolectada"


def _comprobar_avisos(admin: TestClient) -> None:
    """El solicitante recibió cada aviso por WhatsApp."""
    mensajes = admin.get("/api/whatsapp/simulador/mensajes", params={"telefono": TELEFONO}).json()
    textos = " | ".join(m["texto"] for m in mensajes)
    assert "Recibimos tu solicitud ORG-" in textos
    assert "Huertero Uno pasa por tu recolección ORG-" in textos
    assert "el sábado 21 de noviembre a las 7:00 p. m. |" in textos
    assert "Ganaste 12 puntos" in textos and "Llevas 12" in textos
