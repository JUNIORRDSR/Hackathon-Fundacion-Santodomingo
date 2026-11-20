export const ESTADOS = ["recibida", "asignada", "programada", "recolectada", "rechazada", "cancelada"] as const;

export const NOMBRE_ESTADO: Record<string, string> = {
  recibida: "Nuevas",
  asignada: "Asignadas",
  programada: "Programadas",
  recolectada: "Recolectadas",
  rechazada: "Rechazadas",
  cancelada: "Canceladas",
};

export const NOMBRE_FRANJA: Record<string, string> = { manana: "mañana", tarde: "tarde", noche: "noche" };

export const ABIERTOS = ["recibida", "asignada", "programada"];
