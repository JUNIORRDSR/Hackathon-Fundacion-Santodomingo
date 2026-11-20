import { useEffect, useState } from "react";
import { api, type Contenido } from "../../api/cliente";

// Tutoriales de la coordinación y material para mostrar a huerteros y recicladores: video o imagen, sin texto.
export function Ayuda() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Seccion titulo="Para la coordinación" audiencia="coordinador" />
      <Seccion titulo="Para mostrar a los encargados" audiencia="encargado" />
    </div>
  );
}

function Seccion({ titulo, audiencia }: { titulo: string; audiencia: string }) {
  const [piezas, setPiezas] = useState<Contenido[]>([]);
  useEffect(() => {
    api<Contenido[]>(`/contenidos?audiencia=${audiencia}`).then(setPiezas);
  }, [audiencia]);
  return (
    <section className="flex flex-col gap-3">
      <h1 className="titulo">{titulo}</h1>
      {piezas.length === 0 && <p className="text-lg text-gray-500">Todavía no hay material.</p>}
      {piezas.map((pieza) => (
        <article key={pieza.id} className="tarjeta flex flex-col gap-2">
          <h2 className="text-xl font-semibold">{pieza.titulo}</h2>
          <p className="text-lg">{pieza.texto_corto}</p>
          {pieza.url && (
            <a className="boton-secundario flex w-fit items-center" href={pieza.url} target="_blank" rel="noreferrer">
              Ver {pieza.formato}
            </a>
          )}
        </article>
      ))}
    </section>
  );
}
