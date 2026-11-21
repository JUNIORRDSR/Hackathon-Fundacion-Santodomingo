import { useEffect, useId, useRef, useState } from 'react'
import type { Request } from '../../ecoconecta-coordinacion'
import { formatWeight, statusLabels } from '../../ecoconecta-coordinacion/labels'
import { ErrorMessage, errorText } from '../../ecoconecta-coordinacion/components/ui/Feedback'
import { Icon } from '../../ecoconecta-coordinacion/components/ui/Icon'
import { MonarchMark } from '../../ecoconecta-coordinacion/components/ui/MonarchMark'
import { api } from '../api'
import { solicitudDe } from '../repositorio'
import type { SolicitudVista } from '../repositorio'
import { Bolsa, Registrada } from './Bolsa'
import type { Hogar } from './Bolsa'
import type { EtiquetaVista } from './Etiquetas'
import { useCamaraQr } from './useCamaraQr'

type Paso =
  | { tipo: 'buscando' }
  | { tipo: 'leyendo' }
  | { tipo: 'hogar'; hogar: Hogar }
  | { tipo: 'lista'; solicitud: Request }
  | { tipo: 'error'; mensaje: string }

const CODIGO_DE_SOLICITUD = /^(org|rec)-\d{1,6}$/i

// El QR y el código del hogar escrito en un papel traen el hogar (ADR-0015); el de la solicitud, esa solicitud.
async function buscar(texto: string): Promise<Hogar> {
  if (CODIGO_DE_SOLICITUD.test(texto)) {
    const vista = await api<SolicitudVista>('/solicitudes/codigo/' + encodeURIComponent(texto))
    const solicitud = solicitudDe(vista)
    if (solicitud.estado !== 'pendiente' && solicitud.estado !== 'asignada') {
      throw new Error(`La solicitud ${solicitud.codigo} ya está ${statusLabels[solicitud.estado].toLowerCase()}.`)
    }
    return { nombre: vista.solicitante_nombre, zona: vista.zona, habilitado: true, solicitudes: [solicitud] }
  }
  const lectura = await api<{ etiqueta: EtiquetaVista; solicitudes: SolicitudVista[] }>(
    '/etiquetas/lectura?contenido=' + encodeURIComponent(texto),
  )
  const { nombre, zona, habilitado, codigo } = lectura.etiqueta
  return { nombre, zona, habilitado, codigo, solicitudes: lectura.solicitudes.map(solicitudDe) }
}

export function Lector() {
  const [paso, setPaso] = useState<Paso>({ tipo: 'buscando' })
  const [jornada, setJornada] = useState({ bolsas: 0, kg: 0 })
  const [ronda, setRonda] = useState(0) // cada bolsa nueva limpia el código escrito
  const ultimo = useRef('') // la bolsa que sigue frente a la cámara no se vuelve a abrir sola
  const panel = useRef<HTMLElement>(null)

  function abrir(texto: string) {
    setPaso({ tipo: 'leyendo' })
    buscar(texto.trim()).then(
      (hogar) => setPaso({ tipo: 'hogar', hogar }),
      (error: unknown) => setPaso({ tipo: 'error', mensaje: errorText(error) }),
    )
  }
  const { video, estado } = useCamaraQr(paso.tipo === 'buscando', (texto) => {
    if (texto === ultimo.current) return
    ultimo.current = texto
    navigator.vibrate?.(40)
    abrir(texto)
  })

  useEffect(() => {
    if (paso.tipo !== 'buscando') panel.current?.scrollIntoView({ block: 'nearest' })
  }, [paso.tipo])

  function registrada(solicitud: Request) {
    const kg = solicitud.estado === 'recolectada' ? solicitud.resultado.pesoKg : 0
    setJornada((actual) => ({ bolsas: actual.bolsas + 1, kg: actual.kg + kg }))
    setPaso({ tipo: 'lista', solicitud })
  }
  function seguir() {
    setRonda((n) => n + 1)
    setPaso({ tipo: 'buscando' })
  }

  return (
    <div className="escaneo">
      <section className="card escaneo-camara" aria-label="Cámara">
        <div className="visor" data-pausa={estado === 'lista' && paso.tipo !== 'buscando'}>
          <video ref={video} muted playsInline aria-hidden="true" />
          {estado === 'lista' ? (
            <span className="visor-marco" aria-hidden="true">
              <i />
            </span>
          ) : (
            <AvisoCamara estado={estado} />
          )}
          {estado === 'lista' && (
            <p className="visor-estado" role="status">
              {paso.tipo === 'buscando'
                ? 'Apunta al QR del sticker'
                : paso.tipo === 'leyendo'
                  ? 'Leyendo…'
                  : 'En pausa'}
            </p>
          )}
        </div>
        <PorCodigo key={ronda} onBuscar={abrir} ocupado={paso.tipo === 'leyendo'} />
      </section>
      <section className="card escaneo-resultado" aria-live="polite" aria-label="Bolsa" ref={panel}>
        <div key={paso.tipo} className="view-content">
          {paso.tipo === 'buscando' && <Espera {...jornada} />}
          {paso.tipo === 'leyendo' && (
            <div className="empty-state">
              <span className="spinner" aria-hidden="true" />
              <span>Buscando el hogar…</span>
            </div>
          )}
          {paso.tipo === 'hogar' && <Bolsa hogar={paso.hogar} onRegistrada={registrada} onSeguir={seguir} />}
          {paso.tipo === 'lista' && <Registrada solicitud={paso.solicitud} onSiguiente={seguir} />}
          {paso.tipo === 'error' && (
            <div className="bolsa">
              <ErrorMessage message={paso.mensaje} />
              <button
                type="button"
                className="button button-secondary"
                autoFocus
                onClick={() => {
                  ultimo.current = ''
                  seguir()
                }}
              >
                <Icon name="qr" /> Volver a escanear
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function Espera({ bolsas, kg }: { bolsas: number; kg: number }) {
  return (
    <div className="escaneo-espera">
      <MonarchMark />
      <h2>
        {bolsas ? `${bolsas} ${bolsas === 1 ? 'bolsa' : 'bolsas'} en esta jornada` : 'Esperando la primera bolsa'}
      </h2>
      <p>
        {bolsas
          ? `${formatWeight(kg)} registrados. Apunta a la siguiente.`
          : 'Apunta la cámara al sticker de la bolsa o escribe el código que trae en un papel.'}
      </p>
      <ol className="escaneo-pasos">
        <li>Escanea el sticker</li>
        <li>Registra el peso o el rechazo</li>
        <li>Sigue con la siguiente</li>
      </ol>
    </div>
  )
}

function AvisoCamara({ estado }: { estado: 'iniciando' | 'sin-camara' | 'denegada' }) {
  if (estado === 'iniciando') return <p className="visor-aviso">Encendiendo la cámara…</p>
  return (
    <div className="visor-aviso">
      <Icon name="camera" />
      <strong>{estado === 'denegada' ? 'La cámara está bloqueada' : 'No hay cámara disponible'}</strong>
      <span>
        {estado === 'denegada'
          ? 'Permítela desde el candado de la barra de direcciones y recarga la página.'
          : 'La cámara del navegador necesita HTTPS. Mientras tanto, escribe el código de la bolsa.'}
      </span>
    </div>
  )
}

function PorCodigo({ onBuscar, ocupado }: { onBuscar: (codigo: string) => void; ocupado: boolean }) {
  const id = useId()
  const [codigo, setCodigo] = useState('')
  return (
    <form
      className="visor-manual"
      onSubmit={(event) => {
        event.preventDefault()
        if (codigo.trim()) onBuscar(codigo)
      }}
    >
      <label htmlFor={id}>¿Sin QR? Escribe el código del hogar o el de la solicitud</label>
      <div className="visor-manual-campo field">
        <input
          id={id}
          placeholder="1008 o REC-0017"
          autoCapitalize="characters"
          autoComplete="off"
          value={codigo}
          onChange={(event) => setCodigo(event.target.value)}
        />
        <button className="button button-secondary" type="submit" disabled={!codigo.trim() || ocupado}>
          <Icon name="search" /> Buscar
        </button>
      </div>
    </form>
  )
}
