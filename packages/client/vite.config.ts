import { defineConfig } from "vite";

export default defineConfig({
  server: {
    proxy: {
      // Proxy API and WebSocket requests to Wrangler dev server
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
        ws: true,
      },
    },
  },
  define: {
    __PRODUCTION_API_URL__: JSON.stringify(
      process.env.NODE_ENV === "production" ? "" : "",
    ),
  },
});
