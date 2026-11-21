import { Icon } from '../../../ecoconecta-coordinacion/components/ui/Icon'
import { aceptacion, contarEstados, entero, kilos, mesCorto, porSemana, porcentaje, sumarDias } from './datos'
import type { Datos } from './datos'

export function Indicadores({ datos, mes }: { datos: Datos; mes: string }) {
  const { actual, previo } = datos
  const anterior = mesCorto.format(new Date(sumarDias(mes + '-01', -1) + 'T00:00:00Z')).replace('.', '')
  const tasa = aceptacion(contarEstados(actual.filas))
  const tasaPrevia = aceptacion(contarEstados(previo.filas))
  const cifras = [
    {
      nombre: 'Kilos validados',
      valor: kilos.format(Number(actual.total_kg)),
      unidad: 'kg',
      ahora: Number(actual.total_kg),
      antes: Number(previo.total_kg),
    },
    {
      nombre: 'Recolecciones',
      valor: entero.format(actual.recolecciones),
      ahora: actual.recolecciones,
      antes: previo.recolecciones,
    },
    {
      nombre: 'Vecinos que participaron',
      valor: entero.format(actual.vecinos),
      ahora: actual.vecinos,
      antes: previo.vecinos,
    },
  ]
  return (
    <dl className="indicadores">
      {cifras.map((c) => (
        <div key={c.nombre} className="card indicador">
          <dt>{c.nombre}</dt>
          <dd>
            <strong>{c.valor}</strong>
            {c.unidad && <span> {c.unidad}</span>}
          </dd>
          <Variacion ahora={c.ahora} antes={c.antes} anterior={anterior} />
        </div>
      ))}
      <div className="card indicador">
        <dt>Pasan la revisión</dt>
        <dd>
          <strong>{tasa === undefined ? '—' : porcentaje.format(tasa)}</strong>
        </dd>
        {tasa !== undefined && tasaPrevia !== undefined && (
          <Variacion ahora={tasa * 100} antes={tasaPrevia * 100} anterior={anterior} puntos />
        )}
      </div>
    </dl>
  )
}

// Signo y flecha, además del color: subir es bueno en todas estas cifras.
function Variacion({
  ahora,
  antes,
  anterior,
  puntos = false,
}: {
  ahora: number
  antes: number
  anterior: string
  puntos?: boolean
}) {
  if (!antes && !puntos) return <p className="variacion">Sin datos de {anterior} para comparar</p>
  const cambio = puntos ? ahora - antes : ((ahora - antes) / antes) * 100
  const redondo = Math.round(cambio)
  const tono = redondo > 0 ? 'sube' : redondo < 0 ? 'baja' : 'igual'
  return (
    <p className="variacion" data-tono={tono}>
      <span aria-hidden="true">{tono === 'sube' ? '▲' : tono === 'baja' ? '▼' : '■'}</span>
      {redondo > 0 ? '+' : ''}
      {redondo}
      {puntos ? ' pts' : ' %'} vs. {anterior}
    </p>
  )
}

// Tres frases a lo sumo, calculadas de los mismos datos: lo que conviene mirar antes de decidir.
export function Lectura({ datos }: { datos: Datos }) {
  const frases: string[] = []
  const total = datos.zonas.reduce((suma, z) => suma + Number(z.kg), 0)
  const primera = datos.zonas[0]
  if (total && primera) {
    frases.push(`${primera.nombre} aporta el ${porcentaje.format(Number(primera.kg) / total)} de los kilos del mes.`)
  }
  const semanas = porSemana(datos.semanas.por_dia, datos.desdeSemanas).map((s) => s.kg)
  const ultimas = semanas.slice(-5, -1).reduce((a, b) => a + b, 0)
  const previas = semanas.slice(-9, -5).reduce((a, b) => a + b, 0)
  if (ultimas && previas) {
    const cambio = Math.round(((ultimas - previas) / previas) * 100)
    const signo = cambio >= 0 ? '+' : ''
    frases.push(
      `Las 4 últimas semanas cerradas suman ${kilos.format(ultimas)} kg: ${signo}${cambio} % frente a las 4 previas.`,
    )
  }
  const cuenta = contarEstados(datos.actual.filas)
  const revisadas = cuenta.recolectada + cuenta.rechazada
  if (revisadas) {
    const rechazo = cuenta.rechazada / revisadas
    frases.push(
      rechazo >= 0.08
        ? `El ${porcentaje.format(rechazo)} de lo revisado se rechazó: conviene reforzar la capacitación en separación.`
        : `Solo el ${porcentaje.format(rechazo)} de lo revisado se rechazó: el barrio está separando bien.`,
    )
  }
  if (!frases.length) return null
  return (
    <div className="lectura">
      <h3>
        <Icon name="info" /> Lectura rápida
      </h3>
      <ul>
        {frases.map((frase) => (
          <li key={frase}>{frase}</li>
        ))}
      </ul>
    </div>
  )
}
