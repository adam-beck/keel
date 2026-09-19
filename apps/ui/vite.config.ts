import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    // Quick tunnels (cloudflared) come from a random *.trycloudflare.com
    // hostname each run, so Vite's default Host-header allowlist would
    // reject them. Dev-only, tunnel is ephemeral.
    allowedHosts: true
  }
})
