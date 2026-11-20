"""API de whatsapp: el simulador (requiere sesión). El webhook real llega con el transporte de Jorge."""
from fastapi import APIRouter, Depends

from app.modulos.acceso import contrato as acceso
from app.modulos.whatsapp import bot
from app.modulos.whatsapp.contrato import MensajeEntrante, MensajeSaliente

router = APIRouter(prefix="/api/whatsapp", tags=["whatsapp"])
Sesion = Depends(acceso.usuario_actual)


@router.post("/simulador")
def simular(mensaje: MensajeEntrante, _: acceso.Usuario = Sesion) -> list[str]:
    """Finge ser WhatsApp: sigue el mismo camino que un mensaje real y devuelve lo que respondió el bot."""
    return bot.recibir(mensaje)


@router.get("/simulador/mensajes")
def enviados(telefono: str | None = None, _: acceso.Usuario = Sesion) -> list[MensajeSaliente]:
    """Todo lo que el sistema «envió» por WhatsApp: respuestas y avisos."""
    return bot.enviados(telefono)
