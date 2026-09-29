import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@trailer-kit": path.resolve(__dirname, ".claude/skills/gg/kit/src"),
    },
  },
  test: {
    include: ["src/**/*.test.ts", ".claude/skills/gg/kit/src/**/*.test.ts"],
    environment: "node",
  },
});
