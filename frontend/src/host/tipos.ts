import type { ReactElement } from "react";

/** Cada módulo exporta sus rutas con esta forma y el host las monta en el menú. */
export interface RutaDeModulo {
  ruta: string;
  titulo: string;
  pantalla: ReactElement;
  enMenu?: boolean;
}
