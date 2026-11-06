import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(process.cwd()) } },
  test: { include: ["tests/**/*.test.ts"], environment: "node", testTimeout: 120000 },
});
