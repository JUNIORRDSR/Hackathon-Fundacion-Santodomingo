"""Avisos al solicitante: plantillas fijas que salen por WhatsApp después del commit de cada evento (ADR-0003)."""
from uuid import UUID

from app.compartido.eventos import suscribir_despues
from app.compartido.formato import NOMBRE_FLUJO, fecha_larga, hora_corta, kilos
from app.compartido.tipos import Flujo
from app.modulos.contenidos import contrato as contenidos
from app.modulos.directorio import contrato as directorio
from app.modulos.puntos import contrato as puntos
from app.modulos.solicitudes import contrato as solicitudes
from app.modulos.whatsapp.bot import enviar
from app.modulos.whatsapp.contrato import MensajeSaliente
from app.modulos.whatsapp.menu import texto_de_pieza


def escuchar() -> None:
    suscribir_despues(solicitudes.SolicitudRecibida, _al_recibir)
    suscribir_despues(solicitudes.SolicitudProgramada, _al_programar)
    suscribir_despues(puntos.PuntosAcreditados, _al_acreditar)
    suscribir_despues(puntos.CanjeEntregado, _al_entregar_canje)
    suscribir_despues(solicitudes.SolicitudRechazada, _al_rechazar)
    suscribir_despues(solicitudes.SolicitudCancelada, _al_cancelar)
    suscribir_despues(directorio.SolicitanteHabilitado, _al_habilitar)


def _avisar(solicitante_id: UUID, texto: str) -> None:
    enviar(MensajeSaliente(telefono=directorio.solicitante(solicitante_id).telefono, texto=texto))


def _al_recibir(e: solicitudes.SolicitudRecibida) -> None:
    colectivo = "huerteros" if e.flujo == Flujo.ORGANICO else "recicladores"
    _avisar(e.solicitante_id, f"Recibimos tu solicitud {e.codigo} de {NOMBRE_FLUJO[e.flujo]}. Escribe {e.codigo} en tu "
                              f"bolsa con marcador. La coordinación de {colectivo} te confirma día, hora y quién pasa.")


def _al_programar(e: solicitudes.SolicitudProgramada) -> None:
    encargado = directorio.encargado(e.encargado_id).nombre
    # hora_corta ya termina en «a. m.» o «p. m.»: la frase no lleva punto final propio.
    _avisar(e.solicitante_id, f"{encargado} pasa por tu recolección {e.codigo} el {fecha_larga(e.dia)} a las "
                              f"{hora_corta(e.hora)}")


def _al_acreditar(e: puntos.PuntosAcreditados) -> None:
    peso = f": {kilos(e.kg)} kg" if e.kg else ""
    disponible = puntos.disponible(e.solicitante_id)
    _avisar(e.solicitante_id, f"¡Gracias por separar! Recibimos tus {NOMBRE_FLUJO[e.flujo]} de {e.codigo}{peso}. "
                              f"Ganaste {e.puntos} puntos ({e.explicacion}). Ahora tienes {disponible} puntos.\n\n"
                              + _lo_que_alcanza(disponible))


def _lo_que_alcanza(disponible: int) -> str:
    """Dice qué premio ya puede pedir o cuánto le falta para el más barato (ADR-0008)."""
    premios = puntos.premios(solo_activos=True)
    alcanza = [p for p in premios if p.costo <= disponible]
    if alcanza:
        return f"Ya te alcanza para {alcanza[-1].nombre}. Escribe 4 para pedir tu premio."
    if premios:
        faltan = premios[0].costo - disponible
        return f"Te faltan {faltan} puntos para {premios[0].nombre}. Escribe 4 para ver los premios."
    return "Escribe 4 para ver tus puntos."



def _al_entregar_canje(e: puntos.CanjeEntregado) -> None:
    _avisar(e.solicitante_id, f"Entregamos tu canje {e.codigo}: {e.premio}. Te quedan {e.saldo} puntos. ¡Gracias por "
                              "separar!")


def _al_rechazar(e: solicitudes.SolicitudRechazada) -> None:
    pieza = contenidos.para_rechazo(e.flujo)
    texto = f"No pudimos recibir {e.codigo}: {e.motivo}."
    _avisar(e.solicitante_id, texto + (f"\n\n{texto_de_pieza(pieza)}" if pieza else ""))


def _al_cancelar(e: solicitudes.SolicitudCancelada) -> None:
    _avisar(e.solicitante_id, f"Cancelamos la solicitud {e.codigo}.")


def _al_habilitar(e: directorio.SolicitanteHabilitado) -> None:
    _avisar(e.solicitante_id, "¡Listo! Ya puedes pedir recolecciones. Escribe MENÚ para empezar.")
