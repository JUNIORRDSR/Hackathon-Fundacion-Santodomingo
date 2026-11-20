from datetime import date, time
from decimal import Decimal
from uuid import uuid4

import pytest

from app.compartido.tipos import Canal, ErrorDeNegocio, Flujo, Franja
from app.modulos.puntos.dominio import Regla
from app.modulos.solicitudes.dominio import Estado, Solicitud

DIA, HORA = date(2026, 11, 21), time(19, 0)


def nueva() -> Solicitud:
    return Solicitud.recibir("solicitante", codigo="ORG-0001", solicitante_id=uuid4(), flujo=Flujo.ORGANICO,
                             zona_id=uuid4(), direccion="Torre 34 apto 402", preferencia=Franja.NOCHE,
                             observaciones="", canal=Canal.WHATSAPP)


def programada() -> Solicitud:
    solicitud = nueva()
    solicitud.asignar(uuid4(), uuid4())
    solicitud.programar(DIA, HORA, uuid4())
    return solicitud


def test_el_ciclo_completo_queda_en_el_historial():  # RN-04
    solicitud = programada()
    solicitud.registrar_recoleccion(Decimal("2.5"), uuid4())
    assert solicitud.estado == Estado.RECOLECTADA
    assert [c.estado for c in solicitud.historial] == [Estado.RECIBIDA, Estado.ASIGNADA, Estado.PROGRAMADA,
                                                       Estado.RECOLECTADA]


def test_no_se_programa_sin_encargado():  # RN-02
    with pytest.raises(ErrorDeNegocio):
        nueva().programar(DIA, HORA, uuid4())


def test_no_se_recoge_lo_que_no_esta_programado():
    solicitud = nueva()
    solicitud.asignar(uuid4(), uuid4())
    with pytest.raises(ErrorDeNegocio):
        solicitud.registrar_recoleccion(None, uuid4())


def test_se_reasigna_y_reprograma_antes_del_resultado():
    solicitud, otro = programada(), uuid4()
    solicitud.asignar(otro, uuid4())
    solicitud.programar(date(2026, 11, 22), HORA, uuid4())
    assert (solicitud.estado, solicitud.encargado_id, solicitud.dia) == (Estado.PROGRAMADA, otro, date(2026, 11, 22))


def test_rechazo_y_cancelacion_piden_motivo():
    with pytest.raises(ErrorDeNegocio):
        programada().rechazar(" ", uuid4())
    with pytest.raises(ErrorDeNegocio):
        nueva().cancelar("", "solicitante")


def test_una_solicitud_cerrada_no_se_toca():
    solicitud = programada()
    solicitud.rechazar("Venía mezclada con plástico", uuid4())
    with pytest.raises(ErrorDeNegocio):
        solicitud.cancelar("Ya no la necesito", "solicitante")


def test_los_kilos_son_positivos():
    with pytest.raises(ErrorDeNegocio):
        programada().registrar_recoleccion(Decimal(0), uuid4())


def test_la_regla_de_puntos_se_explica():  # RN-06
    regla = Regla(1, {Flujo.ORGANICO: 10, Flujo.RECICLABLE: 10}, {Flujo.ORGANICO: Decimal(1), Flujo.RECICLABLE: Decimal(1)})
    assert regla.calcular(Flujo.ORGANICO, Decimal("2.5")) == (12, "10 por separar bien + 2 por 2,5 kg")
    assert regla.calcular(Flujo.RECICLABLE, None) == (10, "10 por separar bien, sin pesar")
