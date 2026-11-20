import type { RutaDeModulo } from "../../host/tipos";
import { Bandeja } from "./Bandeja";
import { RegistroAsistido } from "./RegistroAsistido";

export const rutas: RutaDeModulo[] = [
  { ruta: "/bandeja", titulo: "Bandeja", pantalla: <Bandeja /> },
  { ruta: "/bandeja/:id", titulo: "Bandeja", pantalla: <Bandeja />, enMenu: false },
  { ruta: "/registro-asistido", titulo: "Registro asistido", pantalla: <RegistroAsistido /> },
];
