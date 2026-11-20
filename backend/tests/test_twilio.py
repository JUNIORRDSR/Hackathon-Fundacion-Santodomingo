"""El transporte de Twilio autentica y entrega mensajes al mismo bot que usa el simulador."""
import base64
import hashlib
import hmac
from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from urllib.parse import parse_qsl, urlencode
from xml.etree import ElementTree

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modulos.directorio import contrato as directorio
from app.modulos.whatsapp import bot, transporte_twilio
from app.modulos.whatsapp.transporte_twilio import TransporteTwilio

RUTA = "/api/whatsapp/twilio"
URL = f"https://ecoconecta.example{RUTA}"
CUENTA = "AC" + "0" * 32
TOKEN = "token-de-prueba"
REMITENTE = "whatsapp:+10000000000"
TELEFONO = "+573000000002"
TELEFONO_ALIAS = "+573000000004"
TELEFONO_CONCURRENCIA = "+573000000005"
TELEFONO_TWIML = "+573000000007"
TELEFONO_AVISOS = "+573000000008"
ALIAS = "CO.PruebaEcoConecta"
ALIAS_PORTAFOLIO = "CO.ENT.PruebaEcoConecta"


@pytest.fixture
def cliente_twilio(monkeypatch, request):
    telefonos = (TELEFONO, TELEFONO_ALIAS, TELEFONO_CONCURRENCIA, TELEFONO_TWIML, TELEFONO_AVISOS)
    valores = {
        "TWILIO_ACCOUNT_SID": CUENTA,
        "TWILIO_AUTH_TOKEN": TOKEN,
        "TWILIO_WHATSAPP_FROM": REMITENTE,
        "TWILIO_WEBHOOK_URL": URL,
        "WHATSAPP_CONTACT_ALIASES": f"{ALIAS}={TELEFONO_ALIAS}, {ALIAS_PORTAFOLIO}={TELEFONO_ALIAS}",
        "WHATSAPP_PILOT_NUMBERS": ",".join(telefonos),
        "TWILIO_RESPUESTA_TWIML": "1" if getattr(request, "param", False) else "0",
    }
    for nombre, valor in valores.items():
        monkeypatch.setenv(nombre, valor)
    salidas = []

    def abrir(pedido, *, timeout):
        salidas.append(dict(parse_qsl(pedido.data.decode())))
        return BytesIO(b"{}")

    monkeypatch.setattr(transporte_twilio.urllib.request, "urlopen", abrir)
    anterior = bot.transporte()
    bot.configurar(transporte=TransporteTwilio.desde_entorno())
    try:
        yield TestClient(app), salidas
    finally:
        bot.configurar(transporte=anterior)


def _parametros(remitente: str, numero: int, texto: str = "Hola") -> list[tuple[str, str]]:
    return [("From", f"whatsapp:{remitente}"), ("To", REMITENTE), ("Body", texto),
            ("AccountSid", CUENTA), ("MessageSid", f"SM{numero:032x}")]


def _firma(parametros: list[tuple[str, str]], url: str = URL) -> str:
    datos = url + "".join(clave + valor for clave, valor in sorted(set(parametros)))
    mac = hmac.new(TOKEN.encode(), datos.encode(), hashlib.sha1).digest()
    return base64.b64encode(mac).decode()


def _entregar(cliente: TestClient, parametros: list[tuple[str, str]], firma: str | None = None):
    cabeceras = {"X-Twilio-Signature": firma or _firma(parametros),
                "Content-Type": "application/x-www-form-urlencoded"}
    return cliente.post(RUTA, content=urlencode(parametros), headers=cabeceras)


def test_la_firma_usa_la_url_publica_y_todos_los_valores_del_formulario(cliente_twilio):
    cliente, salidas = cliente_twilio
    parametros = _parametros(TELEFONO, 1, "") + [("ParametroNuevo", "a"), ("ParametroNuevo", "b")]
    url_interna = f"http://testserver{RUTA}"
    assert _entregar(cliente, parametros, _firma(parametros, url_interna)).status_code == 403

    sin_parametro = [(clave, valor) for clave, valor in parametros if not (clave == "ParametroNuevo" and valor == "b")]
    assert _entregar(cliente, parametros, _firma(sin_parametro)).status_code == 403
    assert not salidas

    respuesta = _entregar(cliente, parametros)
    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.text == "<Response/>"
    assert salidas[-1]["To"] == f"whatsapp:{TELEFONO}" and "Soy EcoConecta" in salidas[-1]["Body"]


def test_el_alias_autorizado_comparte_el_estado_del_telefono_y_es_el_destino_de_respuesta(cliente_twilio):
    cliente, salidas = cliente_twilio
    parametros = _parametros(ALIAS_PORTAFOLIO, 2) + [("ExternalUserId", f"whatsapp:{ALIAS}")]
    assert _entregar(cliente, parametros).status_code == 200
    assert _entregar(cliente, _parametros(TELEFONO_ALIAS, 3, "1")).status_code == 200

    assert len(salidas) == 2
    assert all(salida["To"] == f"whatsapp:{ALIAS}" for salida in salidas)
    assert "Hogar" in salidas[-1]["Body"]
    assert len(bot.enviados(TELEFONO_ALIAS)) == 2


def test_waid_no_autoriza_alias_desconocidos_y_el_piloto_se_respeta(cliente_twilio):
    cliente, salidas = cliente_twilio
    parametros = _parametros("CO.pruebaecoconecta", 4) + [("WaId", TELEFONO_ALIAS[1:])]
    respuesta = _entregar(cliente, parametros)
    assert respuesta.status_code == 400
    assert "WaId" not in respuesta.text and TELEFONO_ALIAS not in respuesta.text
    assert _entregar(cliente, _parametros("+573000000006", 5)).status_code == 403
    assert not salidas


def test_entregas_concurrentes_del_mismo_sid_solo_avanzan_el_bot_una_vez(cliente_twilio):
    cliente, salidas = cliente_twilio
    parametros = _parametros(TELEFONO_CONCURRENCIA, 6)
    with ThreadPoolExecutor(max_workers=2) as ejecutor:
        respuestas = list(ejecutor.map(lambda _: _entregar(cliente, parametros), range(2)))

    assert [respuesta.status_code for respuesta in respuestas] == [200, 200]
    assert len(salidas) == 1
    assert len(bot.enviados(TELEFONO_CONCURRENCIA)) == 1


@pytest.mark.parametrize("cliente_twilio", [True], indirect=True)
def test_responde_con_twiml_al_remitente_y_el_sid_repetido_no_responde(cliente_twilio):
    cliente, salidas = cliente_twilio
    parametros = _parametros(TELEFONO_TWIML, 7)
    respuesta = _entregar(cliente, parametros)
    assert respuesta.status_code == 200
    assert respuesta.headers["content-type"].startswith("application/xml")
    xml = ElementTree.fromstring(respuesta.content)
    assert xml.tag == "Response"
    mensaje, = xml.findall("Message")
    assert "to" not in mensaje.attrib
    assert "Soy EcoConecta" in "".join(mensaje.itertext())

    repetida = _entregar(cliente, parametros)
    assert repetida.status_code == 200
    assert list(ElementTree.fromstring(repetida.content)) == []
    assert len(bot.enviados(TELEFONO_TWIML)) == 1
    assert salidas == []


@pytest.mark.parametrize("cliente_twilio", [True], indirect=True)
def test_aviso_de_solicitud_sale_en_twiml_y_habilitacion_fuera_del_webhook_sale_por_rest(cliente_twilio):
    cliente, salidas = cliente_twilio
    solicitante = directorio.registrar_solicitante(directorio.NuevoSolicitante(
        telefono=TELEFONO_AVISOS, nombre="Prueba TwiML", tipo="hogar", zona_id=directorio.zonas()[0].id,
        direccion="Dirección ficticia", autoriza_datos=True,
    ), habilitado=False)
    directorio.habilitar(solicitante.id)
    aviso_habilitacion, = salidas
    assert aviso_habilitacion["To"] == f"whatsapp:{TELEFONO_AVISOS}"
    assert "Ya puedes pedir recolecciones" in aviso_habilitacion["Body"]

    assert _entregar(cliente, _parametros(TELEFONO_AVISOS, 8, "1")).status_code == 200
    respuesta = _entregar(cliente, _parametros(TELEFONO_AVISOS, 9, "3"))
    assert respuesta.status_code == 200
    mensaje, = ElementTree.fromstring(respuesta.content).findall("Message")
    assert "Recibimos tu solicitud ORG-" in "".join(mensaje.itertext())
    assert salidas == [aviso_habilitacion]
