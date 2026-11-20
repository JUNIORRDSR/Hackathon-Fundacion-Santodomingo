import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, textoDeError, type Solicitud } from "../../api/cliente";

// Al pesar en la huerta o el acopio: la persona escribió el código de la solicitud en la bolsa.
export function BuscarPorCodigo() {
  const navegar = useNavigate();
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");
  const buscar = async (evento: FormEvent) => {
    evento.preventDefault();
    setError("");
    try {
      const solicitud = await api<Solicitud>(`/solicitudes/codigo/${encodeURIComponent(codigo.trim())}`);
      setCodigo("");
      navegar(`/bandeja/${solicitud.id}`);
    } catch (e) {
      setError(textoDeError(e));
    }
  };
  return (
    <form onSubmit={buscar} className="flex flex-col gap-1">
      <div className="flex gap-2">
        <input
          className="campo uppercase"
          placeholder="Código de la bolsa, por ejemplo ORG-0042"
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
        />
        <button className="boton-principal shrink-0" disabled={!codigo.trim()}>
          Buscar
        </button>
      </div>
      {error && <p className="text-lg text-red-700">{error}</p>}
    </form>
  );
}
