import type { RutaDeModulo } from "../../host/tipos";
import { Panel } from "./Panel";

export const rutas: RutaDeModulo[] = [{ ruta: "/panel", titulo: "Panel", pantalla: <Panel /> }];
