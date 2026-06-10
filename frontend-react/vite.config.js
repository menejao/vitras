import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Override: VITE_API_PROXY_TARGET=http://localhost:3002 para rodar backend local
const DEV_API_TARGET = process.env.VITE_API_PROXY_TARGET
  || "https://api.vitras.com.br";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      "/api-dev": {
        target: DEV_API_TARGET,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-dev/, ""),
      },
    },
  },
});
