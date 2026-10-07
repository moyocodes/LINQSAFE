import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(import.meta.dirname, 'src') } },
  server: {
    proxy: { '/api': 'http://localhost:3001' },
    // admin.localhost:5173 serves the founder view locally (browsers resolve *.localhost to this machine).
    allowedHosts: ['.localhost'],
  },
  build: {
    // three.js only loads for the homepage 3D section, in its own lazy chunk.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Split rarely-changing libraries into their own long-cached files.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          motion: ['framer-motion'],
          gsap: ['gsap'],
        },
      },
    },
  },
})
