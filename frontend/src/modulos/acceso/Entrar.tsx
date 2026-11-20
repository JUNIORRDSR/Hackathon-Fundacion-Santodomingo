import { useState, type FormEvent } from "react";
import { textoDeError } from "../../api/cliente";
import { useSesion } from "../../host/sesion";

export function Entrar() {
  const { entrar } = useSesion();
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const enviar = async (evento: FormEvent) => {
    evento.preventDefault();
    setError("");
    try {
      await entrar(usuario, clave);
    } catch (e) {
      setError(textoDeError(e));
    }
  };
  return (
    <main className="flex min-h-screen items-center justify-center bg-marca-claro p-4">
      <form onSubmit={enviar} className="tarjeta flex w-full max-w-md flex-col gap-4">
        <h1 className="text-3xl font-bold text-marca">EcoConecta</h1>
        <label>
          <span className="etiqueta">Usuario</span>
          <input
            className="campo"
            autoComplete="username"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
          />
        </label>
        <label>
          <span className="etiqueta">Clave</span>
          <input
            className="campo"
            type="password"
            autoComplete="current-password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
          />
        </label>
        {error && <p className="text-lg text-red-700">{error}</p>}
        <button className="boton-principal" disabled={!usuario || !clave}>
          Entrar
        </button>
      </form>
    </main>
  );
}
