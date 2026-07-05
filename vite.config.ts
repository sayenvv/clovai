import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('framer-motion')) return 'vendor-motion'
          // The full lucide icon map enables arbitrary icon names in JSON
          // config; isolate it so it caches independently of app code.
          if (id.includes('lucide-react')) return 'vendor-icons'
          if (id.includes('@tanstack') || id.includes('zod')) return 'vendor-query'
          if (id.includes('react-router') || id.includes('react-dom') || id.includes('/react/')) {
            return 'vendor-react'
          }
        },
      },
    },
  },
})
