"""Contrato público de solicitudes, el núcleo. Lo único que otros módulos y la API pueden importar (ADR-0001)."""
from dataclasses import asdict
from datetime import date, datetime, time
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from app.compartido.bd import transaccion
from app.compartido.eventos import Evento, publicar
from app.compartido.formato import NOMBRE_FLUJO
from app.compartido.tipos import COLECTIVO_DEL_FLUJO, Canal, Colectivo, ErrorDeNegocio, Flujo, Franja, NoEncontrado
from app.modulos.directorio import contrato as directorio
from app.modulos.solicitudes.dominio import ABIERTOS, PREFIJO, Cambio, Estado, Solicitud
from app.modulos.solicitudes.tablas import consecutivos
from app.modulos.solicitudes.tablas import solicitudes as tabla


class NuevaSolicitud(BaseModel):
    solicitante_id: UUID
    flujo: Flujo
    preferencia: Franja
    observaciones: str = Field("", max_length=500)
    canal: Canal
    foto_url: str | None = None


class CambioVista(BaseModel):
    fecha: datetime
    estado: Estado
    por: str
    nota: str


class SolicitudVista(BaseModel):
    """Contacto y dirección solo llegan a quien atiende: la API filtra por colectivo (RN-07)."""

    id: UUID
    codigo: str
    estado: Estado
    flujo: Flujo
    colectivo: Colectivo
    canal: Canal
    solicitante_id: UUID
    solicitante_nombre: str
    telefono: str
    zona_id: UUID
    zona: str
    direccion: str
    preferencia: Franja
    observaciones: str
    foto_url: str | None
    encargado_id: UUID | None
    asignada_por: UUID | None
    dia: date | None
    hora: time | None
    kg: Decimal | None
    motivo: str
    recibida: datetime
    historial: list[CambioVista]


class EventoDeSolicitud(Evento):
    solicitud_id: UUID
    codigo: str
    solicitante_id: UUID
    flujo: Flujo


class SolicitudRecibida(EventoDeSolicitud):
    pass


class SolicitudProgramada(EventoDeSolicitud):
    encargado_id: UUID
    dia: date
    hora: time


class RecoleccionRegistrada(EventoDeSolicitud):
    """La escucha puntos: es la única fuente de puntos (RN-05)."""

    kg: Decimal | None


class SolicitudRechazada(EventoDeSolicitud):
    motivo: str


class SolicitudCancelada(EventoDeSolicitud):
    motivo: str


def registrar(nueva: NuevaSolicitud, por: str = "solicitante") -> SolicitudVista:
    """Entrada única para WhatsApp, el registro asistido y el simulador (ADR-0003)."""
    with transaccion() as c:
        solicitante = directorio.solicitante(nueva.solicitante_id)
        if solicitante.estado != directorio.EstadoSolicitante.HABILITADO:
            raise ErrorDeNegocio("El solicitante todavía no está habilitado en el piloto (RN-08).")
        abierta = c.execute(select(tabla.c.codigo).where(
            tabla.c.solicitante_id == nueva.solicitante_id, tabla.c.flujo == nueva.flujo,
            tabla.c.estado.in_(sorted(ABIERTOS)))).scalar()
        if abierta:
            raise ErrorDeNegocio(f"Ya hay una solicitud abierta de {NOMBRE_FLUJO[nueva.flujo]}: {abierta}.")
        numero = c.execute(select(consecutivos[nueva.flujo].next_value())).scalar_one()
        solicitud = Solicitud.recibir(por, codigo=f"{PREFIJO[nueva.flujo]}-{numero:04d}", zona_id=solicitante.zona_id,
                                      direccion=solicitante.direccion, **nueva.model_dump())
        _guardar(c, solicitud)
        publicar(SolicitudRecibida(**_ids(solicitud)))
        return _vista(solicitud)


def asignar(id: UUID, encargado_id: UUID, dia: date, hora: time | None, por: UUID) -> SolicitudVista:
    """Una sola acción: encargado, día y hora opcional. Solo con hora se avisa al vecino (RN-02)."""
    encargado = directorio.encargado(encargado_id)

    def accion(s: Solicitud) -> None:
        if encargado.colectivo != COLECTIVO_DEL_FLUJO[s.flujo]:
            raise ErrorDeNegocio("Ese encargado no es del colectivo de la solicitud (RN-01).")
        if not encargado.activo:
            raise ErrorDeNegocio("Ese encargado está inactivo.")
        s.asignar(encargado_id, dia, hora, por)

    def programada(s: Solicitud) -> SolicitudProgramada:
        return SolicitudProgramada(**_ids(s), encargado_id=encargado_id, dia=dia, hora=hora)

    return _operar(id, accion, programada if hora else None)


def registrar_recoleccion(id: UUID, kg: Decimal | None, por: UUID) -> SolicitudVista:
    return _operar(id, lambda s: s.registrar_recoleccion(kg, por), lambda s: RecoleccionRegistrada(**_ids(s), kg=kg))


def rechazar(id: UUID, motivo: str, por: UUID) -> SolicitudVista:
    return _operar(id, lambda s: s.rechazar(motivo, por), lambda s: SolicitudRechazada(**_ids(s), motivo=s.motivo))


def cancelar(id: UUID, motivo: str, por: str) -> SolicitudVista:
    return _operar(id, lambda s: s.cancelar(motivo, por), lambda s: SolicitudCancelada(**_ids(s), motivo=s.motivo))


def obtener(id: UUID) -> SolicitudVista:
    with transaccion() as c:
        return _vista(_cargar(c, id))


def por_codigo(codigo: str) -> SolicitudVista:
    encontradas = _consultar(select(tabla).where(tabla.c.codigo == codigo.strip().upper()))
    if not encontradas:
        raise NoEncontrado(f"No existe la solicitud {codigo}.")
    return encontradas[0]


def bandeja(colectivo: Colectivo | None = None, estados: set[Estado] | None = None) -> list[SolicitudVista]:
    """Solicitudes de un colectivo, las más nuevas primero (RN-01). Sin colectivo: todas (administrador y reportes)."""
    consulta = select(tabla).order_by(tabla.c.recibida.desc())
    if colectivo is not None:
        consulta = consulta.where(tabla.c.flujo.in_([f for f, col in COLECTIVO_DEL_FLUJO.items() if col == colectivo]))
    if estados:
        consulta = consulta.where(tabla.c.estado.in_(sorted(estados)))
    return _consultar(consulta)


def de_solicitante(solicitante_id: UUID) -> list[SolicitudVista]:
    return _consultar(select(tabla).where(tabla.c.solicitante_id == solicitante_id).order_by(tabla.c.recibida.desc()))


def _operar(id: UUID, accion, evento=None) -> SolicitudVista:
    """Carga, aplica la regla del dominio, guarda y publica, todo en una transacción."""
    with transaccion() as c:
        solicitud = _cargar(c, id)
        accion(solicitud)
        _guardar(c, solicitud)
        if evento:
            publicar(evento(solicitud))
        return _vista(solicitud)


def _consultar(consulta) -> list[SolicitudVista]:
    with transaccion() as c:
        return [_vista(_de_fila(fila)) for fila in c.execute(consulta).all()]


def _cargar(c, id: UUID) -> Solicitud:
    fila = c.execute(select(tabla).where(tabla.c.id == id)).first()
    if fila is None:
        raise NoEncontrado(f"No existe la solicitud {id}.")
    return _de_fila(fila)


def _guardar(c, s: Solicitud) -> None:
    fila = asdict(s)
    fila["historial"] = [{"fecha": x.fecha.isoformat(), "estado": x.estado.value, "por": x.por, "nota": x.nota}
                         for x in s.historial]
    fila["recibida"] = s.historial[0].fecha
    c.execute(insert(tabla).values(fila).on_conflict_do_update(index_elements=[tabla.c.id], set_=fila))


def _de_fila(fila) -> Solicitud:
    datos = dict(fila._mapping)
    datos.pop("recibida")
    historial = [Cambio(datetime.fromisoformat(x["fecha"]), Estado(x["estado"]), x["por"], x["nota"])
                 for x in datos.pop("historial")]
    datos.update(flujo=Flujo(datos["flujo"]), preferencia=Franja(datos["preferencia"]), canal=Canal(datos["canal"]),
                 estado=Estado(datos["estado"]))
    return Solicitud(**datos, historial=historial)


def _ids(s: Solicitud) -> dict:
    return {"solicitud_id": s.id, "codigo": s.codigo, "solicitante_id": s.solicitante_id, "flujo": s.flujo}


def _vista(s: Solicitud) -> SolicitudVista:
    solicitante = directorio.solicitante(s.solicitante_id)
    return SolicitudVista(**asdict(s), colectivo=COLECTIVO_DEL_FLUJO[s.flujo], solicitante_nombre=solicitante.nombre,
                          telefono=solicitante.telefono, recibida=s.historial[0].fecha,
                          zona=directorio.zona(s.zona_id).nombre)
