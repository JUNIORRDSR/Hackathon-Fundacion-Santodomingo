import { moverMes, periodo } from '../meses'

export interface Resumen {
  total_kg: string
  total_solicitudes: number
  recolecciones: number
  vecinos: number
  puntos: number
  filas: { estado: string; cantidad: number }[]
  por_dia: { dia: string; kg: string }[]
}
export interface Grupo {
  nombre: string
  solicitudes: number
  recolecciones: number
  kg: string
}
export type Estado = 'recolectada' | 'curso' | 'rechazada' | 'cancelada'

// Paleta validada (scripts/validate_palette.js del skill dataviz): pasa CVD; el ámbar lleva etiqueta y tabla.
export const ESTADOS: { clave: Estado; nombre: string; color: string; tinta: string }[] = [
  { clave: 'recolectada', nombre: 'Recolectadas', color: '#14802a', tinta: '#ffffff' },
  { clave: 'curso', nombre: 'En curso', color: '#c99400', tinta: '#202522' },
  { clave: 'rechazada', nombre: 'Rechazadas', color: '#b4462f', tinta: '#ffffff' },
  { clave: 'cancelada', nombre: 'Canceladas', color: '#3f6fb5', tinta: '#ffffff' },
]
export interface Datos {
  actual: Resumen
  previo: Resumen
  semanas: Resumen
  zonas: Grupo[]
  desdeSemanas: string
}
export const hoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
export const kilos = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 })
export const entero = new Intl.NumberFormat('es-CO')
export const porcentaje = new Intl.NumberFormat('es-CO', { style: 'percent', maximumFractionDigits: 0 })
export const diaMes = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' })
export const mesCorto = new Intl.DateTimeFormat('es-CO', { month: 'short', timeZone: 'UTC' })
export const fecha = (dia: string) => diaMes.format(new Date(dia + 'T00:00:00Z'))

export const SEMANAS = 12
const DIA_MS = 86_400_000

export const sumarDias = (fecha: string, dias: number) =>
  new Date(Date.parse(fecha + 'T00:00:00Z') + dias * DIA_MS).toISOString().slice(0, 10)

// El mes elegido contra el anterior. Si el mes va corriendo se compara con los mismos días del anterior, para que
// el 21 de noviembre no parezca una caída frente a todo octubre. La tendencia son las 12 semanas que acaban ahí.
export function periodos(mes: string, hoy: string) {
  const actual = periodo(mes)
  const hasta = hoy < actual.hasta ? hoy : actual.hasta
  const previo = periodo(moverMes(mes, -1))
  const corte =
    hasta === actual.hasta ? previo.hasta : sumarDias(previo.desde, Math.min(Number(hasta.slice(8)), previo.dias) - 1)
  const lunes = sumarDias(hasta, -((new Date(hasta + 'T00:00:00Z').getUTCDay() + 6) % 7))
  return {
    actual: { desde: actual.desde, hasta },
    previo: { desde: previo.desde, hasta: corte },
    semanas: { desde: sumarDias(lunes, -7 * (SEMANAS - 1)), hasta },
  }
}

export function porSemana(porDia: Resumen['por_dia'], desde: string) {
  const semanas = Array.from({ length: SEMANAS }, (_, i) => ({ inicio: sumarDias(desde, 7 * i), kg: 0 }))
  for (const { dia, kg } of porDia) {
    const i = Math.floor((Date.parse(dia) - Date.parse(desde)) / (7 * DIA_MS))
    if (i >= 0 && i < SEMANAS) semanas[i].kg += Number(kg)
  }
  return semanas
}

// Recibida, asignada y programada son «en curso»: todavía pueden terminar en kilos.
export function contarEstados(filas: Resumen['filas']): Record<Estado, number> {
  const cuenta: Record<Estado, number> = { recolectada: 0, curso: 0, rechazada: 0, cancelada: 0 }
  for (const { estado, cantidad } of filas) {
    const clave = (estado in cuenta ? estado : 'curso') as Estado
    cuenta[clave] += cantidad
  }
  return cuenta
}

// De lo que se intentó recoger, cuánto pasó la revisión: la medida de qué tan bien separa el barrio.
export function aceptacion(cuenta: Record<Estado, number>) {
  const revisadas = cuenta.recolectada + cuenta.rechazada
  return revisadas ? cuenta.recolectada / revisadas : undefined
}

if (import.meta.env.DEV) {
  // Autocomprobación en desarrollo: el 21 de noviembre se compara con el 1–21 de octubre y la semana cae en lunes.
  const p = periodos('2026-11', '2026-11-21')
  console.assert(p.previo.hasta === '2026-10-21' && p.semanas.desde === '2026-08-31', 'periodos', p)
  const s = porSemana(
    [
      { dia: '2026-08-31', kg: '2' },
      { dia: '2026-11-21', kg: '3' },
    ],
    p.semanas.desde,
  )
  console.assert(s[0].kg === 2 && s[SEMANAS - 1].kg === 3, 'porSemana', s)
}
