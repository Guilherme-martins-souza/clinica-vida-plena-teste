import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // escuta em 0.0.0.0, necessário dentro do container
    port: 5173,
    proxy: {
      // Fora do Docker a API está em localhost; dentro, no serviço "backend" do compose.
      '/api': process.env.API_PROXY_TARGET ?? 'http://localhost:3000',
    },
  },
})
