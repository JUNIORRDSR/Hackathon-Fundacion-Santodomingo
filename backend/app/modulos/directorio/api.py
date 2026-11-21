"""API de directorio: zonas y conjuntos, encargados y solicitantes (alta asistida y habilitación, RN-08)."""
from uuid import UUID

from fastapi import APIRouter, Depends
from app.compartido.tipos import Colectivo
from app.modulos.acceso import contrato as acceso
from app.modulos.directorio import contrato as directorio
from app.modulos.solicitudes import contrato as solicitudes

router = APIRouter(prefix="/api/directorio", tags=["directorio"])
Sesion = Depends(acceso.usuario_actual)


@router.get("/zonas")
def zonas(_: acceso.Usuario = Sesion) -> list[directorio.ZonaVista]:
    """Las zonas con sus conjuntos. Coordinación y administrador los mantienen (ADR-0017)."""
    return directorio.zonas()


@router.post("/zonas", status_code=201)
def crear_zona(datos: directorio.NuevoLugar, _: acceso.Usuario = Sesion) -> directorio.ZonaVista:
    return directorio.crear_zona(datos.nombre)


@router.patch("/zonas/{id}")
def cambiar_zona(id: UUID, datos: directorio.CambioLugar, _: acceso.Usuario = Sesion) -> directorio.ZonaVista:
    return directorio.cambiar_zona(id, datos)


@router.post("/zonas/{id}/conjuntos", status_code=201)
def crear_conjunto(id: UUID, datos: directorio.NuevoLugar, _: acceso.Usuario = Sesion) -> directorio.ConjuntoVista:
    return directorio.crear_conjunto(id, datos.nombre)


@router.patch("/conjuntos/{id}")
def cambiar_conjunto(id: UUID, datos: directorio.CambioLugar,
                     _: acceso.Usuario = Sesion) -> directorio.ConjuntoVista:
    return directorio.cambiar_conjunto(id, datos)


@router.delete("/conjuntos/{id}", status_code=204)
def eliminar_conjunto(id: UUID, _: acceso.Usuario = Sesion) -> None:
    directorio.eliminar_conjunto(id, solicitudes.hay_solicitudes_del_conjunto)


@router.get("/encargados")
def encargados(colectivo: Colectivo | None = None, u: acceso.Usuario = Sesion) -> list[directorio.EncargadoVista]:
    return directorio.encargados(acceso.colectivo_visible(u, colectivo))


@router.post("/encargados", status_code=201)
def registrar_encargado(datos: directorio.NuevoEncargado, u: acceso.Usuario = Sesion) -> directorio.EncargadoVista:
    acceso.exigir_colectivo(u, datos.colectivo)
    return directorio.registrar_encargado(datos)


@router.patch("/encargados/{id}")
def actualizar_encargado(id: UUID, datos: directorio.CambioEncargado,
                         u: acceso.Usuario = Sesion) -> directorio.EncargadoVista:
    acceso.exigir_colectivo(u, directorio.encargado(id).colectivo)
    return directorio.actualizar_encargado(id, datos)


@router.get("/rutas/publicas")
def rutas_publicas() -> list[directorio.RutaPublica]:
    return directorio.rutas_publicas()


@router.get("/rutas")
def rutas(colectivo: Colectivo | None = None, u: acceso.Usuario = Sesion) -> list[directorio.RutaVista]:
    return directorio.rutas(acceso.colectivo_visible(u, colectivo))


@router.post("/rutas", status_code=201)
def crear_ruta(datos: directorio.DatosRuta, u: acceso.Usuario = Sesion) -> directorio.RutaVista:
    acceso.exigir_colectivo(u, datos.colectivo)
    return directorio.crear_ruta(datos)


@router.put("/rutas/{id}")
def actualizar_ruta(id: UUID, datos: directorio.DatosRuta, u: acceso.Usuario = Sesion) -> directorio.RutaVista:
    acceso.exigir_colectivo(u, directorio.ruta(id).colectivo)
    acceso.exigir_colectivo(u, datos.colectivo)
    return directorio.actualizar_ruta(id, datos)


@router.get("/solicitantes")
def solicitantes(estado: directorio.EstadoSolicitante | None = None,
                 _: acceso.Usuario = Sesion) -> list[directorio.SolicitanteVista]:
    return directorio.solicitantes(estado)


@router.post("/solicitantes", status_code=201)
def registrar_solicitante(datos: directorio.NuevoSolicitante,
                          u: acceso.Usuario = Sesion) -> directorio.SolicitanteVista:
    """Registro asistido desde la tableta: entra habilitado y la autorización queda firmada por quien registra."""
    return directorio.registrar_solicitante(datos, habilitado=True, registrado_por=u.nombre)


@router.get("/solicitantes/{id}")
def solicitante(id: UUID, _: acceso.Usuario = Sesion) -> directorio.SolicitanteVista:
    return directorio.solicitante(id)


@router.post("/solicitantes/{id}/habilitacion")
def habilitar(id: UUID, _: acceso.Usuario = Sesion) -> directorio.SolicitanteVista:
    return directorio.habilitar(id)
