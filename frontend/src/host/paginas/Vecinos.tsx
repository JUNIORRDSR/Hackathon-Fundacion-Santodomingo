import { useCallback, useEffect, useState } from 'react'
import { DataTable } from '../../ecoconecta-coordinacion/components/ui/DataTable'
import { EmptyState, ErrorMessage } from '../../ecoconecta-coordinacion/components/ui/Feedback'
import { FilterSelect } from '../../ecoconecta-coordinacion/components/ui/FilterSelect'
import { Icon } from '../../ecoconecta-coordinacion/components/ui/Icon'
import { Modal } from '../../ecoconecta-coordinacion/components/ui/Modal'
import { MotionPills } from '../../ecoconecta-coordinacion/components/ui/MotionPills'
import type { Zone } from '../../ecoconecta-coordinacion'
import { api } from '../api'
import { lugarYDireccion, nombresDeLugares } from './ubicacion'
import { RegistrarVecino } from './RegistrarVecino'

export interface Vecino {
  id: string
  nombre: string
  tipo: 'hogar' | 'unidad_productiva'
  zona_id: string
  conjunto_id: string | null
  direccion: string
  telefono: string
  estado: 'pendiente' | 'habilitado'
  autorizo_en: string
  registrado_por: string | null
}
type Tipo = 'todos' | Vecino['tipo']
const TIPOS: Record<Tipo, string> = { todos: 'Todos', hogar: 'Hogares', unidad_productiva: 'Negocios' }
const fecha = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' })

// Todos los hogares y negocios del piloto, con filtros por tipo, zona y conjunto (ADR-0017).
export function Vecinos({ nuevo }: { nuevo: number }) {
  const [vecinos, setVecinos] = useState<Vecino[]>()
  const [zonas, setZonas] = useState<Zone[]>([])
  const [saldos, setSaldos] = useState<Record<string, number>>({})
  const [tipo, setTipo] = useState<Tipo>('todos')
  const [zona, setZona] = useState('')
  const [conjunto, setConjunto] = useState('')
  const [elegido, setElegido] = useState<Vecino>()
  const [registrando, setRegistrando] = useState(false)
  const [aviso, setAviso] = useState('')
  const [error, setError] = useState('')
  const cargar = useCallback(() => {
    Promise.all([
      api<Vecino[]>('/directorio/solicitantes'),
      api<Zone[]>('/directorio/zonas'),
      api<Record<string, number>>('/puntos/saldos'),
    ])
      .then(([lista, catalogo, puntos]) => {
        setVecinos(lista)
        setZonas(catalogo)
        setSaldos(puntos)
      })
      .catch((e: Error) => setError(e.message))
  }, [])
  useEffect(cargar, [cargar])
  useEffect(() => {
    if (nuevo) setRegistrando(true)
  }, [nuevo])

  const nombres = nombresDeLugares(zonas)
  const conjuntos = zonas.find((z) => z.id === zona)?.conjuntos ?? []
  const visibles = (vecinos ?? []).filter(
    (v) =>
      (tipo === 'todos' || v.tipo === tipo) &&
      (!zona || v.zona_id === zona) &&
      (!conjunto || v.conjunto_id === conjunto),
  )
  return (
    <section aria-label="Vecinos y negocios">
      <div className="filtros-registro">
        <MotionPills className="pills" label="Filtrar por tipo" active={tipo}>
          {(Object.keys(TIPOS) as Tipo[]).map((t) => (
            <button key={t} type="button" className="pill" aria-pressed={tipo === t} onClick={() => setTipo(t)}>
              {TIPOS[t]}
            </button>
          ))}
        </MotionPills>
        <FilterSelect
          label="Filtrar por zona"
          value={zona}
          options={[{ value: '', label: 'Todas las zonas' }, ...zonas.map((z) => ({ value: z.id, label: z.nombre }))]}
          onChange={(value) => {
            setZona(value)
            setConjunto('')
          }}
        />
        {conjuntos.length > 0 && (
          <FilterSelect
            label="Filtrar por conjunto"
            value={conjunto}
            options={[
              { value: '', label: 'Todos los conjuntos' },
              ...conjuntos.map((c) => ({ value: c.id, label: c.nombre })),
            ]}
            onChange={setConjunto}
          />
        )}
      </div>
      {error && <ErrorMessage message={error} retry={cargar} />}
      {aviso && (
        <p className="registro-aviso" role="status">
          <Icon name="check" /> {aviso}
        </p>
      )}
      {vecinos && visibles.length === 0 ? (
        <div className="card">
          <EmptyState title="No hay vecinos con estos filtros">Cambia los filtros o registra uno nuevo.</EmptyState>
        </div>
      ) : (
        <DataTable
          items={visibles}
          rowKey={(v) => v.id}
          rowLabel={(v) => 'Ver el registro de ' + v.nombre}
          onSelect={setElegido}
          columns={[
            {
              header: 'Vecino',
              width: 'minmax(0, 1.5fr)',
              cell: (v) => (
                <>
                  <p className="request-name">{v.nombre}</p>
                  <p className="request-location">{v.tipo === 'hogar' ? 'Hogar' : 'Negocio'}</p>
                </>
              ),
            },
            { header: 'Lugar y dirección', width: 'minmax(0, 2fr)', cell: (v) => lugarYDireccion(v, nombres) },
            { header: 'WhatsApp', cell: (v) => v.telefono },
            { header: 'Puntos', cell: (v) => <strong className="vecino-puntos">{saldos[v.id] ?? 0}</strong> },
            {
              header: 'Estado',
              cell: (v) => (
                <span className="status-badge">{v.estado === 'habilitado' ? 'En el piloto' : 'Por aceptar'}</span>
              ),
            },
          ]}
        />
      )}
      {elegido && (
        <Modal title={elegido.nombre} onClose={() => setElegido(undefined)}>
          {() => (
            <>
              <dl className="detail-data">
                <div>
                  <dt>Tipo</dt>
                  <dd>{elegido.tipo === 'hogar' ? 'Hogar' : 'Negocio'}</dd>
                </div>
                <div>
                  <dt>WhatsApp</dt>
                  <dd>{elegido.telefono}</dd>
                </div>
                <div>
                  <dt>Puntos</dt>
                  <dd>{saldos[elegido.id] ?? 0}</dd>
                </div>
                <div className="detail-wide">
                  <dt>Lugar y dirección</dt>
                  <dd>{lugarYDireccion(elegido, nombres)}</dd>
                </div>
                <div className="detail-wide">
                  <dt>Autorización de datos (Ley 1581)</dt>
                  <dd>
                    {fecha.format(new Date(elegido.autorizo_en))},{' '}
                    {elegido.registrado_por
                      ? 'firmada en la tableta por ' + elegido.registrado_por
                      : 'dada por WhatsApp'}
                  </dd>
                </div>
              </dl>
            </>
          )}
        </Modal>
      )}
      {registrando && (
        <RegistrarVecino
          zonas={zonas}
          onClose={() => setRegistrando(false)}
          alRegistrar={(v) => {
            setAviso(`${v.nombre} quedó en el piloto y le escribimos por WhatsApp.`)
            cargar()
          }}
        />
      )}
    </section>
  )
}
