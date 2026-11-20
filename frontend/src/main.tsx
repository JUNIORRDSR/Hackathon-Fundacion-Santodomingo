import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Host } from "./host/Host";
import "./estilos.css";

createRoot(document.getElementById("raiz")!).render(
  <StrictMode>
    <BrowserRouter>
      <Host />
    </BrowserRouter>
  </StrictMode>,
);

// PWA: la tablet la instala a pantalla completa y guarda el armazón por si se cae el internet.
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");
