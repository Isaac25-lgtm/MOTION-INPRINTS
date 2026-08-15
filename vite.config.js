import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: { sourcemap: false, target: 'es2022' },
  /* `host: true` binds every interface rather than IPv6 loopback only.
     Without it Vite listens on [::1] alone, so http://localhost:5173 works while
     http://127.0.0.1:5173 refuses the connection — the two are different
     addresses, and the API already allows both as CORS origins. Binding both
     also exposes the dev server on the LAN, which is what makes it possible to
     open the site on a phone for real mobile review. */
  server: { port: 5173, strictPort: true, host: true },
})
