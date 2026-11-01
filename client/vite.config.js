import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  // The client calls the API at VITE_API_URL. Unset means: localhost:3001 in development,
  // and in production builds a same-origin "/api" (the Docker image serves both together).
  const apiUrl = env.VITE_API_URL ?? (mode === 'development' ? 'http://localhost:3001' : '/api')
  return {
    plugins: [react()],
    define: { 'import.meta.env.VITE_API_URL': JSON.stringify(apiUrl) },
  }
})
