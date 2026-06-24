import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function readJson(filePath) {
  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content);
}

async function listScreenshots(dir) {
  try {
    const files = await fs.readdir(dir);

    return files
      .filter((file) => file.endsWith(".png"))
      .sort()
      .map((file) => path.join(dir, file));
  } catch {
    return [];
  }
}

function walkSuite(suite, output) {
  for (const spec of suite.specs || []) {
    for (const test of spec.tests || []) {
      const lastResult = test.results?.[test.results.length - 1];

      output.push({
        title: spec.title,
        projectName: test.projectName,
        status: test.status || lastResult?.status || "unknown",
        durationMs: lastResult?.duration || 0,
        error: lastResult?.error?.message || null
      });
    }
  }

  for (const child of suite.suites || []) {
    walkSuite(child, output);
  }
}

function flattenPlaywrightJson(report) {
  const output = [];

  for (const suite of report.suites || []) {
    walkSuite(suite, output);
  }

  return output;
}

export async function runPlaywright({ specPath, headed = false }) {
  const resultsPath = path.resolve("generated/playwright-results.json");

  await fs.rm(resultsPath, { force: true }).catch(() => {});

  const args = [
    "playwright",
    "test",
    specPath,
    "--config=playwright.config.js"
  ];

  if (headed) {
    args.push("--headed");
  }

  let cli = {
    stdout: "",
    stderr: "",
    exitCode: 0
  };

  try {
    const { stdout, stderr } = await execFileAsync("npx", args, {
      env: {
        ...process.env,
        HEADED: String(headed),
        SCREENSHOT_DIR: path.resolve("screenshots")
      },
      timeout: 240_000,
      maxBuffer: 30 * 1024 * 1024,
      shell: process.platform === "win32"
    });

    cli = {
      stdout,
      stderr,
      exitCode: 0
    };
  } catch (error) {
    cli = {
      stdout: error.stdout || "",
      stderr: error.stderr || error.message,
      exitCode: typeof error.code === "number" ? error.code : 1
    };
  }

  const report = await readJson(resultsPath).catch(() => null);
  const tests = report ? flattenPlaywrightJson(report) : [];

  const passed = tests.filter((test) => test.status === "passed").length;
  const failed = tests.filter(
    (test) => !["passed", "skipped"].includes(test.status)
  ).length;
  const skipped = tests.filter((test) => test.status === "skipped").length;

  const screenshots = await listScreenshots("screenshots");

  return {
    ok: cli.exitCode === 0 && failed === 0 && tests.length > 0,
    total: tests.length,
    passed,
    failed,
    skipped,
    tests,
    screenshots,
    cli,
    rawReportPath: path.relative(process.cwd(), resultsPath)
  };
}