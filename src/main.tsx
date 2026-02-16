import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./globals.css";
import { ThemeProvider } from "@/components/ui/theme-provider";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider defaultTheme="light" enableSystem={false} storageKey="celiyo-theme">
    <App />
  </ThemeProvider>
);
