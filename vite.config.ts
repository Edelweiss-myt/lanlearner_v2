import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env variables from .env file based on the mode (development, production)
  // Loads all variables, including those without VITE_ prefix if present.
  const env = loadEnv(mode, (process as any).cwd(), '');

  return {
    plugins: [react()],
    server: {
      port: 3000, // Optional: specify dev server port, default is 5173
    },
    build: {
      outDir: 'dist', // Default output directory
    },
    publicDir: 'public', // Specify the public directory
    optimizeDeps: {
      exclude: ['pdfjs-dist', 'epubjs', 'mammoth']
    },
    define: {
      // This makes process.env.API_KEY available in your client-side code.
      // Vite will replace it with the actual value from your environment (e.g., .env file)
      // The value needs to be stringified.
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    }
  }
})
