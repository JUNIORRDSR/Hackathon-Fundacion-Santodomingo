import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, type Usuario } from "../api/cliente";

interface Sesion {
  usuario: Usuario | null;
  cargando: boolean;
  entrar: (usuario: string, clave: string) => Promise<void>;
  salir: () => Promise<void>;
}

const Contexto = createContext<Sesion | null>(null);

export function ProveedorDeSesion({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);
  useEffect(() => {
    api<Usuario>("/acceso/yo")
      .then(setUsuario)
      .catch(() => setUsuario(null))
      .finally(() => setCargando(false));
  }, []);
  const entrar = async (nombre: string, clave: string) => {
    setUsuario(await api<Usuario>("/acceso/entrar", "POST", { usuario: nombre, clave }));
  };
  const salir = async () => {
    await api("/acceso/salir", "POST");
    setUsuario(null);
  };
  return <Contexto.Provider value={{ usuario, cargando, entrar, salir }}>{children}</Contexto.Provider>;
}

export function useSesion(): Sesion {
  const sesion = useContext(Contexto);
  if (!sesion) throw new Error("useSesion va dentro de ProveedorDeSesion");
  return sesion;
}
