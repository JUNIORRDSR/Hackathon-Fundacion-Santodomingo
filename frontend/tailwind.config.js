/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Provisional: Daniela los cambia por los del manual de identidad de EcoConecta.
      colors: { marca: { DEFAULT: "#2e7d32", oscuro: "#1b5e20", claro: "#e8f5e9" } },
    },
  },
  plugins: [],
};
