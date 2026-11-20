import { useEffect, useState } from "react";
import { api, textoDeError, type Solicitante, type Solicitud, type Zona } from "../../api/cliente";

// Para quien llama o llega en persona: la coordinación registra por la persona (ADR-0003).
export function RegistroAsistido() {
  const [zonas, setZonas] = useState<Zona[]>([]);
  const [habilitados, setHabilitados] = useState<Solicitante[]>([]);
  const [aviso, setAviso] = useState("");
  const cargar = () => api<Solicitante[]>("/directorio/solicitantes?estado=habilitado").then(setHabilitados);
  useEffect(() => {
    api<Zona[]>("/directorio/zonas").then(setZonas);
    cargar();
  }, []);
  return (
    <div className="grid grid-cols-2 gap-4">
      <NuevoSolicitante zonas={zonas} alRegistrar={(s) => (setAviso(`Registrado: ${s.nombre}.`), cargar())} />
      <NuevaSolicitud solicitantes={habilitados} alRegistrar={(s) => setAviso(`Solicitud ${s.codigo} registrada.`)} />
      {aviso && <p className="col-span-2 rounded-lg bg-marca-claro p-3 text-lg">{aviso}</p>}
    </div>
  );
}

function NuevoSolicitante({ zonas, alRegistrar }: { zonas: Zona[]; alRegistrar: (s: Solicitante) => void }) {
  const [datos, setDatos] = useState({ telefono: "+57", nombre: "", tipo: "hogar", zona_id: "", direccion: "" });
  const [autoriza, setAutoriza] = useState(false);
  const [error, setError] = useState("");
  const cambiar = (campo: string, valor: string) => setDatos({ ...datos, [campo]: valor });
  const registrar = async () => {
    setError("");
    try {
      alRegistrar(await api<Solicitante>("/directorio/solicitantes", "POST", { ...datos, autoriza_datos: autoriza }));
    } catch (e) {
      setError(textoDeError(e));
    }
  };
  return (
    <section className="tarjeta flex flex-col gap-3">
      <h1 className="titulo">Nuevo solicitante</h1>
      <Campo etiqueta="Teléfono de WhatsApp" valor={datos.telefono} alCambiar={(v) => cambiar("telefono", v)} />
      <Campo etiqueta="Nombre o alias" valor={datos.nombre} alCambiar={(v) => cambiar("nombre", v)} />
      <select className="campo" value={datos.tipo} onChange={(e) => cambiar("tipo", e.target.value)}>
        <option value="hogar">Hogar</option>
        <option value="unidad_productiva">Negocio (unidad productiva)</option>
      </select>
      <select className="campo" value={datos.zona_id} onChange={(e) => cambiar("zona_id", e.target.value)}>
        <option value="">Zona…</option>
        {zonas.map((z) => (
          <option key={z.id} value={z.id}>
            {z.nombre}
          </option>
        ))}
      </select>
      <Campo etiqueta="Dirección" valor={datos.direccion} alCambiar={(v) => cambiar("direccion", v)} />
      <label className="flex min-h-12 items-center gap-3 text-lg">
        <input type="checkbox" className="h-6 w-6" checked={autoriza} onChange={(e) => setAutoriza(e.target.checked)} />
        Autoriza el uso de sus datos solo para coordinar recolecciones
      </label>
      {error && <p className="text-lg text-red-700">{error}</p>}
      <button className="boton-principal" disabled={!autoriza} onClick={registrar}>
        Registrar
      </button>
    </section>
  );
}

const SOLICITUD_VACIA = { solicitante_id: "", flujo: "organico", preferencia: "manana", observaciones: "" };

interface PropsDeSolicitud {
  solicitantes: Solicitante[];
  alRegistrar: (s: Solicitud) => void;
}

function NuevaSolicitud({ solicitantes, alRegistrar }: PropsDeSolicitud) {
  const [datos, setDatos] = useState(SOLICITUD_VACIA);
  const [error, setError] = useState("");
  const cambiar = (campo: string, valor: string) => setDatos({ ...datos, [campo]: valor });
  const registrar = async () => {
    setError("");
    try {
      alRegistrar(await api<Solicitud>("/solicitudes", "POST", datos));
    } catch (e) {
      setError(textoDeError(e));
    }
  };
  return (
    <section className="tarjeta flex flex-col gap-3">
      <h1 className="titulo">Nueva solicitud</h1>
      <select
        className="campo"
        value={datos.solicitante_id}
        onChange={(e) => cambiar("solicitante_id", e.target.value)}
      >
        <option value="">¿Quién pide?</option>
        {solicitantes.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nombre} · {s.direccion}
          </option>
        ))}
      </select>
      <select className="campo" value={datos.flujo} onChange={(e) => cambiar("flujo", e.target.value)}>
        <option value="organico">Orgánicos (huerteros)</option>
        <option value="reciclable">Reciclables (recicladores)</option>
      </select>
      <select className="campo" value={datos.preferencia} onChange={(e) => cambiar("preferencia", e.target.value)}>
        <option value="manana">Mañana</option>
        <option value="tarde">Tarde</option>
        <option value="noche">Noche</option>
      </select>
      <Campo etiqueta="Observaciones" valor={datos.observaciones} alCambiar={(v) => cambiar("observaciones", v)} />
      {error && <p className="text-lg text-red-700">{error}</p>}
      <button className="boton-principal" disabled={!datos.solicitante_id} onClick={registrar}>
        Registrar solicitud
      </button>
    </section>
  );
}

function Campo({ etiqueta, valor, alCambiar }: { etiqueta: string; valor: string; alCambiar: (v: string) => void }) {
  return (
    <label>
      <span className="etiqueta">{etiqueta}</span>
      <input className="campo" value={valor} onChange={(e) => alCambiar(e.target.value)} />
    </label>
  );
}
