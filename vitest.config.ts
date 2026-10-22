import path from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    include: ["{src,tests}/**/*.{test,spec}.{ts,tsx,js,jsx}"],
    environment: "jsdom",
    setupFiles: ["./tests/setupGlobals.ts", "./tests/setupTests.ts"],
    globals: true,
    // 默认 5000ms 在重负载机器上会被最重的集成用例压线超时（实测 4.8~5.2s 波动）
    testTimeout: 10_000,
    coverage: {
      reporter: ["text", "lcov"],
    },
  },
});
