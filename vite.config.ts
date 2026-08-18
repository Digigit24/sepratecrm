import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// Backends run locally: superadmin on 8000, digicrm on 8001.
// The frontend talks to them through this dev-server proxy rather than with
// absolute URLs. That matters for remote access: when the app is loaded over
// Tailscale, an absolute "http://localhost:8000" would resolve to the *client's*
// own machine, not this host. Going through the proxy means the browser always
// calls back to whichever origin served the page, and Vite forwards it here --
// which also means no cross-origin request is made at all.
const AUTH_TARGET = process.env.VITE_PROXY_AUTH_TARGET || "http://127.0.0.1:8000";
const CRM_TARGET = process.env.VITE_PROXY_CRM_TARGET || "http://127.0.0.1:8001";

export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true,
    // Vite blocks requests whose Host header it does not recognise. The
    // Tailscale MagicDNS name has to be listed explicitly or remote loads
    // fail with "Blocked request".
    allowedHosts: ["localhost", "127.0.0.1", "digitech.tail7572d2.ts.net"],
    proxy: {
      "/auth-api": {
        target: AUTH_TARGET,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/auth-api/, ""),
      },
      "/crm-api": {
        target: CRM_TARGET,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/crm-api/, ""),
      },
    },
  },
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
