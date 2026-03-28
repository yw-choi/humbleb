import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: {
    baseURL: "http://127.0.0.1:3200",
    viewport: { width: 390, height: 844 }, // iPhone 14 size
    deviceScaleFactor: 3,
    colorScheme: "dark",
    screenshot: "on",
  },
  reporter: [["html", { open: "never" }]],
  outputDir: "./e2e/results",
});
