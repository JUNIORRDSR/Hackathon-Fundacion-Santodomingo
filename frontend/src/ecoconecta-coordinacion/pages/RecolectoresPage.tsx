import { useState } from 'react'
import { groupLabels } from '../labels'
import type { EcoLink } from '../routes'
import type { Collector, CollectorInput, WasteType, Zone } from '../types'
import { PageHeader } from '../components/layout/Layout'
import { CollectorForm } from '../components/recolectores/CollectorForm'
import { EmptyState } from '../components/ui/Feedback'
import { Icon } from '../components/ui/Icon'

export function RecolectoresPage({
  collectors,
  zones,
  group,
  onSave,
  href,
}: {
  collectors: Collector[]
  zones: Zone[]
  group: WasteType
  onSave: (input: CollectorInput, id?: string) => Promise<() => void>
  href: EcoLink
}) {
  const [editing, setEditing] = useState<Collector | 'new' | null>(null)
  return (
    <>
      <PageHeader
        title="Recolectores"
        description={'Consulta el equipo de ' + groupLabels[group].toLowerCase() + ', su cobertura y sus rutas.'}
        action={
          <button type="button" className="button button-primary" onClick={() => setEditing('new')}>
            <Icon name="plus" /> Agregar recolector
          </button>
        }
      />
      {collectors.length ? (
        <ul className="collection-grid">
          {[...collectors]
            .sort((a, b) => Number(b.activo) - Number(a.activo) || a.nombre.localeCompare(b.nombre, 'es'))
            .map((item) => (
              <li className="card collection-card" key={item.id}>
                <div className="collection-card-top">
                  <span className="icon-tile">
                    <Icon name="user" />
                  </span>
                  <span className="status-badge">
                    <Icon name={item.activo ? 'checkCircle' : 'clock'} />
                    {item.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <h2>{item.nombre}</h2>
                <CollectorCoverage collector={item} zones={zones} />
                <div className="collector-actions">
                  <a
                    href={href({ page: 'recolecciones', collectionView: 'rutas', collectorId: item.id })}
                    className="button button-secondary"
                    aria-label={'Ver rutas de ' + item.nombre}
                  >
                    Ver rutas
                  </a>
                  <button
                    type="button"
                    className="button button-quiet"
                    aria-label={'Editar a ' + item.nombre}
                    onClick={() => setEditing(item)}
                  >
                    <Icon name="edit" /> Editar
                  </button>
                </div>
              </li>
            ))}
        </ul>
      ) : (
        <div className="card">
          <EmptyState title="Aún no hay recolectores">
            Agrega a un integrante para poder asignarle solicitudes.
          </EmptyState>
        </div>
      )}
      {editing && (
        <CollectorForm
          collector={editing === 'new' ? undefined : editing}
          zones={zones}
          onClose={() => setEditing(null)}
          onSave={onSave}
        />
      )}
    </>
  )
}

function CollectorCoverage({ collector, zones }: { collector: Collector; zones: Zone[] }) {
  const coverage = zones.flatMap((zone) => {
    const sectors = zone.conjuntos ?? []
    const selected = sectors.filter((sector) => collector.zonas.includes(sector.id))
    if (selected.length) {
      const names = selected.length === sectors.length ? 'Todos los sectores' : selected.map((s) => s.nombre).join(', ')
      return [{ name: zone.nombre, detail: names }]
    }
    if (collector.zonas.includes(zone.id)) return [{ name: zone.nombre, detail: '' }]
    return []
  })
  if (!coverage.length) return <p className="muted">Sin cobertura configurada</p>
  return (
    <dl className="collector-coverage" aria-label="Cobertura para solicitudes">
      {coverage.map(({ name, detail }) => (
        <div key={name}>
          <dt>{name}</dt>
          {detail && <dd>{detail}</dd>}
        </div>
      ))}
    </dl>
  )
}
