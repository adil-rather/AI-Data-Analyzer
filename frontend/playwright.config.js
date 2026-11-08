import { defineConfig } from "@playwright/test";
import path from "node:path";
import os from "node:os";
export default defineConfig({
  testDir: "./e2e",
  timeout: 90000,
  expect: { timeout: 20000 },
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  outputDir: path.join(os.tmpdir(), "rather-analyzer-e2e"),
  use: {
    baseURL: "http://127.0.0.1:8012",
    headless: true,
    launchOptions: process.env.PLAYWRIGHT_CHROME_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROME_EXECUTABLE }
      : {},
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 1000 } } },
    { name: "tablet", use: { viewport: { width: 768, height: 1024 } } },
    {
      name: "phone",
      use: { viewport: { width: 390, height: 844 }, hasTouch: true },
    },
    {
      name: "small-phone",
      use: { viewport: { width: 320, height: 640 }, hasTouch: true },
    },
    {
      name: "landscape",
      use: { viewport: { width: 844, height: 390 }, hasTouch: true },
    },
  ],
  webServer: {
    command: `"${process.env.ANALYZER_PYTHON || "python"}" -m uvicorn main:app --app-dir ../backend --host 127.0.0.1 --port 8012 --workers 1`,
    url: "http://127.0.0.1:8012/api/health",
    timeout: 120000,
    reuseExistingServer: !process.env.CI,
  },
});
