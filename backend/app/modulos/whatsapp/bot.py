"""Implementación por defecto de whatsapp: registro determinista, menú numerado, simulador y avisos.

La pieza de Jorge entra con TRANSPORTE=twilio y la de Leonardo con CONVERSADOR=llm (ADR-0003).
"""
import importlib
import logging
import os
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import insert, select
from sqlalchemy.dialects.postgresql import insert as insertar_o_actualizar

from app.compartido.bd import transaccion
from app.compartido.eventos import suscribir_despues
from app.compartido.formato import NOMBRE_FLUJO, fecha_larga, hora_corta, kilos
from app.compartido.tipos import ErrorDeNegocio, Flujo, Franja, NoEncontrado, TipoGenerador
from app.modulos.contenidos import contrato as contenidos
from app.modulos.directorio import contrato as directorio
from app.modulos.puntos import contrato as puntos
from app.modulos.solicitudes import contrato as solicitudes
from app.modulos.whatsapp import tablas as t
from app.modulos.whatsapp.contrato import (Conversador, Herramientas, MensajeEntrante, MensajeSaliente, Respuesta,
                                           Transporte, Turno)

log = logging.getLogger("whatsapp")

MENU = ("¿Qué quieres hacer?\n1 Pedir recolección de orgánicos\n2 Pedir recolección de reciclables\n"
        "3 Ver mis solicitudes\n4 Ver mis puntos\n5 Aprender a separar\n"
        "Para cancelar, escribe CANCELAR y el código (por ejemplo, CANCELAR ORG-0001).")
FRANJAS = "¿A qué hora te queda mejor?\n1 Mañana\n2 Tarde\n3 Noche"
AUTORIZACION = ("¡Hola! Soy EcoConecta, de la Fundación Santo Domingo. Para coordinar tus recolecciones guardamos tu "
                "número, tu nombre, tu zona y tu dirección, y solo los usamos para eso. ¿Lo autorizas?\n1 Sí\n2 No")
ESTADO = {"recibida": "recibida; la coordinación la está revisando", "asignada": "asignada; falta acordar día y hora",
          "programada": "programada", "recolectada": "recolectada", "rechazada": "rechazada",
          "cancelada": "cancelada"}


class TransporteSimulado:
    """No envía nada: el registro de mensajes (whatsapp.mensajes) hace de bandeja de salida del simulador."""

    def enviar(self, mensaje: MensajeSaliente) -> None:
        pass


class ConversadorMenu:
    """Bot por defecto: menú numerado. El LLM de Leonardo lo reemplaza con CONVERSADOR=llm."""

    def responder(self, turno: Turno, memoria: dict, herramientas: Herramientas) -> Respuesta:
        texto = turno.texto.strip().lower()
        if "pidiendo" in memoria:
            franja = {"1": Franja.MANANA, "2": Franja.TARDE, "3": Franja.NOCHE}.get(texto)
            if franja is None:
                return Respuesta(textos=[FRANJAS], memoria=memoria)
            flujo = Flujo(memoria.pop("pidiendo"))
            try:
                herramientas.pedir_recoleccion(flujo, franja)
            except ErrorDeNegocio as error:
                return Respuesta(textos=[str(error)], memoria=memoria)
            return Respuesta(textos=[], memoria=memoria)  # el aviso de «recibida» ya lleva el código
        if texto in ("1", "2"):
            memoria["pidiendo"] = Flujo.ORGANICO.value if texto == "1" else Flujo.RECICLABLE.value
            return Respuesta(textos=[FRANJAS], memoria=memoria)
        if texto == "3":
            return Respuesta(textos=[_estado_de(herramientas)], memoria=memoria)
        if texto == "4":
            return Respuesta(textos=[f"Llevas {herramientas.mis_puntos()} puntos."], memoria=memoria)
        if texto == "5":
            piezas = [_pieza(c) for c in herramientas.aprender()]
            return Respuesta(textos=piezas or ["Pronto tendremos material."], memoria=memoria)
        if texto.startswith("cancelar"):
            try:
                herramientas.cancelar(texto.removeprefix("cancelar").strip())
            except (ErrorDeNegocio, NoEncontrado) as error:
                return Respuesta(textos=[str(error)], memoria=memoria)
            return Respuesta(textos=[], memoria=memoria)  # el aviso de cancelación ya sale
        return Respuesta(textos=[f"Hola, {turno.nombre}. {MENU}"], memoria=memoria)


_transporte: Transporte = TransporteSimulado()
_conversador: Conversador = ConversadorMenu()


def configurar(transporte: Transporte | None = None, conversador: Conversador | None = None) -> None:
    global _transporte, _conversador
    _transporte = transporte or _transporte
    _conversador = conversador or _conversador


def configurar_desde_entorno() -> None:
    """TRANSPORTE=twilio carga transporte_twilio.TransporteTwilio (Jorge) y CONVERSADOR=llm carga
    conversador_llm.ConversadorLLM (Leonardo). Cada clase expone desde_entorno()."""
    if os.getenv("TRANSPORTE", "simulado") == "twilio":
        modulo = importlib.import_module("app.modulos.whatsapp.transporte_twilio")
        configurar(transporte=modulo.TransporteTwilio.desde_entorno())
    if os.getenv("CONVERSADOR", "menu") == "llm":
        modulo = importlib.import_module("app.modulos.whatsapp.conversador_llm")
        configurar(conversador=modulo.ConversadorLLM.desde_entorno())


def recibir(mensaje: MensajeEntrante) -> list[str]:
    """Entrada de todo mensaje, del webhook real o del simulador. Las respuestas salen después del commit."""
    with transaccion():
        memoria = _memoria(mensaje.telefono)
        solicitante = directorio.solicitante_por_telefono(mensaje.telefono)
        if solicitante is None:
            textos = _registro(mensaje, memoria)
        elif solicitante.estado != directorio.EstadoSolicitante.HABILITADO:
            textos = ["Tu registro está en revisión. Te avisamos por aquí cuando quedes habilitado."]
        else:
            turno = Turno(nombre=solicitante.nombre, texto=mensaje.texto, media_url=mensaje.media_url)
            try:
                respuesta = _conversador.responder(turno, memoria, Herramientas(solicitante.id))
            except Exception:
                log.exception("El conversador falló; responde el menú")
                respuesta = ConversadorMenu().responder(turno, {}, Herramientas(solicitante.id))
            textos, memoria = respuesta.textos, respuesta.memoria
        _guardar_memoria(mensaje.telefono, memoria)
    for texto in textos:
        _enviar(MensajeSaliente(telefono=mensaje.telefono, texto=texto))
    return textos


def enviados(telefono: str | None = None) -> list[MensajeSaliente]:
    """Todo lo que salió por WhatsApp, en orden: respuestas y avisos."""
    consulta = select(t.mensajes).order_by(t.mensajes.c.id)
    if telefono is not None:
        consulta = consulta.where(t.mensajes.c.telefono == telefono)
    with transaccion() as c:
        return [MensajeSaliente.model_validate(dict(fila._mapping)) for fila in c.execute(consulta).all()]


def _enviar(mensaje: MensajeSaliente) -> None:
    try:
        _transporte.enviar(mensaje)
        estado = "enviado"
    except Exception:
        log.exception("No se pudo enviar un mensaje de WhatsApp")
        estado = "fallido"
    with transaccion() as c:
        c.execute(insert(t.mensajes).values(**mensaje.model_dump(), estado=estado, enviado_en=datetime.now(timezone.utc)))


def _memoria(telefono: str) -> dict:
    with transaccion() as c:
        fila = c.execute(select(t.conversaciones.c.memoria).where(t.conversaciones.c.telefono == telefono)).first()
    return dict(fila.memoria) if fila else {}


def _guardar_memoria(telefono: str, memoria: dict) -> None:
    valores = {"telefono": telefono, "memoria": memoria, "actualizada": datetime.now(timezone.utc)}
    with transaccion() as c:
        c.execute(insertar_o_actualizar(t.conversaciones).values(valores)
                  .on_conflict_do_update(index_elements=[t.conversaciones.c.telefono], set_=valores))


def _registro(mensaje: MensajeEntrante, memoria: dict) -> list[str]:
    """Alta determinista por WhatsApp: autorización (Ley 1581) y datos mínimos. Queda PENDIENTE (RN-08)."""
    texto = mensaje.texto.strip()
    paso = memoria.get("paso")
    if paso is None:
        memoria["paso"] = "autorizacion"
        return [AUTORIZACION]
    if paso == "autorizacion":
        if texto != "1":
            memoria.clear()
            return ["Sin tu autorización no podemos registrarte. Si cambias de opinión, escribe HOLA."]
        memoria["paso"] = "tipo"
        return ["¿Eres\n1 Hogar\n2 Negocio?"]
    if paso == "tipo":
        if texto not in ("1", "2"):
            return ["Responde 1 si eres un hogar o 2 si eres un negocio."]
        tipo = TipoGenerador.HOGAR if texto == "1" else TipoGenerador.UNIDAD_PRODUCTIVA
        memoria.update(paso="zona", tipo=tipo.value)
        return [_menu_zonas()]
    if paso == "zona":
        zonas = directorio.zonas()
        if not texto.isdigit() or not 1 <= int(texto) <= len(zonas):
            return [_menu_zonas()]
        memoria.update(paso="direccion", zona_id=str(zonas[int(texto) - 1].id))
        return ["Escribe tu dirección: torre y apartamento, o el nombre y la dirección del negocio."]
    if paso == "direccion":
        if len(texto) < 3:
            return ["Escribe la dirección completa, por favor."]
        memoria.update(paso="nombre", direccion=texto[:120])
        return ["¿Cómo te llamamos?"]
    if len(texto) < 2:
        return ["Escribe tu nombre o cómo quieres que te llamemos."]
    directorio.registrar_solicitante(directorio.NuevoSolicitante(
        telefono=mensaje.telefono, nombre=texto[:60], tipo=memoria["tipo"], zona_id=memoria["zona_id"],
        direccion=memoria["direccion"], autoriza_datos=True), habilitado=False)
    memoria.clear()
    return [f"Listo, {texto[:60]}. La coordinación revisa tu registro y te avisamos por aquí."]


def _menu_zonas() -> str:
    return "¿En qué zona estás?\n" + "\n".join(f"{i} {z.nombre}" for i, z in enumerate(directorio.zonas(), start=1))


def _estado_de(herramientas: Herramientas) -> str:
    lineas = []
    for s in herramientas.mis_solicitudes()[:5]:
        linea = f"{s.codigo} ({NOMBRE_FLUJO[s.flujo]}): {ESTADO[s.estado]}"
        if s.estado == solicitudes.Estado.PROGRAMADA:
            linea += f" para el {fecha_larga(s.dia)} a las {hora_corta(s.hora)}"
        lineas.append(linea)
    return "\n".join(lineas) or "Todavía no tienes solicitudes."


def _pieza(c: contenidos.ContenidoVista) -> str:
    return f"*{c.titulo}*\n{c.texto_corto}" + (f"\n{c.url}" if c.url else "")


# ---- Avisos: plantillas fijas, después del commit de cada operación (ADR-0003) ----

def escuchar() -> None:
    suscribir_despues(solicitudes.SolicitudRecibida, _al_recibir)
    suscribir_despues(solicitudes.SolicitudProgramada, _al_programar)
    suscribir_despues(puntos.PuntosAcreditados, _al_acreditar)
    suscribir_despues(solicitudes.SolicitudRechazada, _al_rechazar)
    suscribir_despues(solicitudes.SolicitudCancelada, _al_cancelar)
    suscribir_despues(directorio.SolicitanteHabilitado, _al_habilitar)


def _avisar(solicitante_id: UUID, texto: str) -> None:
    _enviar(MensajeSaliente(telefono=directorio.solicitante(solicitante_id).telefono, texto=texto))


def _al_recibir(e: solicitudes.SolicitudRecibida) -> None:
    colectivo = "huerteros" if e.flujo == Flujo.ORGANICO else "recicladores"
    _avisar(e.solicitante_id, f"Recibimos tu solicitud {e.codigo} de {NOMBRE_FLUJO[e.flujo]}. La coordinación de "
                              f"{colectivo} te confirma día, hora y quién pasa.")


def _al_programar(e: solicitudes.SolicitudProgramada) -> None:
    encargado = directorio.encargado(e.encargado_id).nombre
    # hora_corta ya termina en «a. m.» o «p. m.»: la frase no lleva punto final propio.
    _avisar(e.solicitante_id, f"{encargado} pasa por tu recolección {e.codigo} el {fecha_larga(e.dia)} a las "
                              f"{hora_corta(e.hora)}")


def _al_acreditar(e: puntos.PuntosAcreditados) -> None:
    peso = f": {kilos(e.kg)} kg" if e.kg else ""
    _avisar(e.solicitante_id, f"Recibimos tus {NOMBRE_FLUJO[e.flujo]}{peso}. Ganaste {e.puntos} puntos "
                              f"({e.explicacion}). Llevas {e.saldo}.")


def _al_rechazar(e: solicitudes.SolicitudRechazada) -> None:
    pieza = contenidos.para_rechazo(e.flujo)
    texto = f"No pudimos recibir {e.codigo}: {e.motivo}."
    _avisar(e.solicitante_id, texto + (f"\n\n{_pieza(pieza)}" if pieza else ""))


def _al_cancelar(e: solicitudes.SolicitudCancelada) -> None:
    _avisar(e.solicitante_id, f"Cancelamos la solicitud {e.codigo}.")


def _al_habilitar(e: directorio.SolicitanteHabilitado) -> None:
    _avisar(e.solicitante_id, "¡Listo! Ya puedes pedir recolecciones. Escribe MENÚ para empezar.")
