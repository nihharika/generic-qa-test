import fs from "node:fs/promises";
import path from "node:path";

export async function writeGeneratedSpec({
  pageContract,
  scenarios,
  targetUrl,
  safeMode
}) {
  const generatedDir = path.resolve("generated");

  await fs.mkdir(generatedDir, { recursive: true });

  const contractPath = path.join(generatedDir, "discovered-page.json");
  const casesPath = path.join(generatedDir, "test-cases.json");
  const specPath = path.join(generatedDir, "generic-ai.spec.js");

  await fs.writeFile(contractPath, JSON.stringify(pageContract, null, 2), "utf8");
  await fs.writeFile(casesPath, JSON.stringify(scenarios, null, 2), "utf8");

  const specContent = `import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const pageContract = JSON.parse(
  fs.readFileSync(new URL("./discovered-page.json", import.meta.url), "utf8")
);

const scenarios = JSON.parse(
  fs.readFileSync(new URL("./test-cases.json", import.meta.url), "utf8")
);

const targetUrl = ${JSON.stringify(targetUrl)};
const safeMode = ${JSON.stringify(Boolean(safeMode))};

const screenshotDir = path.resolve(
  process.cwd(),
  process.env.SCREENSHOT_DIR || "screenshots"
);

function getField(selector) {
  return pageContract.fields.find((field) => field.selector === selector);
}

async function installSafeMode(page) {
  if (!safeMode) {
    return;
  }

  await page.route("**/*", async (route) => {
    const method = route.request().method().toUpperCase();

    if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      return route.abort();
    }

    return route.continue();
  });
}

async function fillField(page, field, valueSpec) {
  const locator = page.locator(field.selector).first();

  await expect(locator, \`Field should be visible: \${field.selector}\`).toBeVisible();

  if (field.type === "checkbox" || field.type === "radio") {
    await locator.setChecked(Boolean(valueSpec.checked));
    return;
  }

  if (field.tag === "select") {
    const value = String(valueSpec.value ?? "");

    if (value) {
      await locator.selectOption({ value }).catch(async () => {
        await locator.selectOption({ label: value });
      });
    }

    return;
  }

  const value = String(valueSpec.value ?? "");

  await locator.fill(value);
}

async function collectValidity(page, fields) {
  return page.evaluate((items) => {
    return items.map((field) => {
      const element = document.querySelector(field.selector);

      if (!element) {
        return {
          selector: field.selector,
          exists: false,
          valid: false,
          validationMessage: "Element not found"
        };
      }

      const hasValidityApi = typeof element.checkValidity === "function";

      return {
        selector: field.selector,
        exists: true,
        valid: hasValidityApi ? element.checkValidity() : true,
        validationMessage: hasValidityApi ? element.validationMessage : "",
        value: element.type === "password" ? "***" : element.value
      };
    });
  }, fields);
}

async function submitPage(page) {
  const submitButton = pageContract.submitButton;

  if (submitButton?.selector) {
    const locator = page.locator(submitButton.selector).first();

    if (await locator.count()) {
      await locator.click({ timeout: 5000 }).catch(async () => {
        await page.keyboard.press("Enter");
      });

      return;
    }
  }

  await page.keyboard.press("Enter");
}

test.describe("Generic AI generated tests", () => {
  test.beforeAll(() => {
    fs.mkdirSync(screenshotDir, { recursive: true });
  });

  for (const [index, scenario] of scenarios.entries()) {
    test(\`\${scenario.id} - \${scenario.title}\`, async ({ page }) => {
      const screenshotPath = path.join(
        screenshotDir,
        \`test-\${index + 1}.png\`
      );

      await installSafeMode(page);

      await page.goto(targetUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30_000
      });

      await expect(page.locator("body")).toBeVisible();

      try {
        for (const valueSpec of scenario.fieldValues) {
          const field = getField(valueSpec.selector);

          expect(field, \`Unknown field selector: \${valueSpec.selector}\`).toBeTruthy();

          await fillField(page, field, valueSpec);
        }

        const beforeSubmitValidity = await collectValidity(page, pageContract.fields);

        if (scenario.submit) {
          await submitPage(page);
          await page.waitForTimeout(800);
        }

        const afterSubmitValidity = await collectValidity(page, pageContract.fields);

        const invalidFields = afterSubmitValidity.filter((item) => item.exists && !item.valid);

        if (scenario.expected === "valid") {
          expect(
            invalidFields,
            \`Expected form controls to be valid. Invalid controls: \${JSON.stringify(invalidFields, null, 2)}\`
          ).toHaveLength(0);
        }

        if (scenario.expected === "invalid") {
          expect(
            invalidFields.length,
            \`Expected at least one invalid control. Before submit: \${JSON.stringify(beforeSubmitValidity, null, 2)} After submit: \${JSON.stringify(afterSubmitValidity, null, 2)}\`
          ).toBeGreaterThan(0);
        }

        await expect(page.locator("body")).toBeVisible();
      } finally {
        await page.screenshot({
          path: screenshotPath,
          fullPage: true
        }).catch(() => {});
      }
    });
  }
});
`;

  await fs.writeFile(specPath, specContent, "utf8");

  return {
    contractPath: path.relative(process.cwd(), contractPath),
    casesPath: path.relative(process.cwd(), casesPath),
    specPath: path.relative(process.cwd(), specPath)
  };
}