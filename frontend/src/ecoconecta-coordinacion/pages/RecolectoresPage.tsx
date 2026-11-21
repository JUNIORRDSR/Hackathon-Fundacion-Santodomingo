import { useState } from 'react'
import { groupLabels } from '../labels'
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
}: {
  collectors: Collector[]
  zones: Zone[]
  group: WasteType
  onSave: (input: CollectorInput, id?: string) => Promise<() => void>
}) {
  const [editing, setEditing] = useState<Collector | 'new' | null>(null)
  return (
    <>
      <PageHeader
        title="Recolectores"
        description={'Gestiona los integrantes y zonas de ' + groupLabels[group].toLowerCase() + '.'}
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
              <li className="card collection-card clickable-card" key={item.id}>
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
                <div className="small-details">
                  <span>
                    <Icon name="pin" />
                    {item.zona}
                  </span>
                </div>
                <button
                  type="button"
                  className="icon-button card-action"
                  aria-label={'Editar a ' + item.nombre}
                  onClick={() => setEditing(item)}
                >
                  <Icon name="edit" />
                </button>
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
