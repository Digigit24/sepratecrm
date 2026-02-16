import { defineConfig } from "vite";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import path from "path";

/* augment your existing config */
export default defineConfig({
server: {
host: '::',
port: 3000,
proxy: {
// Proxy all API calls to your FastAPI domain
'/api': {
target: 'https://whatsapp.dglinkup.com',
changeOrigin: true,
secure: true,
},
// Optional: proxy WebSocket too so you can use ws://localhost:3000/ws/<tenantId>
'/ws': {
target: 'wss://whatsapp.dglinkup.com',
ws: true,
changeOrigin: true,
secure: true,
},
},
},
plugins: [react()],
resolve: { alias: { '@': path.resolve(__dirname, './src') } },
});