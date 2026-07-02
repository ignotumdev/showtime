import { defineConfig } from "vite-plus";

export default defineConfig({
  test: {
    environment: "node",
    exclude: [".repos/**", "node_modules/**"],
  },
  fmt: {
    ignorePatterns: ["apps/desktop/src/routeTree.gen.ts", ".plans/**", ".repos/**"],
  },
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
    ignorePatterns: ["apps/desktop/src/routeTree.gen.ts", ".plans/**", ".repos/**"],
  },
  run: {
    cache: true,
  },
});
