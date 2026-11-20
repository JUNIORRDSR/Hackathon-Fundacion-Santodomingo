import { useEffect, useState } from "react";
import { api, type Solicitud } from "../../api/cliente";
import { Acciones } from "./Acciones";
import { NOMBRE_FRANJA } from "./textos";

export function Detalle({ id, alCambiar }: { id: string; alCambiar: () => void }) {
  const [solicitud, setSolicitud] = useState<Solicitud | null>(null);
  useEffect(() => {
    api<Solicitud>(`/solicitudes/${id}`).then(setSolicitud);
  }, [id]);
  if (!solicitud) return <p className="p-4 text-lg">Cargando…</p>;
  const actualizar = (nueva: Solicitud) => {
    setSolicitud(nueva);
    alCambiar();
  };
  return (
    <article className="tarjeta flex flex-col gap-4">
      <header className="flex flex-col gap-1 text-lg">
        <h1 className="text-2xl font-bold">
          {solicitud.codigo} · <span className="uppercase text-marca">{solicitud.estado}</span>
        </h1>
        <p>
          {solicitud.solicitante_nombre} · {solicitud.telefono}
        </p>
        <p>
          {solicitud.direccion} · prefiere la {NOMBRE_FRANJA[solicitud.preferencia]}
        </p>
        {solicitud.observaciones && <p className="text-gray-600">{solicitud.observaciones}</p>}
        {solicitud.dia && (
          <p className="font-semibold">
            Programada: {solicitud.dia} a las {solicitud.hora?.slice(0, 5)}
          </p>
        )}
      </header>
      <Acciones solicitud={solicitud} alCambiar={actualizar} />
      <ol className="border-t pt-2 text-gray-600">
        {solicitud.historial.map((cambio, i) => (
          <li key={i}>
            {new Date(cambio.fecha).toLocaleString("es-CO")} · {cambio.estado} {cambio.nota && `· ${cambio.nota}`}
          </li>
        ))}
      </ol>
    </article>
  );
}
