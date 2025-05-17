import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['frontend', 'localhost'],
    // Required for docker-compose reload
    watch: {
      usePolling: true,
    },
  },
  resolve: { alias: { '@': '/src' } },
})
