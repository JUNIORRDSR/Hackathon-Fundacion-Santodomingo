import { useEffect, useState } from "react";
import { api, type Solicitante } from "../../api/cliente";

// RN-08: quien se registró solo por WhatsApp entra al piloto cuando la coordinación lo habilita.
export function PorHabilitar() {
  const [pendientes, setPendientes] = useState<Solicitante[]>([]);
  const cargar = () => api<Solicitante[]>("/directorio/solicitantes?estado=pendiente").then(setPendientes);
  useEffect(() => {
    cargar();
  }, []);
  const habilitar = async (id: string) => {
    await api(`/directorio/solicitantes/${id}/habilitacion`, "POST");
    cargar();
  };
  return (
    <section className="max-w-3xl">
      <h1 className="titulo">Solicitantes por habilitar</h1>
      {pendientes.length === 0 && <p className="text-lg text-gray-500">No hay registros pendientes.</p>}
      <ul className="flex flex-col gap-2">
        {pendientes.map((s) => (
          <li key={s.id} className="tarjeta flex items-center gap-4">
            <div className="flex-1 text-lg">
              <p className="font-semibold">
                {s.nombre} · {s.tipo === "hogar" ? "Hogar" : "Negocio"}
              </p>
              <p className="text-gray-600">
                {s.direccion} · {s.telefono}
              </p>
            </div>
            <button className="boton-principal" onClick={() => habilitar(s.id)}>
              Habilitar
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
