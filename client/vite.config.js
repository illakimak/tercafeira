import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Em desenvolvimento, o Vite encaminha o socket para o servidor na porta 3001,
// então o app usa sempre a mesma origem (funciona também por túnel ou na rede local).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: true,
    proxy: {
      "/socket.io": { target: "http://localhost:3001", ws: true },
    },
  },
});
