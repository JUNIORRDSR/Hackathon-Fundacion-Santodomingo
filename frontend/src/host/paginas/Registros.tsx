import { useState } from 'react'
import { PageHeader } from '../../ecoconecta-coordinacion/components/layout/Layout'
import { Icon } from '../../ecoconecta-coordinacion/components/ui/Icon'
import { MotionPills } from '../../ecoconecta-coordinacion/components/ui/MotionPills'
import { Lugares } from './Lugares'
import { PorHabilitar } from './PorHabilitar'
import { Vecinos } from './Vecinos'

type Vista = 'aceptar' | 'vecinos' | 'lugares'
const DESCRIPCION: Record<Vista, string> = {
  aceptar: 'Vecinos y negocios nuevos de WhatsApp. Al aceptarlos, su primer pedido entra a Solicitudes.',
  vecinos: 'Todos los hogares y negocios del piloto. Registra aquí a quien no usa el bot.',
  lugares: 'Las zonas del barrio y sus conjuntos o sectores. Nada se borra: lo que no se usa, se desactiva.',
}
const ACCION: Partial<Record<Vista, string>> = { vecinos: 'Registrar vecino o negocio', lugares: 'Agregar zona' }

// Registros (ADR-0017): personas y territorio en un solo lugar del menú, para la coordinación y el administrador.
export function Registros({ porAceptar = 0 }: { porAceptar?: number }) {
  const [vista, setVista] = useState<Vista>('aceptar')
  const [nuevo, setNuevo] = useState(0)
  const elegir = (otra: Vista) => {
    setVista(otra)
    setNuevo(0)
  }
  const accion = ACCION[vista]
  return (
    <>
      <PageHeader
        title="Registros"
        description={DESCRIPCION[vista]}
        action={
          accion && (
            <button type="button" className="button button-primary" onClick={() => setNuevo((n) => n + 1)}>
              <Icon name="plus" /> {accion}
            </button>
          )
        }
      />
      <MotionPills className="segmented-control canje-vista" label="Qué registros ver" active={vista}>
        <button type="button" aria-pressed={vista === 'aceptar'} onClick={() => elegir('aceptar')}>
          Por aceptar{porAceptar ? ` (${porAceptar})` : ''}
        </button>
        <button type="button" aria-pressed={vista === 'vecinos'} onClick={() => elegir('vecinos')}>
          Vecinos y negocios
        </button>
        <button type="button" aria-pressed={vista === 'lugares'} onClick={() => elegir('lugares')}>
          Lugares
        </button>
      </MotionPills>
      {vista === 'aceptar' && <PorHabilitar />}
      {vista === 'vecinos' && <Vecinos nuevo={nuevo} />}
      {vista === 'lugares' && <Lugares nuevo={nuevo} />}
    </>
  )
}
