import fs from "node:fs/promises";
import path from "node:path";

import { resolveTarget } from "./targetManager.js";
import { discoverPageContract } from "./domDiscovery.js";
import { generateGenericScenarios } from "./gemini.js";
import { normalizeScenarios } from "./scenarioNormalizer.js";
import { writeGeneratedSpec } from "./specWriter.js";
import { runPlaywright } from "./playwrightRunner.js";
import { buildHtmlSummary } from "./reportGenerator.js";

async function ensureCleanOutputDirs() {
  await fs.mkdir("generated", { recursive: true });
  await fs.mkdir("reports", { recursive: true });
  await fs.mkdir("screenshots", { recursive: true });
  await fs.mkdir("test-results", { recursive: true });

  const screenshotFiles = await fs.readdir("screenshots").catch(() => []);

  await Promise.all(
    screenshotFiles
      .filter((file) => file.endsWith(".png"))
      .map((file) => fs.rm(path.join("screenshots", file), { force: true }))
  );
}

export async function runAiTestPipeline({
  baseAppUrl,
  targetType,
  targetUrl,
  html,
  scenarioCount = 10,
  headed = false,
  safeMode = true
}) {
  await ensureCleanOutputDirs();

  const target = await resolveTarget({
    baseAppUrl,
    targetType,
    targetUrl,
    html
  });

  const pageContract = await discoverPageContract({
    targetUrl: target.targetUrl
  });

  if (!pageContract.fields || pageContract.fields.length === 0) {
    console.warn("No editable fields were discovered. Running smoke test only.");
  }

  const rawGeminiScenarios = await generateGenericScenarios({
    pageContract,
    scenarioCount
  }).catch((error) => {
    console.warn("Gemini scenario generation failed. Falling back to deterministic scenarios.");
    console.warn(error.message);
    return { scenarios: [] };
  });

  const scenarios = normalizeScenarios(
    rawGeminiScenarios,
    pageContract,
    scenarioCount
  );

  const generated = await writeGeneratedSpec({
    pageContract,
    scenarios,
    targetUrl: target.targetUrl,
    safeMode
  });

  const playwrightResult = await runPlaywright({
    specPath: generated.specPath,
    headed
  });

  const report = await buildHtmlSummary({
    target,
    pageContract,
    scenarios,
    runResult: playwrightResult,
    outputPath: "reports/report.html"
  });

  return {
    ok: playwrightResult.ok,
    safeMode,
    target,
    discovered: {
      title: pageContract.title,
      heading: pageContract.heading,
      fieldCount: pageContract.fieldCount,
      submitButton: pageContract.submitButton
    },
    generated,
    report,
    playwrightReport: "reports/playwright-report/index.html",
    totals: {
      total: playwrightResult.total,
      passed: playwrightResult.passed,
      failed: playwrightResult.failed,
      skipped: playwrightResult.skipped
    },
    screenshots: playwrightResult.screenshots,
    scenarios,
    results: playwrightResult.tests,
    error:
      playwrightResult.ok === false
        ? "One or more Playwright tests failed. Check the report, screenshots, and Playwright trace."
        : undefined
  };
}