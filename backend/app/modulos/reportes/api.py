"""API de reportes: resumen y CSV. El coordinador ve su colectivo; el administrador, todos."""
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends
from fastapi.responses import Response

from app.compartido.formato import HORA_COLOMBIA
from app.compartido.tipos import Colectivo
from app.modulos.acceso import contrato as acceso
from app.modulos.reportes import contrato as reportes

router = APIRouter(prefix="/api/reportes", tags=["reportes"])
Sesion = Depends(acceso.usuario_actual)


def _periodo(desde: date | None, hasta: date | None) -> tuple[date, date]:
    """Sin fechas: los últimos 30 días, en hora de Colombia."""
    hasta = hasta or datetime.now(HORA_COLOMBIA).date()
    return desde or hasta - timedelta(days=30), hasta


@router.get("/resumen")
def resumen(desde: date | None = None, hasta: date | None = None, colectivo: Colectivo | None = None,
            u: acceso.Usuario = Sesion) -> reportes.Resumen:
    return reportes.resumen(*_periodo(desde, hasta), acceso.colectivo_visible(u, colectivo))


@router.get("/desglose")
def desglose(por: reportes.Agrupacion = reportes.Agrupacion.CONJUNTO, desde: date | None = None,
             hasta: date | None = None, colectivo: Colectivo | None = None,
             u: acceso.Usuario = Sesion) -> list[reportes.FilaDesglose]:
    return reportes.desglose(*_periodo(desde, hasta), acceso.colectivo_visible(u, colectivo), por)


@router.get("/solicitudes.csv", response_class=Response)
def csv_de_solicitudes(desde: date | None = None, hasta: date | None = None, colectivo: Colectivo | None = None,
                       u: acceso.Usuario = Sesion) -> Response:
    contenido = reportes.csv_de_solicitudes(*_periodo(desde, hasta), acceso.colectivo_visible(u, colectivo))
    return Response(contenido, media_type="text/csv; charset=utf-8",
                    headers={"Content-Disposition": 'attachment; filename="solicitudes.csv"'})
