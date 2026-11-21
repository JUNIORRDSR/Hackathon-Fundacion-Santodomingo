"""API de puntos: regla vigente, saldo de un solicitante, catálogo de premios y canjes (ADR-0008)."""
from uuid import UUID

from fastapi import APIRouter, Depends

from app.modulos.acceso import contrato as acceso
from app.modulos.puntos import contrato as puntos

router = APIRouter(prefix="/api/puntos", tags=["puntos"])
Sesion = Depends(acceso.usuario_actual)


@router.get("/regla")
def regla(_: acceso.Usuario = Sesion) -> puntos.ReglaVista:
    return puntos.regla_vigente()


@router.put("/regla")
def cambiar_regla(datos: puntos.NuevaRegla, u: acceso.Usuario = Sesion) -> puntos.ReglaVista:
    acceso.exigir_administrador(u)
    return puntos.cambiar_regla(datos)


@router.get("/saldos")
def saldos(_: acceso.Usuario = Sesion) -> dict[UUID, int]:
    """Puntos de cada vecino, para la tabla de Vecinos y negocios."""
    return puntos.saldos()


@router.get("/solicitantes/{solicitante_id}")
def saldo(solicitante_id: UUID, _: acceso.Usuario = Sesion) -> puntos.Saldo:
    return puntos.saldo(solicitante_id)


@router.get("/por-codigo")
def por_codigo(_: acceso.Usuario = Sesion) -> dict[str, int]:
    return puntos.puntos_por_codigo()


@router.get("/premios")
def premios(_: acceso.Usuario = Sesion) -> list[puntos.PremioVista]:
    return puntos.premios()


@router.post("/premios", status_code=201)
def crear_premio(datos: puntos.NuevoPremio, _: acceso.Usuario = Sesion) -> puntos.PremioVista:
    """La coordinación y la administración editan el catálogo: la huerta es quien entrega (ADR-0008)."""
    return puntos.guardar_premio(datos)


@router.put("/premios/{id}")
def editar_premio(id: UUID, datos: puntos.NuevoPremio, _: acceso.Usuario = Sesion) -> puntos.PremioVista:
    return puntos.guardar_premio(datos, id)


@router.get("/canjes")
def canjes(estado: puntos.EstadoCanje | None = None, _: acceso.Usuario = Sesion) -> list[puntos.CanjeVista]:
    return puntos.canjes(estado)


@router.post("/canjes/{codigo}/entrega")
def entregar(codigo: str, u: acceso.Usuario = Sesion) -> puntos.CanjeVista:
    return puntos.entregar(codigo, por=u.usuario)


@router.post("/canjes/{codigo}/cancelacion")
def cancelar(codigo: str, u: acceso.Usuario = Sesion) -> puntos.CanjeVista:
    return puntos.cancelar_canje(codigo, por=u.usuario)
