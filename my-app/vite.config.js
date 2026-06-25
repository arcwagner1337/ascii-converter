import { defineConfig } from 'vite'
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite' 

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(),nodePolyfills(),],
   optimizeDeps: {
    force: true 
  },
  server: {
    host: true,
    port: 3001, 
    strictPort: true, 
  }
})
