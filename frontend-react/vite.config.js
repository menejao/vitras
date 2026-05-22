import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const DEV_API_TARGET = process.env.VITE_API_PROXY_TARGET
  || "http://vitras-prod-sa.eba-pzqcqhqx.sa-east-1.elasticbeanstalk.com";

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
