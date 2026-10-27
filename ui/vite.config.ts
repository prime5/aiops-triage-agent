import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    server: {
      // Optional: run the console through the flowgate gateway. With
      // VITE_API_BASE_URL=/api the browser talks to this dev server, which
      // forwards /api/* to the gateway (default http://127.0.0.1:8080).
      // Same-origin on purpose: the gateway's own 429/503 responses carry
      // no CORS headers, so a cross-origin browser could not read their
      // status or Retry-After.
      proxy: {
        '/api': {
          target: env.GATEWAY_URL || 'http://127.0.0.1:8080',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
  }
})
