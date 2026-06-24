import { chromium } from "@playwright/test";

export async function discoverPageContract({ targetUrl }) {
  const browser = await chromium.launch({
    headless: true
  });

  const page = await browser.newPage({
    ignoreHTTPSErrors: true
  });

  try {
    await page.goto(targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30_000
    });

    await page.waitForTimeout(800);

    const contract = await page.evaluate(() => {
      function isVisible(element) {
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        return (
          style &&
          style.visibility !== "hidden" &&
          style.display !== "none" &&
          rect.width > 0 &&
          rect.height > 0
        );
      }

      function cssEscape(value) {
        if (window.CSS && typeof window.CSS.escape === "function") {
          return window.CSS.escape(value);
        }

        return String(value).replace(/["\\]/g, "\\$&");
      }

      function uniqueSelector(element) {
        const tag = element.tagName.toLowerCase();

        if (element.id) {
          return `#${cssEscape(element.id)}`;
        }

        const testId =
          element.getAttribute("data-testid") ||
          element.getAttribute("data-test") ||
          element.getAttribute("data-qa");

        if (testId) {
          return `[data-testid="${cssEscape(testId)}"], [data-test="${cssEscape(testId)}"], [data-qa="${cssEscape(testId)}"]`;
        }

        if (element.name) {
          const selector = `${tag}[name="${cssEscape(element.name)}"]`;
          if (document.querySelectorAll(selector).length === 1) {
            return selector;
          }
        }

        if (element.placeholder) {
          const selector = `${tag}[placeholder="${cssEscape(element.placeholder)}"]`;
          if (document.querySelectorAll(selector).length === 1) {
            return selector;
          }
        }

        const parts = [];
        let current = element;

        while (current && current.nodeType === Node.ELEMENT_NODE && current !== document.body) {
          const currentTag = current.tagName.toLowerCase();
          const parent = current.parentElement;

          if (!parent) {
            break;
          }

          const siblings = Array.from(parent.children).filter(
            (child) => child.tagName === current.tagName
          );

          const index = siblings.indexOf(current) + 1;
          parts.unshift(`${currentTag}:nth-of-type(${index})`);

          current = parent;
        }

        return parts.length > 0 ? parts.join(" > ") : tag;
      }

      function getLabelText(element) {
        const labels = Array.from(element.labels || [])
          .map((label) => label.innerText.trim())
          .filter(Boolean);

        if (labels.length > 0) {
          return labels.join(" ");
        }

        const aria = element.getAttribute("aria-label");
        if (aria) {
          return aria.trim();
        }

        const labelledBy = element.getAttribute("aria-labelledby");
        if (labelledBy) {
          const text = labelledBy
            .split(/\s+/)
            .map((id) => document.getElementById(id)?.innerText?.trim())
            .filter(Boolean)
            .join(" ");

          if (text) {
            return text;
          }
        }

        return (
          element.placeholder ||
          element.name ||
          element.id ||
          element.getAttribute("title") ||
          ""
        ).trim();
      }

      function getFormSelector(form) {
        if (!form) {
          return null;
        }

        return uniqueSelector(form);
      }

      const controls = Array.from(
        document.querySelectorAll("input, textarea, select")
      ).filter((element) => {
        const type = (element.getAttribute("type") || "").toLowerCase();

        return (
          isVisible(element) &&
          type !== "hidden" &&
          !element.disabled &&
          !element.readOnly
        );
      });

      const fields = controls.map((element, index) => {
        const tag = element.tagName.toLowerCase();
        const type =
          tag === "input"
            ? (element.getAttribute("type") || "text").toLowerCase()
            : tag;

        const options =
          tag === "select"
            ? Array.from(element.options).map((option) => ({
                value: option.value,
                label: option.textContent.trim(),
                disabled: option.disabled
              }))
            : [];

        return {
          index,
          selector: uniqueSelector(element),
          tag,
          type,
          label: getLabelText(element),
          name: element.getAttribute("name") || "",
          id: element.id || "",
          placeholder: element.getAttribute("placeholder") || "",
          required: element.required || false,
          pattern: element.getAttribute("pattern") || "",
          minLength: element.getAttribute("minlength") || "",
          maxLength: element.getAttribute("maxlength") || "",
          min: element.getAttribute("min") || "",
          max: element.getAttribute("max") || "",
          autocomplete: element.getAttribute("autocomplete") || "",
          value: element.value || "",
          checked: element.checked || false,
          formSelector: getFormSelector(element.form)
        };
      });

      const buttons = Array.from(
        document.querySelectorAll(
          "button, input[type='submit'], input[type='button'], input[type='reset']"
        )
      )
        .filter((element) => isVisible(element) && !element.disabled)
        .map((element) => {
          const tag = element.tagName.toLowerCase();
          const type =
            tag === "button"
              ? element.getAttribute("type") || "submit"
              : element.getAttribute("type") || "button";

          return {
            selector: uniqueSelector(element),
            tag,
            type: type.toLowerCase(),
            text: element.innerText || element.value || "",
            formSelector: getFormSelector(element.form)
          };
        });

      const submitButton =
        buttons.find((button) => button.type === "submit") ||
        buttons.find((button) => /submit|send|save|continue|next|sign|login/i.test(button.text)) ||
        null;

      const formCount = document.querySelectorAll("form").length;

      return {
        title: document.title,
        url: location.href,
        heading:
          document.querySelector("h1")?.innerText?.trim() ||
          document.querySelector("h2")?.innerText?.trim() ||
          "",
        formCount,
        fieldCount: fields.length,
        fields,
        buttons,
        submitButton
      };
    });

    return contract;
  } finally {
    await browser.close();
  }
}