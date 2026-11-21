type Column = { header: string; width: number; format?: string }
type Cell = string | number | null

export async function descargarExcel(nombre: string, hoja: string, columnas: Column[], filas: Cell[][]) {
  const { Workbook } = await import('exceljs')
  const libro = new Workbook()
  const pagina = libro.addWorksheet(hoja, { views: [{ state: 'frozen', ySplit: 1, showGridLines: false }] })
  pagina.columns = columnas.map(({ header, width, format }) => ({ header, width, style: { numFmt: format } }))
  pagina.addRows(filas)
  pagina.autoFilter = { from: { row: 1, column: 1 }, to: { row: pagina.rowCount, column: columnas.length } }

  const encabezado = pagina.getRow(1)
  encabezado.height = 23
  encabezado.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  encabezado.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF063B2E' } }
  for (let numero = 2; numero <= pagina.rowCount; numero += 2) {
    pagina.getRow(numero).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAF0EA' } }
  }

  const bytes = new Uint8Array(await libro.xlsx.writeBuffer()).buffer
  const archivo = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(archivo)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = nombre + '.xlsx'
  enlace.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
