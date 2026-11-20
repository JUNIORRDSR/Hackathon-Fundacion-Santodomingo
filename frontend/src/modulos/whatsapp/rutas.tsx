import type { RutaDeModulo } from "../../host/tipos";
import { Simulador } from "./Simulador";

export const rutas: RutaDeModulo[] = [{ ruta: "/simulador", titulo: "Simulador WhatsApp", pantalla: <Simulador /> }];
