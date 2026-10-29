import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The marketing site (www.<domain>): one HTML file per page, so any static host serves /docs/, /pricing/ and
// /community/ as they are. It only links into the workspace app (cloud.<domain>); see README.md.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        home: path.resolve(__dirname, 'index.html'),
        docs: path.resolve(__dirname, 'docs/index.html'),
        pricing: path.resolve(__dirname, 'pricing/index.html'),
        community: path.resolve(__dirname, 'community/index.html'),
      },
    },
  },
})
