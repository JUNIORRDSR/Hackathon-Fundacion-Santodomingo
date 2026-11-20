// Clasificación de residuos por foto. Contrato y reglas de uso:
// docs/contratos/clasificacion-residuos.md

export const FLUJOS = ["organico", "aprovechable"] as const;
export type Flujo = (typeof FLUJOS)[number];

// "no_concluyente": foto borrosa, bolsa cerrada, no son residuos o error técnico.
export const VEREDICTOS = ["bien_separado", "mal_separado", "no_concluyente"] as const;
export type Veredicto = (typeof VEREDICTOS)[number];

/** Códigos compartidos con el módulo de capacitación: un recurso por código. */
export const PROBLEMAS = [
  "organico_en_aprovechables",
  "aprovechable_en_organicos",
  "no_aprovechable_mezclado", // papel higiénico, servilletas usadas, pañales
  "envases_sucios", // con restos de comida o líquido
  "residuo_peligroso", // vidrio roto, pilas, medicamentos, jeringas
  "foto_no_valida", // borrosa, oscura, bolsa cerrada o no son residuos
] as const;
export type Problema = (typeof PROBLEMAS)[number];

export interface EvaluacionSeparacion {
  veredicto: Veredicto;
  /** null = mezclado o no se distingue. */
  flujoDetectado: Flujo | null;
  /** Vacío si está bien separado. */
  problemas: Problema[];
  /** Máximo 300 caracteres, en español sencillo, listo para enviar por WhatsApp. */
  mensajeUsuario: string;
  /** Qué modelo evaluó (lo pide el §9 del reto). */
  modelo: string;
  /** Solo si no se pudo evaluar. */
  error: string | null;
}

/** El bot la consulta antes de evaluar: si es false, se salta el paso. */
export const clasificacionActiva = (): boolean => process.env.CLASIFICACION_ACTIVA === "true";

/**
 * Dice si los residuos de la foto están bien separados. Es orientativo: nunca bloquea la solicitud.
 * Nunca rechaza la promesa: ante cualquier falla devuelve "no_concluyente" con `error`.
 *
 * @param imagen   la imagen descargada de WhatsApp
 * @param mimeType "image/jpeg" o "image/png"; otro formato devuelve "no_concluyente"
 * @param flujo    lo que el usuario dijo que va a entregar; null si aún no lo ha dicho
 */
export const evaluarSeparacion: (
  imagen: Uint8Array,
  mimeType: string,
  flujo: Flujo | null,
) => Promise<EvaluacionSeparacion> = async () => ({
  // Provisional hasta el PR 2: permite conectar el bot sin depender de Azure.
  veredicto: "no_concluyente",
  flujoDetectado: null,
  problemas: [],
  mensajeUsuario: "",
  modelo: "ninguno",
  error: "no_implementado",
});
