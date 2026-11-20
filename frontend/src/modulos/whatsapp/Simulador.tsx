import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, textoDeError, type MensajeSaliente } from "../../api/cliente";

// Plan B de la demo: el mismo camino que un mensaje real de WhatsApp, sin Twilio (ADR-0003).
const REFRESCO_MS = 3_000;

export function Simulador() {
  const [telefono, setTelefono] = useState("+573000000009");
  const [texto, setTexto] = useState("");
  const [mensajes, setMensajes] = useState<MensajeSaliente[]>([]);
  const [error, setError] = useState("");
  const cargar = useCallback(() => {
    api<MensajeSaliente[]>(`/whatsapp/simulador/mensajes?telefono=${encodeURIComponent(telefono)}`).then(setMensajes);
  }, [telefono]);
  useEffect(() => {
    cargar();
    const intervalo = setInterval(cargar, REFRESCO_MS);
    return () => clearInterval(intervalo);
  }, [cargar]);
  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    setError("");
    try {
      await api("/whatsapp/simulador", "POST", { telefono, texto });
      setTexto("");
      cargar();
    } catch (e) {
      setError(textoDeError(e));
    }
  };
  return (
    <section className="mx-auto flex h-full max-w-xl flex-col gap-3">
      <input className="campo" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
      <ol className="tarjeta flex min-h-0 flex-1 flex-col gap-2 overflow-auto bg-marca-claro">
        {mensajes.map((m, i) => (
          <li key={i} className="whitespace-pre-line rounded-lg bg-white p-3 text-lg shadow">
            {m.texto}
          </li>
        ))}
      </ol>
      {error && <p className="text-lg text-red-700">{error}</p>}
      <form onSubmit={enviar} className="flex gap-2">
        <input
          className="campo"
          placeholder="Escribe como el vecino"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <button className="boton-principal shrink-0" disabled={!texto}>
          Enviar
        </button>
      </form>
    </section>
  );
}
