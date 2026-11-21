import { useState } from 'react'
import type { InputHTMLAttributes } from 'react'
import { Icon } from '../../ecoconecta-coordinacion/components/ui/Icon'

// La clave se puede ver antes de enviarla: menos errores al escribirla en la tableta.
export function CampoClave(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="campo-clave">
      <input {...props} type={visible ? 'text' : 'password'} />
      <button
        type="button"
        className="campo-clave-ver"
        aria-controls={props.id}
        disabled={props.disabled}
        onClick={() => setVisible((antes) => !antes)}
      >
        <Icon name={visible ? 'eyeOff' : 'eye'} />
        {visible ? 'Ocultar' : 'Mostrar'}
        <span className="sr-only"> la clave</span>
      </button>
    </div>
  )
}
