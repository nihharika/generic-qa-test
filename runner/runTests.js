import "dotenv/config";

import fs from "node:fs/promises";

import { startServer } from "../server.js";
import { runAiTestPipeline } from "../services/aiTestPipeline.js";

const port = Number(process.env.PORT || 3000);

let serverInfo;

try {
  serverInfo = await startServer(port);

  const htmlFilePath = process.env.TEST_HTML_FILE;
  const targetUrl =
    process.env.TEST_TARGET_URL || `${serverInfo.url}/sample-form.html`;

  let targetType = "url";
  let html = null;

  if (htmlFilePath) {
    targetType = "html";
    html = await fs.readFile(htmlFilePath, "utf8");
  }

  const result = await runAiTestPipeline({
    baseAppUrl: serverInfo.url,
    targetType,
    targetUrl,
    html,
    scenarioCount: Number(process.env.SCENARIO_COUNT || 10),
    headed: process.env.HEADED === "true",
    safeMode: process.env.SAFE_MODE !== "false"
  });

  console.log(JSON.stringify(result, null, 2));

  console.log("\nReports:");
  console.log("- Summary: reports/report.html");
  console.log("- Playwright: reports/playwright-report/index.html");
  console.log("- Discovered fields: generated/discovered-page.json");
  console.log("- Test cases: generated/test-cases.json");

  process.exitCode = result.ok ? 0 : 1;
} catch (error) {
  console.error("AI test runner failed:", error);
  process.exitCode = 1;
} finally {
  if (serverInfo?.server) {
    await new Promise((resolve) => serverInfo.server.close(resolve));
  }
}