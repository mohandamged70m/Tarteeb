import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    environment: "node",
    env: {
      APP_SECRET: "test-secret-0123456789abcdef-test-secret",
      TARTEEB_DB_PATH: "data/test-db.json",
    },
  },
});
