import { defineConfig } from "vite-plus";
import path from "node:path";
import electron from "vite-plugin-electron/simple";
import react from "@vitejs/plugin-react";
import { lazyPlugins } from "vite-plus";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

function electronEnv() {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  return env;
}

function startElectron({
  startup,
}: {
  startup: (
    argv?: string[],
    options?: import("node:child_process").SpawnOptions,
  ) => Promise<boolean>;
}) {
  return startup(undefined, { env: electronEnv() });
}

let electronStartupRequested = false;

function startElectronOnce({ startup }: Parameters<typeof startElectron>[0]) {
  if (electronStartupRequested && !hasElectronApp(process)) {
    return;
  }

  electronStartupRequested = true;
  void startElectron({ startup }).then(
    (started) => {
      if (!started) {
        electronStartupRequested = false;
      }
    },
    () => {
      electronStartupRequested = false;
    },
  );
}

function hasElectronApp(process: NodeJS.Process) {
  return "electronApp" in process;
}

// https://vitejs.dev/config/
export default defineConfig({
  publicDir: path.resolve(__dirname, "../../assets"),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  plugins: lazyPlugins(() => [
    tailwindcss(),
    tanstackRouter({
      target: "react",
      autoCodeSplitting: true,
    }),
    react(),
    electron({
      main: {
        // Shortcut of `build.lib.entry`.
        entry: "electron/main.ts",
        onstart({ startup }) {
          startElectronOnce({ startup });
        },
      },
      preload: {
        // Shortcut of `build.rollupOptions.input`.
        // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
        input: path.join(__dirname, "electron/preload.ts"),
        onstart({ reload, startup }) {
          if (hasElectronApp(process)) {
            reload();
            return;
          }

          startElectronOnce({ startup });
        },
      },
      // Ployfill the Electron and Node.js API for Renderer process.
      // If you want use Node.js in Renderer process, the `nodeIntegration` needs to be enabled in the Main process.
      // See 👉 https://github.com/electron-vite/vite-plugin-electron-renderer
      renderer:
        process.env.NODE_ENV === "test"
          ? // https://github.com/electron-vite/vite-plugin-electron-renderer/issues/78#issuecomment-2053600808
            undefined
          : {},
    }),
  ]),
});
