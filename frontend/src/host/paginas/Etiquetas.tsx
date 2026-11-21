import { useEffect, useState } from 'react'
import monarca from '../../../identidad-visual/Mariposa monarca - isotipo.webp'
import { normalizeSearch } from '../../ecoconecta-coordinacion/labels'
import { EmptyState, ErrorMessage, LoadingState, errorText } from '../../ecoconecta-coordinacion/components/ui/Feedback'
import { Icon } from '../../ecoconecta-coordinacion/components/ui/Icon'
import { api } from '../api'

export interface EtiquetaVista {
  solicitante_id: string
  nombre: string
  tipo: 'hogar' | 'unidad_productiva'
  zona: string
  habilitado: boolean
  contenido: string
}
type Fabrica = typeof import('qrcode-generator')

// El QR como un solo trazo SVG: nítido al imprimir y sin HTML inyectado. Nivel M aguanta una bolsa arrugada.
function CodigoQr({ texto, fabrica }: { texto: string; fabrica: Fabrica }) {
  const qr = fabrica(0, 'M')
  qr.addData(texto)
  qr.make()
  const lado = qr.getModuleCount()
  let trazo = ''
  for (let fila = 0; fila < lado; fila++) {
    for (let columna = 0; columna < lado; columna++) {
      if (qr.isDark(fila, columna)) trazo += `M${columna} ${fila}h1v1h-1z`
    }
  }
  return (
    <svg className="etiqueta-qr" viewBox={`-3 -3 ${lado + 6} ${lado + 6}`} aria-hidden="true">
      <path d={trazo} />
    </svg>
  )
}

// Un sticker por hogar habilitado (ADR-0015). Se imprime lo que muestra la búsqueda.
export function Etiquetas() {
  const [etiquetas, setEtiquetas] = useState<EtiquetaVista[]>()
  const [fabrica, setFabrica] = useState<Fabrica>()
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    const control = new AbortController()
    Promise.all([api<EtiquetaVista[]>('/etiquetas', 'GET', undefined, control.signal), import('qrcode-generator')])
      .then(([lista, modulo]) => {
        setEtiquetas(lista)
        setFabrica(() => modulo.default)
      })
      .catch((causa: unknown) => control.signal.aborted || setError(errorText(causa)))
    return () => control.abort()
  }, [intento])

  if (error) {
    const reintentar = () => {
      setError('')
      setIntento((n) => n + 1)
    }
    return <ErrorMessage message={error} retry={reintentar} />
  }
  if (!etiquetas || !fabrica) return <LoadingState />
  const termino = normalizeSearch(busqueda)
  const visibles = etiquetas.filter((e) => normalizeSearch(e.nombre + ' ' + e.zona).includes(termino))

  return (
    <>
      <div className="etiquetas-barra">
        <div className="search-field">
          <Icon name="search" />
          <label htmlFor="eco-etiquetas-buscar" className="sr-only">
            Buscar por nombre o zona
          </label>
          <input
            id="eco-etiquetas-buscar"
            type="search"
            placeholder="Buscar hogar o zona"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
          />
        </div>
        <span className="muted">
          {visibles.length} {visibles.length === 1 ? 'etiqueta' : 'etiquetas'}
        </span>
        <button
          type="button"
          className="button button-primary"
          disabled={!visibles.length}
          onClick={() => window.print()}
        >
          <Icon name="printer" /> Imprimir
        </button>
      </div>
      {visibles.length ? (
        <ul className="etiquetas-hoja" aria-label="Stickers para imprimir">
          {visibles.map((etiqueta) => (
            <li className="etiqueta" key={etiqueta.solicitante_id}>
              <CodigoQr texto={etiqueta.contenido} fabrica={fabrica} />
              <div>
                <strong>{etiqueta.nombre}</strong>
                <span>{etiqueta.zona}</span>
                <span className="etiqueta-marca">
                  <img src={monarca} alt="" width="48" height="36" />
                  EcoConecta · Villas de San Pablo
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="card">
          <EmptyState
            title={busqueda ? 'No hay etiquetas con esa búsqueda' : 'Aún no hay hogares habilitados'}
            icon="qr"
          >
            Cada hogar o negocio aceptado en Registros tiene su sticker.
          </EmptyState>
        </div>
      )}
    </>
  )
}
