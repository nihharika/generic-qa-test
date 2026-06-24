import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  timeout: 45_000,
  expect: {
    timeout: 7_000
  },
  fullyParallel: false,
  workers: 1,
  reporter: [
    ["list"],
    [
      "html",
      {
        outputFolder: "reports/playwright-report",
        open: "never"
      }
    ],
    [
      "json",
      {
        outputFile: "generated/playwright-results.json"
      }
    ]
  ],
  use: {
    headless: process.env.HEADED === "true" ? false : true,
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    trace: "retain-on-failure",
    ignoreHTTPSErrors: true
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"]
      }
    }
  ],
  outputDir: "test-results"
});