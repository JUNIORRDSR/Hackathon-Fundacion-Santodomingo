import { rutas as contenidos } from "../modulos/contenidos/rutas";
import { rutas as directorio } from "../modulos/directorio/rutas";
import { rutas as reportes } from "../modulos/reportes/rutas";
import { rutas as solicitudes } from "../modulos/solicitudes/rutas";
import { rutas as whatsapp } from "../modulos/whatsapp/rutas";
import type { RutaDeModulo } from "./tipos";

// El orden es el del menú. Un módulo nuevo se suma aquí y en ningún otro lugar.
export const RUTAS: RutaDeModulo[] = [...solicitudes, ...directorio, ...reportes, ...contenidos, ...whatsapp];
