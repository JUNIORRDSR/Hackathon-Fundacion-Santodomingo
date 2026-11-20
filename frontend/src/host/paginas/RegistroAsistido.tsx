import { useCallback, useEffect, useId, useState } from 'react'
import type { FormEvent } from 'react'
import { PageHeader } from '../../ecoconecta-coordinacion/components/layout/Layout'
import { ErrorMessage } from '../../ecoconecta-coordinacion/components/ui/Feedback'
import { useSubmission } from '../../ecoconecta-coordinacion/components/ui/useSubmission'
import type { Zone } from '../../ecoconecta-coordinacion'
import { api } from '../api'

interface Solicitante {
  id: string
  nombre: string
  direccion: string
}
const SOLICITANTE = { telefono: '+57', nombre: '', tipo: 'hogar', zona_id: '', direccion: '' }
const SOLICITUD = { solicitante_id: '', flujo: 'organico', preferencia: 'manana', observaciones: '' }

// Para quien llama o llega en persona: la coordinación registra por la persona (ADR-0003).
export function RegistroAsistido() {
  const [zonas, setZonas] = useState<Zone[]>([])
  const [habilitados, setHabilitados] = useState<Solicitante[]>([])
  const [aviso, setAviso] = useState('')
  const cargar = useCallback(() => {
    void api<Solicitante[]>('/directorio/solicitantes?estado=habilitado').then(setHabilitados)
  }, [])
  useEffect(() => {
    void api<Zone[]>('/directorio/zonas').then(setZonas)
    cargar()
  }, [cargar])
  return (
    <>
      <PageHeader title="Registro asistido" description="Para quien llama o llega en persona." />
      {aviso && <p className="confirmation">{aviso}</p>}
      <div className="form-grid">
        <NuevoSolicitante zonas={zonas} alRegistrar={(nombre) => (setAviso('Registrado: ' + nombre + '.'), cargar())} />
        <NuevaSolicitud solicitantes={habilitados} alRegistrar={(codigo) => setAviso('Solicitud ' + codigo + '.')} />
      </div>
    </>
  )
}

function NuevoSolicitante({ zonas, alRegistrar }: { zonas: Zone[]; alRegistrar: (nombre: string) => void }) {
  const id = useId()
  const submit = useSubmission()
  const [datos, setDatos] = useState(SOLICITANTE)
  const [autoriza, setAutoriza] = useState(false)
  const cambiar = (campo: keyof typeof SOLICITANTE, valor: string) => setDatos({ ...datos, [campo]: valor })
  function registrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submit.run(async () => {
      await api('/directorio/solicitantes', 'POST', { ...datos, autoriza_datos: autoriza })
      alRegistrar(datos.nombre)
      setDatos(SOLICITANTE)
      setAutoriza(false)
    })
  }
  return (
    <form className="card dialog-form" onSubmit={registrar}>
      <h3>Nuevo solicitante</h3>
      <Campo id={id + '-tel'} etiqueta="WhatsApp" valor={datos.telefono} alCambiar={(v) => cambiar('telefono', v)} />
      <Campo id={id + '-nom'} etiqueta="Nombre o alias" valor={datos.nombre} alCambiar={(v) => cambiar('nombre', v)} />
      <Selector etiqueta="Tipo" valor={datos.tipo} alCambiar={(v) => cambiar('tipo', v)}>
        <option value="hogar">Hogar</option>
        <option value="unidad_productiva">Negocio (unidad productiva)</option>
      </Selector>
      <Selector etiqueta="Zona" valor={datos.zona_id} alCambiar={(v) => cambiar('zona_id', v)}>
        <option value="">Selecciona la zona</option>
        {zonas.map((zona) => (
          <option key={zona.id} value={zona.id}>
            {zona.nombre}
          </option>
        ))}
      </Selector>
      <Campo id={id + '-dir'} etiqueta="Dirección" valor={datos.direccion} alCambiar={(v) => cambiar('direccion', v)} />
      <label className="checkbox-field">
        <input type="checkbox" checked={autoriza} onChange={(event) => setAutoriza(event.target.checked)} /> Autoriza el
        uso de sus datos solo para coordinar recolecciones (Ley 1581)
      </label>
      {submit.error && <ErrorMessage message={submit.error} />}
      <button className="button button-primary" type="submit" disabled={submit.busy || !autoriza}>
        Registrar
      </button>
    </form>
  )
}

function NuevaSolicitud({
  solicitantes,
  alRegistrar,
}: {
  solicitantes: Solicitante[]
  alRegistrar: (c: string) => void
}) {
  const id = useId()
  const submit = useSubmission()
  const [datos, setDatos] = useState(SOLICITUD)
  const cambiar = (campo: keyof typeof SOLICITUD, valor: string) => setDatos({ ...datos, [campo]: valor })
  function registrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void submit.run(async () => {
      alRegistrar((await api<{ codigo: string }>('/solicitudes', 'POST', datos)).codigo)
      setDatos(SOLICITUD)
    })
  }
  return (
    <form className="card dialog-form" onSubmit={registrar}>
      <h3>Nueva solicitud</h3>
      <Selector etiqueta="Quién pide" valor={datos.solicitante_id} alCambiar={(v) => cambiar('solicitante_id', v)}>
        <option value="">Selecciona un solicitante habilitado</option>
        {solicitantes.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nombre} · {s.direccion}
          </option>
        ))}
      </Selector>
      <Selector etiqueta="Residuo" valor={datos.flujo} alCambiar={(v) => cambiar('flujo', v)}>
        <option value="organico">Orgánicos (huerteros)</option>
        <option value="reciclable">Reciclables (recicladores)</option>
      </Selector>
      <Selector etiqueta="Horario preferido" valor={datos.preferencia} alCambiar={(v) => cambiar('preferencia', v)}>
        <option value="manana">Mañana</option>
        <option value="tarde">Tarde</option>
        <option value="noche">Noche</option>
      </Selector>
      <Campo
        id={id + '-obs'}
        etiqueta="Observaciones"
        valor={datos.observaciones}
        alCambiar={(v) => cambiar('observaciones', v)}
      />
      {submit.error && <ErrorMessage message={submit.error} />}
      <button className="button button-primary" type="submit" disabled={submit.busy || !datos.solicitante_id}>
        Registrar solicitud
      </button>
    </form>
  )
}

function Campo({
  id,
  etiqueta,
  valor,
  alCambiar,
}: {
  id: string
  etiqueta: string
  valor: string
  alCambiar: (v: string) => void
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{etiqueta}</label>
      <input id={id} value={valor} onChange={(event) => alCambiar(event.target.value)} />
    </div>
  )
}

function Selector({
  etiqueta,
  valor,
  alCambiar,
  children,
}: {
  etiqueta: string
  valor: string
  alCambiar: (v: string) => void
  children: React.ReactNode
}) {
  return (
    <label className="field">
      {etiqueta}
      <div className="select-field">
        <select value={valor} onChange={(event) => alCambiar(event.target.value)}>
          {children}
        </select>
      </div>
    </label>
  )
}
