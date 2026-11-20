import type { ReactNode } from "react";
import { NavLink } from "react-router-dom";
import { RUTAS } from "./rutas";
import { useSesion } from "./sesion";

export function Marco({ children }: { children: ReactNode }) {
  const { usuario, salir } = useSesion();
  return (
    <div className="flex h-screen flex-col">
      <header className="flex flex-wrap items-center gap-2 bg-marca px-4 py-2 text-white">
        <strong className="mr-4 text-xl">EcoConecta</strong>
        {RUTAS.filter((r) => r.enMenu !== false).map((r) => (
          <NavLink key={r.ruta} to={r.ruta} className={({ isActive }) => claseDelMenu(isActive)}>
            {r.titulo}
          </NavLink>
        ))}
        <span className="ml-auto text-base">{usuario?.nombre}</span>
        <button className="boton border-2 border-white" onClick={salir}>
          Salir
        </button>
      </header>
      <main className="min-h-0 flex-1 overflow-auto p-4">{children}</main>
    </div>
  );
}

function claseDelMenu(activo: boolean): string {
  return `boton flex items-center ${activo ? "bg-white text-marca" : "text-white"}`;
}
