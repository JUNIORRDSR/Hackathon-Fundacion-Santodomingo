"""El transporte de Twilio autentica y entrega mensajes al mismo bot que usa el simulador."""
import asyncio
import base64
import hashlib
import hmac
from concurrent.futures import ThreadPoolExecutor
from contextlib import aclosing
from io import BytesIO
from threading import Event
from urllib.error import HTTPError
from urllib.parse import parse_qsl, urlencode
from uuid import uuid4
from xml.etree import ElementTree

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.modulos.directorio import contrato as directorio
from app.modulos.whatsapp import bot, contactos, monitor, transporte_twilio
from app.modulos.whatsapp.contrato import MensajeSaliente, Perfil, Respuesta
from app.modulos.whatsapp.eventos_monitor import GENERAL, EventosMonitor
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
TELEFONO_MONITOR = "+15555550113"
TELEFONO_REINTENTO = "+15555550114"
ALIAS = "CO.PruebaEcoConecta"
ALIAS_PORTAFOLIO = "CO.ENT.PruebaEcoConecta"


@pytest.fixture
def cliente_twilio(monkeypatch, request):
    telefonos = (TELEFONO, TELEFONO_ALIAS, TELEFONO_CONCURRENCIA, TELEFONO_TWIML, TELEFONO_AVISOS,
                 TELEFONO_MONITOR, TELEFONO_REINTENTO)
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


def test_el_perfil_se_guarda_y_un_bsuid_ya_visto_con_su_telefono_encuentra_al_vecino(cliente_twilio):
    """ADR-0016: si después escribe solo con su usuario de WhatsApp, sigue siendo el mismo vecino con sus puntos."""
    cliente, _ = cliente_twilio
    bsuid = "CO.1234567890123456"
    perfil = [("ExternalUserId", f"whatsapp:{bsuid}"), ("Username", "vecina_luz"), ("ProfileName", " Luz  Marina ")]
    assert _entregar(cliente, _parametros(TELEFONO, 20) + perfil).status_code == 200
    assert contactos.perfil_de(TELEFONO) == Perfil(nombre="Luz Marina", usuario="vecina_luz", bsuid=bsuid)

    solo_usuario = _parametros(bsuid, 21, "¿Siguen ahí?") + [("Username", "<b>no</b>")]
    assert _entregar(cliente, solo_usuario).status_code == 200
    assert any(m.texto == "¿Siguen ahí?" for m in monitor.mensajes_de(TELEFONO) if m.direccion == "entrante")
    assert contactos.perfil_de(TELEFONO).usuario == "vecina_luz"  # un usuario inválido no pisa el bueno


def test_entregas_concurrentes_del_mismo_sid_solo_avanzan_el_bot_una_vez(cliente_twilio):
    cliente, salidas = cliente_twilio
    parametros = _parametros(TELEFONO_CONCURRENCIA, 6)
    with ThreadPoolExecutor(max_workers=2) as ejecutor:
        respuestas = list(ejecutor.map(lambda _: _entregar(cliente, parametros), range(2)))

    assert [respuesta.status_code for respuesta in respuestas] == [200, 200]
    assert len(salidas) == 1
    assert len(bot.enviados(TELEFONO_CONCURRENCIA)) == 1


@pytest.mark.parametrize("cliente_twilio", [True], indirect=True)
def test_el_monitor_ve_el_mensaje_antes_de_la_respuesta(cliente_twilio, monkeypatch):
    cliente, _ = cliente_twilio
    directorio.registrar_solicitante(directorio.NuevoSolicitante(
        telefono=TELEFONO_MONITOR, nombre="Prueba Monitor", tipo="hogar", zona_id=directorio.zonas()[0].id,
        direccion="Dirección ficticia", autoriza_datos=True,
    ), habilitado=True)
    assert cliente.post("/api/acceso/entrar", json={"usuario": "fundacion", "clave": "ecoconecta-demo"}).status_code == 200
    inicio, continuar = Event(), Event()

    class ConversadorEnPausa:
        def responder(self, turno, memoria, herramientas):
            inicio.set()
            assert continuar.wait(15)
            return Respuesta(textos=["Respuesta del bot"], memoria=memoria)

    monkeypatch.setattr(bot, "_conversador", ConversadorEnPausa())
    asyncio.run(_probar_publicacion(cliente, inicio, continuar))


async def _probar_publicacion(cliente, inicio, continuar):
    hilo = f"/api/whatsapp/conversaciones/{TELEFONO_MONITOR}/mensajes"
    parametros = _parametros(TELEFONO_MONITOR, 23)
    eventos = EventosMonitor()
    try:
        async with aclosing(eventos.flujo(uuid4())) as flujo:
            await anext(flujo)
            assert await asyncio.wait_for(anext(flujo), 5) == GENERAL
            entrega = asyncio.create_task(asyncio.to_thread(_entregar, cliente, parametros))
            try:
                assert await asyncio.to_thread(inicio.wait, 5)
                assert await asyncio.wait_for(anext(flujo), 5) == GENERAL
                mensajes = await asyncio.to_thread(cliente.get, hilo)
                assert [m["texto"] for m in mensajes.json()] == ["Hola"]
            finally:
                continuar.set()
                respuesta = await entrega

            assert respuesta.status_code == 200
            assert await asyncio.wait_for(anext(flujo), 5) == GENERAL
            mensajes = await asyncio.to_thread(cliente.get, hilo)
            assert [(m["direccion"], m["texto"]) for m in mensajes.json()] == [
                ("entrante", "Hola"), ("saliente", "Respuesta del bot"),
            ]
    finally:
        await eventos.cerrar()


def test_un_reintento_tras_fallar_el_turno_no_duplica_el_mensaje(cliente_twilio, monkeypatch):
    cliente, salidas = cliente_twilio
    parametros = _parametros(TELEFONO_REINTENTO, 24)

    def fallar(telefono, memoria):
        raise RuntimeError("Fallo durante el turno")

    with monkeypatch.context() as parche:
        parche.setattr(bot, "_guardar_memoria", fallar)
        with pytest.raises(RuntimeError, match="Fallo durante el turno"):
            _entregar(cliente, parametros)
    assert [m.direccion for m in monitor.mensajes_de(TELEFONO_REINTENTO)] == ["entrante"]
    assert not salidas

    assert _entregar(cliente, parametros).status_code == 200
    assert _entregar(cliente, parametros).status_code == 200
    assert [m.direccion for m in monitor.mensajes_de(TELEFONO_REINTENTO)] == ["entrante", "saliente"]
    assert len(salidas) == 1


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
    assert mensaje.attrib == {}
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


@pytest.mark.parametrize("cliente_twilio", [True], indirect=True)
def test_coordinacion_envia_de_inmediato_aunque_el_bot_use_twiml(cliente_twilio):
    cliente, salidas = cliente_twilio
    monitor.tomar_control(TELEFONO_TWIML, "Prueba")
    assert monitor.responder(TELEFONO_TWIML, "Respuesta de coordinación")
    salida, = salidas
    assert salida["Body"] == "Respuesta de coordinación"
    assert salida["To"] == f"whatsapp:{TELEFONO_TWIML}"
    respuesta = _entregar(cliente, _parametros(TELEFONO_TWIML, 21))
    assert respuesta.status_code == 200
    assert not ElementTree.fromstring(respuesta.content).findall("Message")
    assert salidas == [salida]


def test_rest_registra_el_fallo_sin_datos_del_mensaje(cliente_twilio, monkeypatch, caplog):
    def rechazar(pedido, *, timeout):
        cuerpo = BytesIO(b'{"code":0,"message":"datos privados del proveedor"}')
        raise HTTPError(pedido.full_url, 400, "Bad Request", {}, cuerpo)

    monkeypatch.setattr(transporte_twilio.urllib.request, "urlopen", rechazar)
    mensaje = MensajeSaliente(telefono=TELEFONO_AVISOS, texto="Mensaje ficticio")
    assert bot.enviar(mensaje, autor="coordinacion") == "fallido"
    assert monitor.mensajes_de(TELEFONO_AVISOS)[-1].estado == "fallido"
    assert "HTTP 400, código 0" in caplog.text
    assert "datos privados del proveedor" not in caplog.text
