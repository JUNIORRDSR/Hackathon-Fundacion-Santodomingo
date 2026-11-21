import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { ErrorMessage } from '../../ecoconecta-coordinacion/components/ui/Feedback'
import { api } from '../api'

type Flujo = 'organico' | 'reciclable'
type Valores = Record<Flujo, string>
interface Regla {
  version: number
  base: Record<Flujo, number>
  por_kg: Record<Flujo, string>
}

const FLUJOS: [Flujo, string][] = [
  ['organico', 'Orgánicos'],
  ['reciclable', 'Reciclables'],
]
const KILOS_DE_EJEMPLO = 4

// La regla de puntos con su versión (RN-06): todos la ven; solo el administrador la cambia.
export function ReglaPuntos({ editable }: { editable: boolean }) {
  const [version, setVersion] = useState<number>()
  const [base, setBase] = useState<Valores>({ organico: '', reciclable: '' })
  const [porKg, setPorKg] = useState<Valores>({ organico: '', reciclable: '' })
  const [error, setError] = useState('')
  const [aviso, setAviso] = useState('')
  const [guardando, setGuardando] = useState(false)

  function mostrar(regla: Regla) {
    setVersion(regla.version)
    setBase({ organico: String(regla.base.organico), reciclable: String(regla.base.reciclable) })
    setPorKg({ organico: String(Number(regla.por_kg.organico)), reciclable: String(Number(regla.por_kg.reciclable)) })
  }
  useEffect(() => {
    api<Regla>('/puntos/regla')
      .then(mostrar)
      .catch((e: Error) => setError(e.message))
  }, [])

  async function guardar(event: FormEvent) {
    event.preventDefault()
    setGuardando(true)
    setError('')
    setAviso('')
    try {
      const numeros = (valores: Valores) => ({
        organico: Number(valores.organico),
        reciclable: Number(valores.reciclable),
      })
      const nueva = await api<Regla>('/puntos/regla', 'PUT', { base: numeros(base), por_kg: numeros(porKg) })
      mostrar(nueva)
      setAviso(`Quedó la versión ${nueva.version}. Los puntos que ya se dieron no cambian.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo guardar la regla.')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section className="regla" aria-labelledby="regla-titulo">
      <div className="regla-cabeza">
        <h2 id="regla-titulo">Regla de puntos {version !== undefined && `(versión ${version})`}</h2>
        <p className="muted">
          Cada recolección bien separada suma sus puntos; si se pesó, suma además los puntos por cada kilo.
        </p>
      </div>
      <form className="regla-formulario" onSubmit={(event) => void guardar(event)}>
        <div className="regla-flujos">
          {FLUJOS.map(([flujo, nombre]) => {
            const ejemplo = Number(base[flujo]) + Math.floor(KILOS_DE_EJEMPLO * Number(porKg[flujo]))
            return (
              <fieldset key={flujo} className="card regla-flujo" disabled={!editable || guardando}>
                <legend>{nombre}</legend>
                <div className="field">
                  <label htmlFor={'base-' + flujo}>Puntos por separar bien</label>
                  <input
                    id={'base-' + flujo}
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    required
                    value={base[flujo]}
                    onChange={(e) => setBase({ ...base, [flujo]: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor={'kg-' + flujo}>Puntos por cada kilo</label>
                  <input
                    id={'kg-' + flujo}
                    type="number"
                    min={0}
                    step={0.1}
                    inputMode="decimal"
                    required
                    value={porKg[flujo]}
                    onChange={(e) => setPorKg({ ...porKg, [flujo]: e.target.value })}
                  />
                </div>
                <p className="regla-ejemplo">
                  Con {KILOS_DE_EJEMPLO} kg: <strong>{Number.isFinite(ejemplo) ? ejemplo : 0} puntos</strong>
                </p>
              </fieldset>
            )
          })}
        </div>
        {editable ? (
          <div className="form-actions">
            <button type="submit" className="button button-primary" disabled={guardando}>
              {guardando ? 'Guardando…' : 'Guardar regla'}
            </button>
          </div>
        ) : (
          <p className="muted">Solo el administrador cambia la regla, con los valores que valide la fundación.</p>
        )}
        {aviso && (
          <p className="regla-aviso" role="status">
            {aviso}
          </p>
        )}
        {error && <ErrorMessage message={error} />}
      </form>
    </section>
  )
}
