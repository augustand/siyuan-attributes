import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      siyuan: fileURLToPath(new URL("./tests/mocks/siyuan.ts", import.meta.url)),
    },
  },
  test: {
    environment: "happy-dom",
    setupFiles: ["./tests/setup.ts"],
  },
});
