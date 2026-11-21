// Meses en hora de Colombia para el Inicio y los Informes: el actual, su nombre, su periodo y moverse entre meses.
export const mesActual = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date()).slice(0, 7)
export const nombreMes = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' })

export function periodo(mes: string) {
  const [anio, numero] = mes.split('-').map(Number)
  const dias = new Date(Date.UTC(anio, numero, 0)).getUTCDate()
  return { desde: mes + '-01', hasta: mes + '-' + String(dias).padStart(2, '0'), dias }
}

export function moverMes(mes: string, cuantos: number) {
  const [anio, numero] = mes.split('-').map(Number)
  return new Date(Date.UTC(anio, numero - 1 + cuantos, 1)).toISOString().slice(0, 7)
}
