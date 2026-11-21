"""Presentación del reporte de solicitudes para Excel."""
from collections.abc import Iterable
from datetime import date
from decimal import Decimal
from io import BytesIO

from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.worksheet import Worksheet

VALOR = str | date | Decimal | None
COLUMNAS = (
    ("Código", 16, "General"), ("Flujo", 17, "General"), ("Estado", 18, "General"),
    ("Zona", 27, "General"), ("Conjunto", 30, "General"), ("Canal", 16, "General"),
    ("Recibida", 16, "dd/mm/yyyy"), ("Día", 16, "dd/mm/yyyy"), ("Kg", 12, "0.00"),
)
TITULO = Font(bold=True, color="FFFFFFFF")
VERDE = PatternFill("solid", fgColor="FF063B2E")
VERDE_CLARO = PatternFill("solid", fgColor="FFEAF0EA")


def libro_solicitudes(filas: Iterable[tuple[VALOR, ...]]) -> bytes:
    libro = Workbook()
    hoja = libro.active
    hoja.title = "Solicitudes"
    hoja.append([nombre for nombre, _, _ in COLUMNAS])
    _formatear_encabezados(hoja)
    for numero, fila in enumerate(filas, 2):
        _escribir_fila(hoja, numero, fila)
    hoja.freeze_panes = "A2"
    hoja.auto_filter.ref = hoja.dimensions
    hoja.sheet_view.showGridLines = False
    salida = BytesIO()
    libro.save(salida)
    libro.close()
    return salida.getvalue()


def _formatear_encabezados(hoja: Worksheet) -> None:
    hoja.row_dimensions[1].height = 23
    for columna, (_, ancho, _) in enumerate(COLUMNAS, 1):
        hoja.column_dimensions[get_column_letter(columna)].width = ancho
        celda = hoja.cell(1, columna)
        celda.font = TITULO
        celda.fill = VERDE


def _escribir_fila(hoja: Worksheet, numero: int, fila: tuple[VALOR, ...]) -> None:
    for columna, (valor, (_, _, formato)) in enumerate(zip(fila, COLUMNAS, strict=True), 1):
        celda = hoja.cell(numero, columna, valor)
        if isinstance(valor, str):
            celda.data_type = "s"
        celda.number_format = formato
        if numero % 2 == 0:
            celda.fill = VERDE_CLARO
