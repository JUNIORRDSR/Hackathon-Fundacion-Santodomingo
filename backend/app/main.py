"""Host del monolito modular: monta los módulos, conecta los eventos y sirve la SPA (ADR-0001)."""
import logging
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from app import semillas
from app.compartido import bd
from app.compartido.configuracion import variable
from app.compartido.tipos import ErrorDeNegocio, NoEncontrado
from app.modulos.acceso import api as acceso_api
from app.modulos.clasificacion import api as clasificacion_api
from app.modulos.contenidos import api as contenidos_api
from app.modulos.directorio import api as directorio_api
from app.modulos.etiquetas import api as etiquetas_api
from app.modulos.puntos import api as puntos_api
from app.modulos.puntos import contrato as puntos
from app.modulos.reportes import api as reportes_api
from app.modulos.solicitudes import api as solicitudes_api
from app.modulos.whatsapp import api as whatsapp_api
from app.modulos.whatsapp import avisos, bot
from app.modulos.whatsapp.eventos_monitor import ciclo_eventos

logging.basicConfig(level=logging.INFO)
SPA = Path(__file__).resolve().parents[2] / "frontend" / "dist"
ROUTERS = (acceso_api, solicitudes_api, directorio_api, puntos_api, contenidos_api, reportes_api, whatsapp_api,
           clasificacion_api, etiquetas_api)


def crear_app() -> FastAPI:
    app = FastAPI(title="EcoConecta", version="0.1.0", lifespan=ciclo_eventos,
                  description="Cada etiqueta es un módulo y su contrato (docs/arquitectura.md).")
    app.add_middleware(SessionMiddleware, secret_key=variable("CLAVE_SESION", "solo-para-desarrollo-local"),
                       max_age=30 * 24 * 3600, same_site="lax", https_only=os.getenv("ENTORNO") == "produccion")
    for modulo in ROUTERS:
        app.include_router(modulo.router)
    app.add_exception_handler(ErrorDeNegocio, lambda _, error: JSONResponse({"detail": str(error)}, status_code=409))
    app.add_exception_handler(NoEncontrado, lambda _, error: JSONResponse({"detail": str(error)}, status_code=404))
    _conectar_modulos()
    _servir_spa(app)
    return app


def _conectar_modulos() -> None:
    puntos.escuchar()
    avisos.escuchar()
    bot.configurar_desde_entorno()
    if bd.reiniciar_si_se_pidio():
        logging.getLogger("ecoconecta").warning("Base reiniciada: los esquemas se crean de nuevo")
    bd.crear_tablas()
    if os.getenv("SEMBRAR_DEMO", "1") == "1":
        semillas.sembrar()


def _servir_spa(app: FastAPI) -> None:
    """La SPA compilada (frontend/dist) en la misma URL; sin ella, la raíz lleva a /docs."""
    if not (SPA / "index.html").exists():
        app.get("/", include_in_schema=False)(lambda: RedirectResponse("/docs"))
        return
    app.mount("/assets", StaticFiles(directory=SPA / "assets"), name="assets")

    @app.get("/{ruta:path}", include_in_schema=False)
    def spa(ruta: str) -> FileResponse:
        """index.html se revalida siempre (no-cache): tras publicar, nadie corre la versión vieja contra la API nueva.
        Los de /assets llevan hash en el nombre y pueden quedarse en caché."""
        if ruta.startswith("api/"):
            raise HTTPException(404)
        archivo = (SPA / ruta).resolve()
        dentro = archivo.is_file() and archivo.is_relative_to(SPA.resolve())
        return FileResponse(archivo if dentro else SPA / "index.html", headers={"Cache-Control": "no-cache"})


app = crear_app()
