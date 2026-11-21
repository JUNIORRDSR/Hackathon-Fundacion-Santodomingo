// Llamadas a la API del backend con la cookie de sesión; el error trae el mensaje del dominio para mostrarlo tal cual.
export class ErrorDeApi extends Error {
  readonly estado: number

  constructor(estado: number, mensaje: string) {
    super(mensaje)
    this.estado = estado
  }
}

export async function api<T>(ruta: string, metodo = 'GET', cuerpo?: unknown, signal?: AbortSignal): Promise<T> {
  let respuesta: Response
  try {
    respuesta = await fetch('/api' + ruta, {
      method: metodo,
      credentials: 'same-origin',
      signal,
      headers: cuerpo === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new ErrorDeApi(0, 'No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.')
  }
  if (!respuesta.ok) throw new ErrorDeApi(respuesta.status, await mensajeDe(respuesta))
  return (respuesta.status === 204 ? undefined : await respuesta.json()) as T
}

// La foto o el audio de un vecino: Twilio pide la credencial, así que la tablet lo ve a través del backend (ADR-0014).
// Los carteles (ADR-0016) se piden a esta misma app: su URL pública (ngrok) le muestra al navegador una advertencia
// en lugar de la imagen. Los adjuntos del vecino se traen de Twilio con la credencial.
export const urlDeAdjunto = (url: string) => {
  if (url.startsWith('data:')) return url
  const cartel = url.indexOf('/api/whatsapp/carteles/')
  return cartel >= 0 ? url.slice(cartel) : '/api/whatsapp/adjunto?url=' + encodeURIComponent(url)
}

async function mensajeDe(respuesta: Response): Promise<string> {
  if (respuesta.status === 401) return 'Tu sesión terminó. Vuelve a entrar.'
  const { detail } = await respuesta.json().catch(() => ({ detail: undefined }))
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map((item: { msg: string }) => item.msg).join('. ')
  return 'No se pudo completar la operación. Inténtalo de nuevo.'
}
