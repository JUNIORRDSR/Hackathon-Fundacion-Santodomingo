import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { api } from '../../api'
import { escala } from '../Impacto'
import { ESTADOS, SEMANAS, contarEstados, entero, fecha, hoy, kilos, periodos, porSemana, porcentaje } from './datos'
import type { Datos, Estado, Grupo, Resumen } from './datos'
import { Indicadores, Lectura } from './Indicadores'
import './informes.css'

// Métricas para decidir, todas del mismo mes: cifras con su variación, la tendencia, dónde se recoge y con qué calidad.
export function Tablero({ mes, colectivo }: { mes: string; colectivo: 'huerteros' | 'recicladores' }) {
  const [datos, setDatos] = useState<Datos>()
  const [error, setError] = useState(false)
  const [cargando, setCargando] = useState(true)
  useEffect(() => {
    const control = new AbortController()
    const p = periodos(mes, hoy())
    const resumen = ({ desde, hasta }: { desde: string; hasta: string }) =>
      api<Resumen>(
        `/reportes/resumen?desde=${desde}&hasta=${hasta}&colectivo=${colectivo}`,
        'GET',
        undefined,
        control.signal,
      )
    const consulta = `por=zona&desde=${p.actual.desde}&hasta=${p.actual.hasta}&colectivo=${colectivo}`
    setCargando(true)
    Promise.all([
      resumen(p.actual),
      resumen(p.previo),
      resumen(p.semanas),
      api<Grupo[]>('/reportes/desglose?' + consulta, 'GET', undefined, control.signal),
    ])
      .then(([actual, previo, semanas, zonas]) => {
        setDatos({ actual, previo, semanas, zonas, desdeSemanas: p.semanas.desde })
        setError(false)
      })
      .catch(() => !control.signal.aborted && setError(true))
      .finally(() => !control.signal.aborted && setCargando(false))
    return () => control.abort()
  }, [mes, colectivo])

  if (error && !datos)
    return <p className="muted tablero-estado">No se pudieron cargar las métricas. Revisa la conexión.</p>
  if (!datos) return <p className="muted tablero-estado">Cargando las métricas del mes…</p>
  // Mientras recarga, el tablero conserva lo anterior atenuado: sin saltos ni parpadeos.
  return (
    <div className="tablero" aria-busy={cargando} data-cargando={cargando}>
      <Indicadores datos={datos} mes={mes} />
      <section className="card tablero-panel tablero-tendencia" aria-labelledby="tendencia-titulo">
        <div className="tablero-cabeza">
          <h2 id="tendencia-titulo">Kilos validados por semana</h2>
          <p>Las últimas {SEMANAS} semanas hasta el mes elegido</p>
        </div>
        <Tendencia semanas={porSemana(datos.semanas.por_dia, datos.desdeSemanas)} />
      </section>
      <div className="tablero-fila">
        <section className="card tablero-panel" aria-labelledby="zonas-titulo">
          <div className="tablero-cabeza">
            <h2 id="zonas-titulo">Kilos por zona</h2>
            <p>Dónde rinde más la ruta este mes</p>
          </div>
          <Zonas zonas={datos.zonas} />
        </section>
        <section className="card tablero-panel" aria-labelledby="estados-titulo">
          <div className="tablero-cabeza">
            <h2 id="estados-titulo">Cómo terminan las solicitudes</h2>
            <p>{entero.format(datos.actual.total_solicitudes)} solicitudes recibidas en el mes</p>
          </div>
          <Estados cuenta={contarEstados(datos.actual.filas)} />
          <Lectura datos={datos} />
        </section>
      </div>
    </div>
  )
}

// Columnas por semana: la mira es toda la franja de la semana; la semana en curso lleva su valor escrito.
function Tendencia({ semanas }: { semanas: { inicio: string; kg: number }[] }) {
  const mayor = Math.max(...semanas.map((s) => s.kg), 1)
  const { tope, marcas } = escala(mayor)
  const alto = (kg: number) => (kg / tope) * 100 + '%'
  return (
    <figure className="tendencia">
      <div className="tendencia-grafica" style={{ '--columnas': semanas.length } as CSSProperties}>
        <div className="tendencia-eje" aria-hidden="true">
          {marcas.map((m) => (
            <span key={m} style={{ bottom: alto(m) }}>
              {kilos.format(m)}
            </span>
          ))}
        </div>
        <div className="tendencia-area">
          {marcas.slice(1).map((m) => (
            <i key={m} className="tendencia-guia" style={{ bottom: alto(m) }} />
          ))}
          {semanas.map((s, i) => {
            const lado = i < 2 ? 'inicio' : i > semanas.length - 3 ? 'fin' : 'centro'
            const texto = `Semana del ${fecha(s.inicio)}: ${kilos.format(s.kg)} kg`
            return (
              <button key={s.inicio} type="button" className="tendencia-columna" aria-label={texto}>
                <span className="tendencia-barra" style={{ height: alto(s.kg) }}>
                  {i === semanas.length - 1 && s.kg > 0 && <b className="tendencia-valor">{kilos.format(s.kg)}</b>}
                </span>
                <span className="tablero-tip" data-lado={lado} role="presentation">
                  <strong>{kilos.format(s.kg)} kg</strong>
                  Semana del {fecha(s.inicio)}
                  {i === semanas.length - 1 && ' (en curso)'}
                </span>
              </button>
            )
          })}
        </div>
        <div className="tendencia-dias" aria-hidden="true">
          {semanas.map((s, i) => (
            <span key={s.inicio}>{i % 2 === semanas.length % 2 ? '' : fecha(s.inicio)}</span>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>Kilos validados por semana</caption>
        <tbody>
          {semanas.map((s) => (
            <tr key={s.inicio}>
              <th scope="row">Semana del {fecha(s.inicio)}</th>
              <td>{kilos.format(s.kg)} kg</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}

// Barras horizontales de mayor a menor, con el valor en la punta y el detalle al pasar o enfocar.
function Zonas({ zonas }: { zonas: Grupo[] }) {
  const total = zonas.reduce((suma, z) => suma + Number(z.kg), 0)
  const mayor = Math.max(...zonas.map((z) => Number(z.kg)), 1)
  if (!total) return <p className="muted">Este mes todavía no hay kilos validados.</p>
  return (
    <ul className="zonas">
      {zonas.map((z) => {
        const kg = Number(z.kg)
        const texto = `${z.nombre}: ${kilos.format(kg)} kg, ${porcentaje.format(kg / total)} del mes`
        return (
          <li key={z.nombre}>
            <button type="button" className="zona" aria-label={texto}>
              <span className="zona-nombre">{z.nombre}</span>
              <span className="zona-pista">
                <span className="zona-barra" style={{ width: (kg / mayor) * 68 + '%' }} />
                <span className="zona-valor">
                  {kilos.format(kg)} kg <small>{porcentaje.format(kg / total)}</small>
                </span>
              </span>
              <span className="tablero-tip" data-lado="inicio" role="presentation">
                <strong>{kilos.format(kg)} kg</strong>
                {entero.format(z.recolecciones)} recolecciones de {entero.format(z.solicitudes)} solicitudes
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

// Una barra segmentada (el todo y sus partes) con leyenda; el porcentaje va dentro solo si cabe.
function Estados({ cuenta }: { cuenta: Record<Estado, number> }) {
  const total = Object.values(cuenta).reduce((a, b) => a + b, 0)
  if (!total) return <p className="muted">Este mes todavía no hay solicitudes.</p>
  const partes = ESTADOS.filter((e) => cuenta[e.clave] > 0)
  return (
    <>
      <div className="segmentos">
        {partes.map((e) => {
          const parte = cuenta[e.clave] / total
          return (
            <span
              key={e.clave}
              className="segmento"
              tabIndex={0}
              aria-label={`${e.nombre}: ${entero.format(cuenta[e.clave])} (${porcentaje.format(parte)})`}
              style={{ flexGrow: cuenta[e.clave], background: e.color, color: e.tinta }}
            >
              {parte >= 0.09 && <b aria-hidden="true">{porcentaje.format(parte)}</b>}
              <span className="tablero-tip" data-lado="centro" role="presentation">
                <strong>{entero.format(cuenta[e.clave])}</strong>
                {e.nombre} · {porcentaje.format(parte)}
              </span>
            </span>
          )
        })}
      </div>
      <ul className="leyenda">
        {partes.map((e) => (
          <li key={e.clave}>
            <i style={{ background: e.color }} aria-hidden="true" />
            {e.nombre}
            <strong>{entero.format(cuenta[e.clave])}</strong>
          </li>
        ))}
      </ul>
    </>
  )
}
