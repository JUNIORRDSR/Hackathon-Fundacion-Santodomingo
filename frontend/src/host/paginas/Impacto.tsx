import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { Icon } from '../../ecoconecta-coordinacion/components/ui/Icon'
import { api } from '../api'
import { mesActual, moverMes, nombreMes, periodo } from './meses'

interface Resumen {
  total_kg: string
  recolecciones: number
  vecinos: number
  puntos: number
  por_dia: { dia: string; kg: string }[]
}
type Grupo = 'organico' | 'reciclable'

const diaCorto = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const kilos = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 })
const entero = new Intl.NumberFormat('es-CO')
const etiqueta = (fecha: string) => diaCorto.format(new Date(fecha + 'T00:00:00Z'))

// Eje y con números redondos (1, 2 o 5 por potencia de 10) y tres o cuatro marcas.
export function escala(maximo: number) {
  const bruto = maximo / 3
  const potencia = 10 ** Math.floor(Math.log10(bruto))
  const paso = [1, 2, 5, 10].map((m) => m * potencia).find((p) => p >= bruto) ?? potencia * 10
  const tope = Math.ceil(maximo / paso) * paso
  return { tope, marcas: Array.from({ length: Math.round(tope / paso) + 1 }, (_, i) => i * paso) }
}

// El impacto del barrio por mes, con datos reales de los reportes: lo primero que se ve al entrar.
export function Impacto({ grupo }: { grupo: Grupo }) {
  const [mes, setMes] = useState(mesActual)
  const [resumen, setResumen] = useState<Resumen | 'cargando' | 'error'>('cargando')
  const { desde, hasta, dias } = periodo(mes)
  const consulta = `desde=${desde}&hasta=${hasta}&colectivo=${grupo === 'organico' ? 'huerteros' : 'recicladores'}`
  useEffect(() => {
    const control = new AbortController()
    setResumen('cargando')
    api<Resumen>('/reportes/resumen?' + consulta, 'GET', undefined, control.signal)
      .then(setResumen)
      .catch(() => !control.signal.aborted && setResumen('error'))
    return () => control.abort()
  }, [consulta])
  const titulo = nombreMes.format(new Date(desde + 'T00:00:00Z'))

  return (
    <section className="card impacto" aria-labelledby="impacto-titulo" aria-busy={resumen === 'cargando'}>
      <div className="impacto-cabeza">
        <div>
          <h2 id="impacto-titulo">Impacto en Villas de San Pablo</h2>
          <p>Lo que el barrio separó y entregó, mes a mes</p>
        </div>
        <div className="impacto-acciones">
          <div className="date-selector impacto-mes" role="group" aria-label="Mes del impacto">
            <button
              type="button"
              className="icon-button date-previous"
              aria-label="Mes anterior"
              onClick={() => setMes(moverMes(mes, -1))}
            >
              <Icon name="chevron" />
            </button>
            <span aria-live="polite">{titulo}</span>
            <button
              type="button"
              className="icon-button date-next"
              aria-label="Mes siguiente"
              disabled={mes >= mesActual}
              onClick={() => setMes(moverMes(mes, 1))}
            >
              <Icon name="chevron" />
            </button>
          </div>
          <a className="button button-secondary" href={'/api/reportes/solicitudes.xlsx?' + consulta} download>
            Exportar mes en Excel
          </a>
        </div>
      </div>
      {resumen === 'cargando' && <p className="impacto-estado">Cargando el impacto de {titulo}…</p>}
      {resumen === 'error' && <p className="impacto-estado">No se pudo cargar el impacto. Revisa la conexión.</p>}
      {typeof resumen === 'object' && <Cifras key={mes} resumen={resumen} grupo={grupo} desde={desde} dias={dias} />}
    </section>
  )
}

function Cifras({ resumen, grupo, desde, dias }: { resumen: Resumen; grupo: Grupo; desde: string; dias: number }) {
  const total = Number(resumen.total_kg)
  if (!total) return <p className="impacto-estado">En este mes todavía no hay kilos validados.</p>
  return (
    <div className="impacto-cuerpo">
      <div className="impacto-resumen">
        <p className="impacto-kg">
          <strong>{kilos.format(total)}</strong>
          <span>kg de {grupo === 'organico' ? 'orgánicos' : 'reciclables'} que no llegaron al relleno</span>
        </p>
        <dl className="impacto-cifras">
          <div>
            <dt>Recolecciones</dt>
            <dd>{entero.format(resumen.recolecciones)}</dd>
          </div>
          <div>
            <dt>Vecinos que participaron</dt>
            <dd>{entero.format(resumen.vecinos)}</dd>
          </div>
          <div className="impacto-puntos">
            <dt>Puntos ganados</dt>
            <dd>{entero.format(resumen.puntos)}</dd>
          </div>
        </dl>
      </div>
      <Grafica porDia={resumen.por_dia} desde={desde} dias={dias} />
    </div>
  )
}

// Kilos por día: eje y con marcas y líneas guía; la barra elegida (de entrada, la del día mayor) dice su valor.
function Grafica({ porDia, desde, dias }: { porDia: Resumen['por_dia']; desde: string; dias: number }) {
  const valores = new Map(porDia.map((d) => [d.dia, Number(d.kg)]))
  const mayor = porDia.reduce((a, d) => (Number(d.kg) > Number(a.kg) ? d : a))
  const [elegido, setElegido] = useState(mayor.dia)
  const { tope, marcas } = escala(Number(mayor.kg))
  const fechas = Array.from({ length: dias }, (_, i) => desde.slice(0, 8) + String(i + 1).padStart(2, '0'))
  const alto = (kg: number) => (kg / tope) * 100 + '%'
  return (
    <figure className="impacto-grafica">
      <figcaption>Kilos validados por día (kg)</figcaption>
      <div className="grafica" style={{ '--dias': dias } as CSSProperties} aria-hidden="true">
        <div className="grafica-eje">
          {marcas.map((m) => (
            <span key={m} style={{ bottom: alto(m) }}>
              {kilos.format(m)}
            </span>
          ))}
        </div>
        <div className="grafica-area">
          {marcas.slice(1).map((m) => (
            <i key={m} className="grafica-linea" style={{ bottom: alto(m) }} />
          ))}
          {fechas.map((fecha, i) => {
            const kg = valores.get(fecha) ?? 0
            const lado = i < 3 ? 'inicio' : i > dias - 4 ? 'fin' : 'centro'
            return (
              <div
                key={fecha}
                className="grafica-columna"
                onPointerEnter={() => kg > 0 && setElegido(fecha)}
                onClick={() => kg > 0 && setElegido(fecha)}
              >
                {kg > 0 && (
                  <span className="grafica-barra" style={{ height: alto(kg) }}>
                    {fecha === elegido && (
                      <b className="grafica-valor" data-lado={lado}>
                        {etiqueta(fecha)}: {kilos.format(kg)} kg
                      </b>
                    )}
                  </span>
                )}
              </div>
            )
          })}
        </div>
        <div className="grafica-dias">
          {fechas.map((fecha, i) => (
            <span key={fecha}>{i === 0 || (i + 1) % 5 === 0 ? i + 1 : ''}</span>
          ))}
        </div>
      </div>
      <table className="sr-only">
        <caption>Kilos validados por día</caption>
        <tbody>
          {porDia.map((d) => (
            <tr key={d.dia}>
              <th scope="row">{etiqueta(d.dia)}</th>
              <td>{kilos.format(Number(d.kg))} kg</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
