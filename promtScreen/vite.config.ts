import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    headers: {
      "Content-Security-Policy":
        "default-src 'self'; " +
        "frame-src 'self' http://localhost:3000 https://zewahrnmtqehbaduaewy.supabase.co/; " +
        "script-src 'self' 'unsafe-inline'; " +
        "style-src 'self' 'unsafe-inline'; " +
        "connect-src 'self' ws://localhost:3000;",
    },
  },
});
