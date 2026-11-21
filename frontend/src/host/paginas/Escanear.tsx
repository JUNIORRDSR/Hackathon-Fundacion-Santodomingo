import { useState } from 'react'
import { PageHeader } from '../../ecoconecta-coordinacion/components/layout/Layout'
import { MotionPills } from '../../ecoconecta-coordinacion/components/ui/MotionPills'
import { Etiquetas } from './Etiquetas'
import { Lector } from './Lector'
import './escanear.css'

// ADR-0015: al pesar, el QR del sticker lleva a la solicitud abierta del hogar. En Etiquetas la cámara se apaga.
export function Escanear() {
  const [vista, setVista] = useState<'escanear' | 'etiquetas'>('escanear')
  return (
    <>
      <PageHeader
        title="Escanear bolsas"
        description="Apunta al sticker QR de la bolsa, registra el peso o el rechazo y sigue con la siguiente."
      />
      <MotionPills className="segmented-control escaneo-vista" label="Escanear o imprimir etiquetas" active={vista}>
        <button type="button" aria-pressed={vista === 'escanear'} onClick={() => setVista('escanear')}>
          Escanear
        </button>
        <button type="button" aria-pressed={vista === 'etiquetas'} onClick={() => setVista('etiquetas')}>
          Etiquetas
        </button>
      </MotionPills>
      {vista === 'escanear' ? <Lector /> : <Etiquetas />}
    </>
  )
}
