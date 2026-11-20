import type { components } from "./esquema";

// Los tipos salen del OpenAPI del backend: `npm run contrato` los regenera cuando cambia un contrato.
type Esquemas = components["schemas"];
export type Usuario = Esquemas["Usuario"];
export type Solicitud = Esquemas["SolicitudVista"];
export type Encargado = Esquemas["EncargadoVista"];
export type Solicitante = Esquemas["SolicitanteVista"];
export type Zona = Esquemas["ZonaVista"];
export type Contenido = Esquemas["ContenidoVista"];
export type Resumen = Esquemas["Resumen"];
export type MensajeSaliente = Esquemas["MensajeSaliente"];

export class ErrorDeApi extends Error {
  constructor(
    readonly estado: number,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

/** Llama a la API con la cookie de sesión; un error trae el mensaje del dominio para mostrarlo tal cual. */
export async function api<T>(ruta: string, metodo = "GET", cuerpo?: unknown): Promise<T> {
  const respuesta = await fetch(`/api${ruta}`, {
    method: metodo,
    credentials: "same-origin",
    headers: cuerpo === undefined ? undefined : { "Content-Type": "application/json" },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  if (!respuesta.ok) {
    const error = await respuesta.json().catch(() => ({}));
    throw new ErrorDeApi(respuesta.status, mensajeDe(error.detail) ?? respuesta.statusText);
  }
  return (respuesta.status === 204 ? undefined : await respuesta.json()) as T;
}

export function textoDeError(error: unknown): string {
  return error instanceof ErrorDeApi ? error.message : "No se pudo completar. Revisa la conexión.";
}

function mensajeDe(detalle: unknown): string | undefined {
  if (typeof detalle === "string") return detalle;
  if (Array.isArray(detalle)) return detalle.map((d) => d.msg).join(". "); // validación de FastAPI
  return undefined;
}
