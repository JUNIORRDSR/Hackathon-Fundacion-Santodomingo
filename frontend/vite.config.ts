import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// En desarrollo, /api va al backend: misma cookie de sesión y sin CORS (ADR-0002).
export default defineConfig({
  base: './',
  css: { postcss: { plugins: [] } },
  plugins: [tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { proxy: { '/api': 'http://localhost:8000' } },
})
