import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const BACKEND_HOST = process.env.VITE_API_HOST || 'localhost'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: true,       // bind to 0.0.0.0 so phone can reach the dev server
    port: 5173,
    proxy: {
      // Proxy /api → backend in browser-based dev (Capacitor bypasses this)
      '/api': {
        target: `http://${BACKEND_HOST}:8000`,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    // Increase chunk size warning threshold for Google Maps bundle
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-maps': ['@react-google-maps/api'],
          'vendor-charts': ['recharts'],
        },
      },
    },
  },
})
