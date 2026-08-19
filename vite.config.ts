import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// The app talks to its backends through this dev-server proxy rather than with
// absolute URLs. Two reasons:
//
//  1. Remote access. Loaded over Tailscale, an absolute "http://localhost:8001"
//     resolves to the *client's* machine, not this host. Relative paths always
//     call back to whichever origin served the page.
//  2. No CORS. The auth backend is the hosted production service, which does
//     not allow-list this dev origin. Proxying server-side sidesteps that
//     entirely rather than needing a CORS change on production.
//
// Targets come from .env.local so they are configuration, not code.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");

  const AUTH_TARGET = env.VITE_PROXY_AUTH_TARGET || "http://127.0.0.1:8000";
  const CRM_TARGET = env.VITE_PROXY_CRM_TARGET || "http://127.0.0.1:8001";

  return {
    server: {
      host: "0.0.0.0",
      port: 5173,
      strictPort: true,
      // Vite rejects requests whose Host header it does not recognise, so the
      // Tailscale MagicDNS name has to be listed or remote loads fail with
      // "Blocked request".
      allowedHosts: ["localhost", "127.0.0.1", "digitech.tail7572d2.ts.net"],
      proxy: {
        "/auth-api": {
          target: AUTH_TARGET,
          changeOrigin: true,
          secure: true,
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
  };
});
