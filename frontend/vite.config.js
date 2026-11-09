import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Port occupé = erreur explicite (au lieu de passer en silence sur 5174
    // et de parler à un ancien backend)
    strictPort: true,
    // Proxy pour rediriger les appels /api vers le backend Express (port 5000)
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
})
