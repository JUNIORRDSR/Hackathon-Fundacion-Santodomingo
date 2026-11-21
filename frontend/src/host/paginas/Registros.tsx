import { useState } from 'react'
import { PageHeader } from '../../ecoconecta-coordinacion/components/layout/Layout'
import { Icon } from '../../ecoconecta-coordinacion/components/ui/Icon'
import { MotionPills } from '../../ecoconecta-coordinacion/components/ui/MotionPills'
import type { RecordsView } from '../../ecoconecta-coordinacion/routes'
import { Lugares } from './Lugares'
import { PorHabilitar } from './PorHabilitar'
import { Vecinos } from './Vecinos'

const DESCRIPCION: Record<RecordsView, string> = {
  aceptar: 'Vecinos y negocios nuevos de WhatsApp. Al aceptarlos, su primer pedido entra a Solicitudes.',
  vecinos: 'Todos los hogares y negocios del piloto. Registra aquí a quien no usa el bot.',
  lugares: 'Administra las zonas del barrio y sus conjuntos o sectores.',
}
const ACCION: Partial<Record<RecordsView, string>> = { vecinos: 'Registrar vecino o negocio', lugares: 'Agregar zona' }

// Registros (ADR-0017): personas y territorio en un solo lugar del menú, para la coordinación y el administrador.
export function Registros({
  porAceptar = 0,
  vista,
  onVista,
}: {
  porAceptar?: number
  vista: RecordsView
  onVista: (vista: RecordsView) => void
}) {
  const [nuevo, setNuevo] = useState({ vista, veces: 0 })
  if (nuevo.vista !== vista) setNuevo({ vista, veces: 0 })
  const accion = ACCION[vista]
  return (
    <>
      <PageHeader
        title="Registros"
        description={DESCRIPCION[vista]}
        action={
          accion && (
            <button
              type="button"
              className="button button-primary"
              onClick={() => setNuevo((n) => ({ vista, veces: n.veces + 1 }))}
            >
              <Icon name="plus" /> {accion}
            </button>
          )
        }
      />
      <MotionPills className="segmented-control canje-vista" label="Qué registros ver" active={vista}>
        <button type="button" aria-pressed={vista === 'aceptar'} onClick={() => onVista('aceptar')}>
          Por aceptar{porAceptar ? ` (${porAceptar})` : ''}
        </button>
        <button type="button" aria-pressed={vista === 'vecinos'} onClick={() => onVista('vecinos')}>
          Vecinos y negocios
        </button>
        <button type="button" aria-pressed={vista === 'lugares'} onClick={() => onVista('lugares')}>
          Lugares
        </button>
      </MotionPills>
      {vista === 'aceptar' && <PorHabilitar />}
      {vista === 'vecinos' && <Vecinos nuevo={nuevo.veces} />}
      {vista === 'lugares' && <Lugares nuevo={nuevo.veces} />}
    </>
  )
}
