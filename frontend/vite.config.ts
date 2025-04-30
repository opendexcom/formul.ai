import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    allowedHosts: ['frontend', 'localhost'],
    // Required for docker-compose reload
    watch: {
      usePolling: true,
    },
  },
})
