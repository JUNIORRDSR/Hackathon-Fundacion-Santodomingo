import type { RutaDeModulo } from "../../host/tipos";
import { Ayuda } from "./Ayuda";

export const rutas: RutaDeModulo[] = [{ ruta: "/ayuda", titulo: "Ayuda", pantalla: <Ayuda /> }];
