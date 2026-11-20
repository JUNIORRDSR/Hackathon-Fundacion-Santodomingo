import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, type Solicitud } from "../../api/cliente";
import { BuscarPorCodigo } from "./BuscarPorCodigo";
import { Detalle } from "./Detalle";
import { ESTADOS, NOMBRE_ESTADO, NOMBRE_FRANJA } from "./textos";

// La bandeja se refresca sola: una solicitud nueva aparece sin que la coordinación toque nada.
const REFRESCO_MS = 10_000;

export function Bandeja() {
  const { id } = useParams();
  const [estado, setEstado] = useState<string>("recibida");
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([]);
  const cargar = useCallback(() => {
    api<Solicitud[]>(`/solicitudes?estado=${estado}`).then(setSolicitudes);
  }, [estado]);
  useEffect(() => {
    cargar();
    const intervalo = setInterval(cargar, REFRESCO_MS);
    return () => clearInterval(intervalo);
  }, [cargar]);
  return (
    <div className="grid h-full grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4">
      <section className="flex min-h-0 flex-col gap-3">
        <BuscarPorCodigo />
        <div className="flex flex-wrap gap-2">
          {ESTADOS.map((e) => (
            <button
              key={e}
              className={e === estado ? "boton-principal" : "boton-secundario"}
              onClick={() => setEstado(e)}
            >
              {NOMBRE_ESTADO[e]}
            </button>
          ))}
        </div>
        <Lista solicitudes={solicitudes} seleccionada={id} />
      </section>
      <section className="min-h-0 overflow-auto">
        {id ? <Detalle id={id} alCambiar={cargar} /> : <p className="p-4 text-lg text-gray-500">Toca una solicitud.</p>}
      </section>
    </div>
  );
}

function Lista({ solicitudes, seleccionada }: { solicitudes: Solicitud[]; seleccionada?: string }) {
  const navegar = useNavigate();
  if (solicitudes.length === 0) return <p className="tarjeta text-lg text-gray-500">No hay solicitudes aquí.</p>;
  return (
    <ul className="min-h-0 flex-1 overflow-auto rounded-lg bg-white shadow">
      {solicitudes.map((s) => (
        <li key={s.id}>
          <button
            className={`flex min-h-16 w-full flex-col items-start border-b px-4 py-2 text-left ${
              s.id === seleccionada ? "bg-marca-claro" : ""
            }`}
            onClick={() => navegar(`/bandeja/${s.id}`)}
          >
            <span className="text-lg font-semibold">
              {s.codigo} · {s.solicitante_nombre}
            </span>
            <span className="text-gray-600">
              {s.direccion} · prefiere la {NOMBRE_FRANJA[s.preferencia]}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
