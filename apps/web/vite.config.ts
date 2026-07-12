import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import { defineConfig, lazyPlugins } from "vite-plus";

export default defineConfig({
  // Relative assets work both when Electron loads index.html from disk and when a web server serves it.
  base: "./",
  publicDir: path.resolve(__dirname, "../../assets"),
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  plugins: lazyPlugins(() => [
    tailwindcss(),
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
  ]),
});
