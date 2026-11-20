"""Revisión de fotos de residuos (ADR-0007): orientativa, no frena la solicitud y al modelo solo llegan la foto y el
flujo. Se sustituye únicamente la llamada a Azure, que es lo externo."""
import base64
import email.message
import json
import urllib.request

import pytest
from fastapi.testclient import TestClient

from app.compartido.tipos import Flujo
from app.main import app
from app.modulos.clasificacion import contrato as clasificacion
from app.modulos.clasificacion import vision
from app.modulos.whatsapp import fotos

TELEFONO = "+573000000005"  # ficticio
JPEG = b"\xff\xd8\xff\xe0foto-de-prueba"
MAL_SEPARADA = {"veredicto": "mal_separado", "flujo_detectado": "reciclable",
                "problemas": ["organico_en_reciclables", "envases_sucios"]}


class ModeloFalso:
    """Hace de Azure: guarda cada pedido y responde lo que la prueba le indique."""

    def __init__(self, respuesta: dict | Exception):
        self.respuesta, self.pedidos = respuesta, []

    def preguntar(self, foto: bytes, tipo: str, pedido: str) -> str:
        self.pedidos.append((foto, tipo, pedido))
        if isinstance(self.respuesta, Exception):
            raise self.respuesta
        return json.dumps(self.respuesta)


@pytest.fixture
def modelo(monkeypatch):
    monkeypatch.setenv("CLASIFICACION_ACTIVA", "true")
    monkeypatch.setenv("CLASIFICACION_MODELO", "modelo-de-prueba")

    def responder_con(respuesta: dict | Exception) -> ModeloFalso:
        falso = ModeloFalso(respuesta)
        monkeypatch.setattr(vision, "preguntar", falso.preguntar)
        return falso
    return responder_con


def _foto(contenido: bytes = JPEG, tipo: str = "image/jpeg") -> clasificacion.Foto:
    return clasificacion.Foto(contenido=contenido, tipo=tipo)


def test_cada_problema_de_la_foto_se_explica_con_texto_fijo(modelo):
    modelo(MAL_SEPARADA)
    evaluacion = clasificacion.evaluar(_foto(), Flujo.RECICLABLE)
    assert evaluacion.veredicto == "mal_separado" and evaluacion.flujo_detectado == "reciclable"
    assert evaluacion.problemas == ["organico_en_reciclables", "envases_sucios"]
    assert "comida" in evaluacion.mensaje and "enjuág" in evaluacion.mensaje.lower()
    assert evaluacion.modelo == "modelo-de-prueba" and evaluacion.error is None


@pytest.mark.parametrize(("respuesta", "veredicto"), [
    ({"veredicto": "bien_separado", "flujo_detectado": "organico", "problemas": ["reciclable_en_organicos"]},
     "mal_separado"),
    ({"veredicto": "mal_separado", "flujo_detectado": None, "problemas": ["foto_no_valida"]}, "no_concluyente"),
    ({"veredicto": "bien_separado", "flujo_detectado": "organico", "problemas": []}, "bien_separado"),
])
def test_los_problemas_mandan_sobre_un_veredicto_contradictorio(modelo, respuesta, veredicto):
    modelo(respuesta)
    assert clasificacion.evaluar(_foto(), None).veredicto == veredicto


@pytest.mark.parametrize("respuesta", [
    TimeoutError("Azure no respondió"),
    {"veredicto": "quizas", "flujo_detectado": None, "problemas": []},
    "no es json",
])
def test_si_el_modelo_falla_o_se_sale_del_esquema_responde_no_concluyente_sin_lanzar(modelo, respuesta):
    modelo(respuesta)
    evaluacion = clasificacion.evaluar(_foto(), Flujo.ORGANICO)
    assert evaluacion.veredicto == "no_concluyente" and evaluacion.problemas == []
    assert evaluacion.error and evaluacion.mensaje


@pytest.mark.parametrize(("activa", "foto", "error"), [
    (False, _foto(), "desactivada"),
    (True, _foto(tipo="image/gif"), "tipo_no_soportado"),
    (True, _foto(contenido=b""), "foto_vacia"),
    (True, _foto(contenido=b"0" * (5 * 1024 * 1024 + 1)), "foto_muy_grande"),
])
def test_no_se_consulta_al_modelo_si_esta_desactivada_o_la_foto_no_sirve(modelo, monkeypatch, activa, foto, error):
    falso = modelo(MAL_SEPARADA)
    if not activa:
        monkeypatch.delenv("CLASIFICACION_ACTIVA")
    evaluacion = clasificacion.evaluar(foto, None)
    assert falso.pedidos == []
    assert evaluacion.veredicto == "no_concluyente" and evaluacion.error == error


def _admin() -> TestClient:
    cliente = TestClient(app)
    respuesta = cliente.post("/api/acceso/entrar", json={"usuario": "admin", "clave": "ecoconecta-demo"})
    assert respuesta.status_code == 200, respuesta.text
    return cliente


def _whatsapp(admin: TestClient, texto: str, media_url: str | None = None) -> list[str]:
    respuesta = admin.post("/api/whatsapp/simulador", json={"telefono": TELEFONO, "texto": texto, "media_url": media_url})
    assert respuesta.status_code == 200, respuesta.text
    return respuesta.json()


def test_una_foto_por_whatsapp_trae_su_revision_y_la_pieza_del_flujo_sin_frenar_el_pedido(modelo):
    falso, admin = modelo(MAL_SEPARADA), _admin()
    zona = admin.get("/api/directorio/zonas").json()[0]["id"]
    vecina = {"telefono": TELEFONO, "nombre": "Vecina de Prueba", "tipo": "hogar", "zona_id": zona,
              "direccion": "Torre 1, apto 101", "autoriza_datos": True}
    assert admin.post("/api/directorio/solicitantes", json=vecina).status_code == 201
    _whatsapp(admin, "2")  # empieza a pedir reciclables
    textos = _whatsapp(admin, "", media_url="data:image/jpeg;base64," + base64.b64encode(JPEG).decode())
    assert "comida" in textos[0] and "Qué va en la bolsa de reciclables" in textos[1]
    foto, tipo, pedido = falso.pedidos[0]
    assert (foto, tipo) == (JPEG, "image/jpeg") and "reciclables" in pedido
    assert TELEFONO not in pedido and "Vecina" not in pedido  # §9: al modelo, solo la foto y el flujo
    assert _whatsapp(admin, "1") == []  # el pedido sigue: elige la franja y queda registrado


def test_la_api_evalua_una_foto_solo_con_sesion(modelo):
    modelo(MAL_SEPARADA)
    cabeceras = {"Content-Type": "image/jpeg"}
    sin_sesion = TestClient(app).post("/api/clasificacion/evaluar", content=JPEG, headers=cabeceras)
    assert sin_sesion.status_code == 401
    respuesta = _admin().post("/api/clasificacion/evaluar", params={"flujo": "reciclable"}, content=JPEG,
                              headers=cabeceras)
    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["problemas"] == ["organico_en_reciclables", "envases_sucios"]


class RespuestaFalsa:
    """Lo que devuelve urlopen: cuerpo y tipo de contenido."""

    def __init__(self, cuerpo: bytes, tipo: str):
        self.cuerpo, self.headers = cuerpo, email.message.Message()
        self.headers["Content-Type"] = tipo

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def read(self, *_):
        return self.cuerpo


def _azure(monkeypatch, salida: list[dict]) -> list[urllib.request.Request]:
    """Responde como la API Responses de Azure y guarda la petición que se le hizo."""
    monkeypatch.setenv("OPENAI_BASE_URL", "https://recurso.openai.azure.com/openai/v1/")
    monkeypatch.setenv("OPENAI_API_KEY", "clave-de-prueba")
    monkeypatch.setenv("CLASIFICACION_MODELO", "clasificacion-residuos")
    cuerpo, pedidos = json.dumps({"status": "completed", "output": salida}).encode(), []
    monkeypatch.setattr(urllib.request, "urlopen",
                        lambda pedido, timeout: pedidos.append(pedido) or RespuestaFalsa(cuerpo, "application/json"))
    return pedidos


def test_a_azure_le_llegan_la_foto_y_el_esquema_estricto_y_se_toma_el_texto_final(monkeypatch):
    pedidos = _azure(monkeypatch, [
        {"type": "reasoning", "id": "rs_1", "summary": []},
        {"type": "message", "id": "msg_1", "role": "assistant", "status": "completed",
         "content": [{"type": "output_text", "text": json.dumps(MAL_SEPARADA), "annotations": []}]}])
    assert json.loads(vision.preguntar(JPEG, "image/jpeg", "Va a entregar reciclables.")) == MAL_SEPARADA
    pedido, cuerpo = pedidos[0], json.loads(pedidos[0].data)
    assert pedido.full_url == "https://recurso.openai.azure.com/openai/v1/responses"
    assert pedido.get_header("Authorization") == "Bearer clave-de-prueba"
    assert cuerpo["model"] == "clasificacion-residuos" and cuerpo["store"] is False
    imagen = cuerpo["input"][0]["content"][1]["image_url"]
    assert imagen == "data:image/jpeg;base64," + base64.b64encode(JPEG).decode()
    assert cuerpo["text"]["format"]["strict"] is True


def test_si_azure_se_niega_a_responder_se_lanza_para_que_el_contrato_responda_no_concluyente(monkeypatch):
    _azure(monkeypatch, [{"type": "message", "id": "msg_1", "role": "assistant", "status": "completed",
                          "content": [{"type": "refusal", "refusal": "No puedo ayudar con eso."}]}])
    with pytest.raises(ValueError):
        vision.preguntar(JPEG, "image/jpeg", "Va a entregar orgánicos.")


@pytest.mark.parametrize(("url", "lleva_credencial"), [
    ("https://api.twilio.com/2010-04-01/Accounts/AC1/Messages/MM1/Media/ME1", True),
    ("https://otro-sitio.example/foto.jpg", False),
])
def test_las_credenciales_de_twilio_solo_viajan_a_twilio_y_no_siguen_redirecciones(monkeypatch, url, lleva_credencial):
    monkeypatch.setenv("TWILIO_ACCOUNT_SID", "AC-prueba")
    monkeypatch.setenv("TWILIO_AUTH_TOKEN", "token-de-prueba")
    pedidos = []
    monkeypatch.setattr(urllib.request, "urlopen",
                        lambda pedido, timeout: pedidos.append(pedido) or RespuestaFalsa(JPEG, "image/jpeg"))
    assert fotos.descargar(url) == clasificacion.Foto(contenido=JPEG, tipo="image/jpeg")
    assert ("Authorization" in pedidos[0].unredirected_hdrs) == lleva_credencial
    assert "Authorization" not in pedidos[0].headers  # S3, adonde redirige Twilio, no la recibe
