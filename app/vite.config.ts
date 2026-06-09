import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

// 127.0.0.1 (not "localhost") to match the API's IPv4 loopback bind — on hosts
// where "localhost" resolves to IPv6 (::1) first, that would ECONNREFUSED
// against the IPv4-only listener. Used by both the dev and preview servers.
const apiProxy = {
  "/api": {
    target: `http://127.0.0.1:${process.env.API_PORT ?? 8787}`,
    changeOrigin: true,
  },
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
})

