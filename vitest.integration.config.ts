import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    include: ["scripts/integration/**/*.integration.test.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 45_000,
    hookTimeout: 45_000,
  },
});
