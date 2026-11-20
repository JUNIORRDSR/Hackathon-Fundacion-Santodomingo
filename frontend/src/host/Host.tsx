import { Navigate, Route, Routes } from "react-router-dom";
import { Entrar } from "../modulos/acceso/Entrar";
import { Marco } from "./Marco";
import { RUTAS } from "./rutas";
import { ProveedorDeSesion, useSesion } from "./sesion";

export function Host() {
  return (
    <ProveedorDeSesion>
      <Contenido />
    </ProveedorDeSesion>
  );
}

function Contenido() {
  const { usuario, cargando } = useSesion();
  if (cargando) return <p className="p-8 text-xl">Cargando…</p>;
  if (!usuario) return <Entrar />;
  return (
    <Marco>
      <Routes>
        {RUTAS.map((r) => (
          <Route key={r.ruta} path={r.ruta} element={r.pantalla} />
        ))}
        <Route path="*" element={<Navigate to="/bandeja" replace />} />
      </Routes>
    </Marco>
  );
}
