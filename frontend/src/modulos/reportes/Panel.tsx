import { useEffect, useState } from "react";
import { api, type Resumen } from "../../api/cliente";

// Resumen por flujo, estado y periodo (§5.6); por defecto, los últimos 30 días.
export function Panel() {
  const [resumen, setResumen] = useState<Resumen | null>(null);
  useEffect(() => {
    api<Resumen>("/reportes/resumen").then(setResumen);
  }, []);
  if (!resumen) return <p className="p-4 text-lg">Cargando…</p>;
  return (
    <section className="flex max-w-4xl flex-col gap-4">
      <h1 className="titulo">
        Panel del {resumen.desde} al {resumen.hasta}
      </h1>
      <div className="grid grid-cols-2 gap-4">
        <Indicador titulo="Solicitudes" valor={String(resumen.total_solicitudes)} />
        <Indicador titulo="Kilos recolectados" valor={String(resumen.total_kg)} />
      </div>
      <table className="tarjeta w-full text-left text-lg">
        <thead>
          <tr>
            <th>Flujo</th>
            <th>Estado</th>
            <th>Solicitudes</th>
            <th>Kilos</th>
          </tr>
        </thead>
        <tbody>
          {resumen.filas.map((fila) => (
            <tr key={`${fila.flujo}-${fila.estado}`} className="border-t">
              <td>{fila.flujo}</td>
              <td>{fila.estado}</td>
              <td>{fila.cantidad}</td>
              <td>{fila.kg}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <a className="boton-secundario flex w-fit items-center" href="/api/reportes/solicitudes.csv">
        Descargar CSV (sin datos personales)
      </a>
    </section>
  );
}

function Indicador({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="tarjeta">
      <p className="text-gray-600">{titulo}</p>
      <p className="text-4xl font-bold text-marca">{valor}</p>
    </div>
  );
}
