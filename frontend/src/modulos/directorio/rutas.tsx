import type { RutaDeModulo } from "../../host/tipos";
import { PorHabilitar } from "./PorHabilitar";

export const rutas: RutaDeModulo[] = [{ ruta: "/por-habilitar", titulo: "Por habilitar", pantalla: <PorHabilitar /> }];
