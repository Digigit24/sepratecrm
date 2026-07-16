import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { runStorageGuard } from "@/lib/storageGuard";

// Migrate/validate persisted localStorage/sessionStorage BEFORE anything
// renders. Legacy or malformed values (old theme formats, corrupted user
// objects, stale caches) are migrated or removed so they can never reach
// next-themes' classList calls or crash the first render.
runStorageGuard();

createRoot(document.getElementById("root")!).render(
  <ThemeProvider defaultTheme="light" enableSystem={false} storageKey="celiyo-theme">
    <App />
  </ThemeProvider>
);
