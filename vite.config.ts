import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000, // Optional: specify dev server port, default is 5173
  },
  build: {
    outDir: 'dist', // Default output directory
  },
  publicDir: 'public' // Specify the public directory
})