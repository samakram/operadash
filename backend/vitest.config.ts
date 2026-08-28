import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./src/test/prismaMock.ts"],
    include: ["src/**/*.test.ts"],
    // jwt.ts validates these at module-load time, before any test body runs.
    env: {
      JWT_ACCESS_SECRET: "test-access-secret-that-is-at-least-32-characters-long",
      JWT_REFRESH_SECRET: "test-refresh-secret-at-least-32-characters-and-different",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
