import { useEffect, useState } from "react";
import { api, textoDeError, type Encargado, type Solicitud } from "../../api/cliente";
import { ABIERTOS } from "./textos";

type Ejecutar = (accion: () => Promise<Solicitud>) => Promise<void>;

export function Acciones({ solicitud, alCambiar }: { solicitud: Solicitud; alCambiar: (s: Solicitud) => void }) {
  const [error, setError] = useState("");
  const ejecutar: Ejecutar = async (accion) => {
    setError("");
    try {
      alCambiar(await accion());
    } catch (e) {
      setError(textoDeError(e));
    }
  };
  const ruta = `/solicitudes/${solicitud.id}`;
  const abierta = ABIERTOS.includes(solicitud.estado);
  return (
    <div className="flex flex-col gap-4">
      {abierta && <Programar solicitud={solicitud} ejecutar={ejecutar} />}
      {solicitud.estado === "programada" && <Resultado ruta={ruta} ejecutar={ejecutar} />}
      {abierta && <ConMotivo titulo="Cancelar" ruta={`${ruta}/cancelacion`} ejecutar={ejecutar} />}
      {error && <p className="rounded-lg bg-red-100 p-3 text-lg text-red-800">{error}</p>}
    </div>
  );
}

function Programar({ solicitud, ejecutar }: { solicitud: Solicitud; ejecutar: Ejecutar }) {
  const ruta = `/solicitudes/${solicitud.id}`;
  const [encargados, setEncargados] = useState<Encargado[]>([]);
  const [encargado, setEncargado] = useState(solicitud.encargado_id ?? "");
  const [dia, setDia] = useState(solicitud.dia ?? "");
  const [hora, setHora] = useState(solicitud.hora?.slice(0, 5) ?? "");
  useEffect(() => {
    api<Encargado[]>(`${ruta}/sugerencias`).then((lista) => {
      setEncargados(lista);
      setEncargado((actual) => actual || lista[0]?.id || "");
    });
  }, [ruta]);
  const guardar = () =>
    ejecutar(async () => {
      await api(`${ruta}/asignacion`, "POST", { encargado_id: encargado });
      return api<Solicitud>(`${ruta}/programacion`, "POST", { dia, hora });
    });
  return (
    <fieldset className="grid grid-cols-3 gap-3 rounded-lg border-2 p-3">
      <legend className="px-2 text-lg font-semibold">Asignar y programar</legend>
      <label>
        <span className="etiqueta">Quién va (primero, los de la zona)</span>
        <select className="campo" value={encargado} onChange={(e) => setEncargado(e.target.value)}>
          {encargados.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nombre}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="etiqueta">Día</span>
        <input className="campo" type="date" value={dia} onChange={(e) => setDia(e.target.value)} />
      </label>
      <label>
        <span className="etiqueta">Hora</span>
        <input className="campo" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
      </label>
      <button className="boton-principal col-span-3" disabled={!encargado || !dia || !hora} onClick={guardar}>
        Asignar y programar
      </button>
    </fieldset>
  );
}

function Resultado({ ruta, ejecutar }: { ruta: string; ejecutar: Ejecutar }) {
  const [kg, setKg] = useState("");
  const recogida = () => ejecutar(() => api<Solicitud>(`${ruta}/recoleccion`, "POST", { kg: kg || null }));
  return (
    <fieldset className="flex flex-col gap-3 rounded-lg border-2 p-3">
      <legend className="px-2 text-lg font-semibold">Resultado de la recolección</legend>
      <label>
        <span className="etiqueta">Kilos, si se pesó</span>
        <input
          className="campo"
          inputMode="decimal"
          value={kg}
          onChange={(e) => setKg(e.target.value.replace(",", "."))}
        />
      </label>
      <button className="boton-principal" onClick={recogida}>
        Se recogió
      </button>
      <ConMotivo titulo="Rechazar: mal separada" ruta={`${ruta}/rechazo`} ejecutar={ejecutar} />
    </fieldset>
  );
}

function ConMotivo({ titulo, ruta, ejecutar }: { titulo: string; ruta: string; ejecutar: Ejecutar }) {
  const [motivo, setMotivo] = useState("");
  const enviar = () => ejecutar(() => api<Solicitud>(ruta, "POST", { motivo }));
  return (
    <div className="flex gap-2">
      <input className="campo" placeholder="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      <button className="boton-secundario shrink-0" disabled={motivo.trim().length < 3} onClick={enviar}>
        {titulo}
      </button>
    </div>
  );
}
