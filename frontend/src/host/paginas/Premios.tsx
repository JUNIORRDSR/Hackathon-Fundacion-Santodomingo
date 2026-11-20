import { useCallback, useEffect, useState } from 'react'
import { ErrorMessage } from '../../ecoconecta-coordinacion/components/ui/Feedback'
import { api } from '../api'

interface Premio {
  id?: string
  nombre: string
  costo: number
  activo: boolean
  ejemplo?: boolean
}
const NUEVO: Premio = { nombre: '', costo: 30, activo: true }

// El catálogo lo edita la administración; la coordinación solo lo consulta (ADR-0008).
export function Premios({ administrador }: { administrador: boolean }) {
  const [premios, setPremios] = useState<Premio[]>([])
  const [error, setError] = useState('')
  const cargar = useCallback(() => {
    api<Premio[]>('/puntos/premios')
      .then(setPremios)
      .catch((e: Error) => setError(e.message))
  }, [])
  useEffect(cargar, [cargar])

  async function guardar(premio: Premio) {
    setError('')
    const cuerpo = { nombre: premio.nombre, costo: premio.costo, activo: premio.activo }
    try {
      await (premio.id ? api('/puntos/premios/' + premio.id, 'PUT', cuerpo) : api('/puntos/premios', 'POST', cuerpo))
      cargar()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <section className="premios" aria-labelledby="premios-titulo">
      <h2 id="premios-titulo">Premios del canje</h2>
      <div className="card">
        {premios.map((p) =>
          administrador ? (
            <FilaEditable key={p.id} premio={p} onGuardar={guardar} />
          ) : (
            <div className="premio-fila" key={p.id}>
              <strong>{p.nombre}</strong>
              <span>{p.costo} puntos</span>
              <span className="muted">{p.activo ? 'Disponible' : 'No disponible'}</span>
            </div>
          ),
        )}
        {administrador && <FilaEditable key={premios.length} premio={NUEVO} onGuardar={guardar} />}
        {premios.some((p) => p.ejemplo) && (
          <p className="premio-nota">Los premios de ejemplo quedan así hasta que la fundación fije sus valores.</p>
        )}
        {error && <ErrorMessage message={error} />}
      </div>
    </section>
  )
}

function FilaEditable({ premio, onGuardar }: { premio: Premio; onGuardar: (p: Premio) => Promise<void> }) {
  const [datos, setDatos] = useState(premio)
  const nuevo = !premio.id
  return (
    <form
      className="premio-fila"
      onSubmit={(event) => {
        event.preventDefault()
        void onGuardar(datos)
      }}
    >
      <input
        aria-label="Premio"
        placeholder={nuevo ? 'Nuevo premio' : undefined}
        value={datos.nombre}
        onChange={(e) => setDatos({ ...datos, nombre: e.target.value })}
      />
      <input
        aria-label="Puntos"
        type="number"
        min={1}
        inputMode="numeric"
        value={datos.costo}
        onChange={(e) => setDatos({ ...datos, costo: Number(e.target.value) })}
      />
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={datos.activo}
          onChange={(e) => setDatos({ ...datos, activo: e.target.checked })}
        />
        Disponible
      </label>
      <button type="submit" className="button button-secondary" disabled={datos.nombre.trim().length < 2}>
        {nuevo ? 'Agregar' : 'Guardar'}
      </button>
    </form>
  )
}
