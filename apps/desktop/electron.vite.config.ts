import path from "node:path";
import electron from "vite-plugin-electron/simple";
import { defineConfig } from "vite-plus";
import webConfig from "../web/vite.config.ts";

const desktopRoot = __dirname;
const webRoot = path.resolve(desktopRoot, "../web");

function electronEnv() {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  return env;
}

let electronStartupRequested = false;

export default defineConfig({
  ...webConfig,
  root: webRoot,
  publicDir: path.resolve(desktopRoot, "../../assets"),
  resolve: { alias: { "@": path.resolve(webRoot, "src") } },
  build: { outDir: path.resolve(webRoot, "dist"), emptyOutDir: true },
  plugins: [
    ...(webConfig.plugins ?? []),
    electron({
      main: {
        entry: path.resolve(desktopRoot, "electron/main.ts"),
        vite: { build: { outDir: path.resolve(desktopRoot, "dist-electron") } },
        onstart({ startup }) {
          if (electronStartupRequested) return;
          electronStartupRequested = true;
          // Vite serves the renderer from apps/web, but Electron must resolve the
          // application entry from apps/desktop/package.json.
          void startup(undefined, { cwd: desktopRoot, env: electronEnv() }).then((started) => {
            if (!started) electronStartupRequested = false;
          });
        },
      },
      preload: {
        input: path.resolve(desktopRoot, "electron/preload.ts"),
        vite: { build: { outDir: path.resolve(desktopRoot, "dist-electron") } },
        onstart({ reload }) {
          reload();
        },
      },
    }),
  ],
});
