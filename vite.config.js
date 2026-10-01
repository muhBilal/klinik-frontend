import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // Dipakai stack Docker dev (backend/docker-compose.dev.yml): /api diteruskan ke nginx di jaringan Docker,
    // dan polling karena inotify tidak jalan di bind mount tertentu (NTFS/Windows).
    proxy: process.env.API_PROXY_TARGET
      ? { '/api': { target: process.env.API_PROXY_TARGET, changeOrigin: true } }
      : undefined,
    watch: process.env.VITE_USE_POLLING ? { usePolling: true, interval: 300 } : undefined,
  },
})
