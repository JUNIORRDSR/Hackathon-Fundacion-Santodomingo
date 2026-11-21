import json

import pytest

from app.modulos.whatsapp import registro
from app.modulos.whatsapp.contrato import Turno
from app.modulos.whatsapp.menu import ConversadorMenu


def _editar(ruta, plantillas):
    ruta.write_text(json.dumps(plantillas, ensure_ascii=False), encoding="utf-8")


def test_el_menu_actualiza_el_texto_y_mantiene_las_opciones(monkeypatch, tmp_path):
    ruta = tmp_path / "respuestas.json"
    monkeypatch.setenv("WHATSAPP_REPLIES_FILE", str(ruta))
    menu = ConversadorMenu()
    turno = Turno(nombre="Ana", texto="Hola")
    antes = menu.responder(turno, {}, None).textos[0]
    assert antes.startswith("Hola, Ana. ¿Qué quieres hacer?\n1 Pedir recolección de orgánicos")
    _editar(ruta, {"menu_inicio": "Bienvenida, {nombre}.\n{opciones}\nPara salir usa {comando}."})
    despues = menu.responder(turno, {}, None).textos[0]
    assert despues.startswith("Bienvenida, Ana.\n1 Pedir recolección de orgánicos")
    assert despues.endswith("Para salir usa CANCELAR.")
    pedido = menu.responder(Turno(nombre="Ana", texto="1"), {}, None)
    assert pedido.memoria == {"pidiendo": "organico"}
    assert pedido.textos == ["¿A qué hora te queda mejor?\n1 Mañana\n2 Tarde\n3 Noche"]


@pytest.mark.parametrize("contenido", [
    '{', '{"registro_tipo":"Sin opciones"}', '{"registro_tipo":"{opciones.__class__}"}',
    '{"registro_tipo":"{opciones!r}"}', '{"registro_tipo":"{opciones:>10}"}',
    '{"registro_tipo": null}', '{"clave_ajena":"valor"}',
])
def test_una_edicion_invalida_conserva_el_ultimo_texto(monkeypatch, tmp_path, contenido):
    ruta = tmp_path / "respuestas.json"
    monkeypatch.setenv("WHATSAPP_REPLIES_FILE", str(ruta))
    _editar(ruta, {"registro_tipo": "Elige tu perfil\n{opciones}"})
    esperado = ["Elige tu perfil\n1 Hogar\n2 Negocio"]
    assert registro.responder("1", "+573000000001", {"paso": "autorizacion"}) == esperado
    ruta.write_text(contenido, encoding="utf-8")
    assert registro.responder("1", "+573000000001", {"paso": "autorizacion"}) == esperado
    _editar(ruta, {"registro_tipo": "Selecciona un perfil\n{opciones}"})
    assert registro.responder("1", "+573000000001", {"paso": "autorizacion"}) == [
        "Selecciona un perfil\n1 Hogar\n2 Negocio",
    ]
