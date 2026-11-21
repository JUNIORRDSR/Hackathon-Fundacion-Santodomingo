"""Los carteles ilustrados de EcoConecta que el agente adjunta por WhatsApp (ADR-0016). Twilio los descarga de la URL
pública de la app, la misma del webhook; en el simulador basta la ruta relativa."""
import os
from pathlib import Path
from urllib.parse import urlsplit

CARPETA = Path(__file__).parent / "carteles"
RUTA = "/api/whatsapp/carteles/"
# tema: (archivo, lo que muestra). El agente elige el tema por lo que muestra.
TEMAS = {
    "tipos_de_residuos": ("tipos-de-residuos.jpg", "Guía rápida: qué es orgánico y qué es aprovechable"),
    "organicos": ("organicos-si-y-no.jpg", "Orgánicos: qué sí y qué no se entrega"),
    "aprovechables": ("aprovechables-si-y-no.jpg", "Aprovechables (reciclables): qué sí y qué no se entrega"),
    "tips_reciclaje": ("tips-para-reciclar.jpg", "Seis tips para reciclar bien: limpios, secos, aplastados"),
    "como_pedir": ("como-solicitar.jpg", "Paso a paso para pedir la recolección por WhatsApp"),
    "por_que_separar": ("por-que-separar.jpg", "Por qué separar: beneficios para el hogar y el barrio"),
}
_ARCHIVOS = {archivo for archivo, _ in TEMAS.values()}


def url(tema: str) -> str:
    """Absoluta con el origen del webhook de Twilio, que es público y HTTPS; relativa en el simulador."""
    publica = urlsplit(os.getenv("TWILIO_WEBHOOK_URL", "").strip())
    origen = f"https://{publica.netloc}" if publica.scheme == "https" and publica.netloc else ""
    return f"{origen}{RUTA}{TEMAS[tema][0]}"


def archivo(nombre: str) -> Path | None:
    """Solo los archivos del catálogo: el nombre llega de la URL y no puede salirse de la carpeta."""
    return CARPETA / nombre if nombre in _ARCHIVOS else None
