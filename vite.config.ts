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
      proxy: {
        // Proxy requests from /.netlify/functions/notion-proxy to the Notion API for local dev
        // This simulates the Netlify function environment locally.
        '/.netlify/functions/notion-proxy': {
          target: 'https://api.notion.com', // Notion API base URL
          changeOrigin: true, // Necessary for virtual hosted sites
          // The rewrite function needs to correctly map the path.
          // Example: /.netlify/functions/notion-proxy/v1/pages -> /v1/pages
          rewrite: (path) => path.replace(/^\/\.netlify\/functions\/notion-proxy/, ''),
        },
      },
    },
    build: {
      outDir: 'dist', // Default output directory
    },
    publicDir: 'public', // Specify the public directory
    optimizeDeps: {
      exclude: ['pdfjs-dist', 'epubjs', 'mammoth']
    },
    define: {
      // API_KEY for Gemini remains client-side as per current app structure.
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // NOTION_API_KEY and NOTION_PAGE_ID are removed from here.
      // They will be used by the Netlify Function from Netlify's environment variables.
    }
  }
})
