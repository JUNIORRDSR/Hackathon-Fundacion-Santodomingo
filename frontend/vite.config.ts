import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// En desarrollo, /api va al backend: misma cookie de sesión y sin CORS (ADR-0002).
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:8000" } },
});
