import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy all /api requests to the Flask p.py backend
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
      },
      // Proxy ANPR crop images served by p.py
      '/anpr': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
      },
      // Proxy logo files served by p.py
      '/logos': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
})

