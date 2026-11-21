import { useEffect, useRef, useState } from 'react'

export type EstadoCamara = 'iniciando' | 'lista' | 'sin-camara' | 'denegada'

const CADA_MS = 180 // ~5 lecturas por segundo: fluido en una tablet sin calentarla
const ANCHO = 640 // jsQR trabaja sobre una copia reducida del cuadro

// La cámara trasera queda encendida mientras la pantalla esté abierta, así no se pide permiso en cada bolsa;
// solo se decodifica cuando `leyendo` es verdadero. jsQR se carga aquí y no pesa en el resto de la tablet (ADR-0015).
export function useCamaraQr(leyendo: boolean, onLectura: (texto: string) => void) {
  const video = useRef<HTMLVideoElement>(null)
  const [estado, setEstado] = useState<EstadoCamara>('iniciando')
  const activo = useRef(leyendo)
  const aviso = useRef(onLectura)
  useEffect(() => {
    activo.current = leyendo
    aviso.current = onLectura
  })

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setEstado('sin-camara')
      return
    }
    let cancelado = false
    let pausa = 0
    let flujo: MediaStream | undefined
    const lienzo = document.createElement('canvas')
    const contexto = lienzo.getContext('2d', { willReadFrequently: true })

    async function encender() {
      const [camara, { default: jsQR }] = await Promise.all([
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false }),
        import('jsqr'),
      ])
      flujo = camara
      if (cancelado) return camara.getTracks().forEach((pista) => pista.stop())
      const elemento = video.current
      if (!elemento || !contexto) return
      elemento.srcObject = camara
      await elemento.play()
      setEstado('lista')
      const leer = () => {
        if (cancelado) return
        if (activo.current && elemento.videoWidth) {
          const escala = Math.min(1, ANCHO / elemento.videoWidth)
          lienzo.width = Math.round(elemento.videoWidth * escala)
          lienzo.height = Math.round(elemento.videoHeight * escala)
          contexto.drawImage(elemento, 0, 0, lienzo.width, lienzo.height)
          const cuadro = contexto.getImageData(0, 0, lienzo.width, lienzo.height)
          const codigo = jsQR(cuadro.data, cuadro.width, cuadro.height, { inversionAttempts: 'dontInvert' })
          if (codigo?.data) aviso.current(codigo.data)
        }
        pausa = window.setTimeout(leer, CADA_MS)
      }
      leer()
    }

    encender().catch((error: unknown) => {
      if (cancelado) return
      setEstado(error instanceof DOMException && error.name === 'NotAllowedError' ? 'denegada' : 'sin-camara')
    })
    return () => {
      cancelado = true
      window.clearTimeout(pausa)
      flujo?.getTracks().forEach((pista) => pista.stop())
    }
  }, [])

  return { video, estado }
}
