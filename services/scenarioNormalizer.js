import { z } from "zod";

const RawScenarioSchema = z.object({
  title: z.string().min(1),
  intent: z.enum(["positive", "negative", "boundary", "security", "smoke"]).default("smoke"),
  expected: z.enum(["valid", "invalid", "smoke"]).default("smoke"),
  fieldValues: z.array(
    z.object({
      selector: z.string().min(1),
      value: z.coerce.string().optional(),
      checked: z.boolean().optional()
    })
  ),
  submit: z.boolean().default(true),
  reason: z.string().optional()
});

function labelIncludes(field, words) {
  const haystack = [
    field.label,
    field.name,
    field.id,
    field.placeholder,
    field.autocomplete
  ]
    .join(" ")
    .toLowerCase();

  return words.some((word) => haystack.includes(word));
}

function firstValidOption(field) {
  const option = (field.options || []).find(
    (item) => !item.disabled && String(item.value || item.label || "").trim() !== ""
  );

  return option?.value || option?.label || "";
}

function validValueForField(field) {
  const type = field.type;

  if (type === "checkbox" || type === "radio") {
    return {
      selector: field.selector,
      checked: true
    };
  }

  if (field.tag === "select") {
    return {
      selector: field.selector,
      value: firstValidOption(field)
    };
  }

  if (type === "email") {
    return {
      selector: field.selector,
      value: "test.user@example.com"
    };
  }

  if (type === "tel" || labelIncludes(field, ["phone", "mobile", "contact"])) {
    return {
      selector: field.selector,
      value: "9876543210"
    };
  }

  if (type === "url") {
    return {
      selector: field.selector,
      value: "https://example.com"
    };
  }

  if (type === "number" || type === "range") {
    const min = Number(field.min || 1);
    const max = Number(field.max || min + 10);
    const value = Number.isFinite(min) && Number.isFinite(max)
      ? Math.min(Math.max(min, 1), max)
      : 1;

    return {
      selector: field.selector,
      value: String(value)
    };
  }

  if (type === "date") {
    return {
      selector: field.selector,
      value: "2026-01-01"
    };
  }

  if (type === "password") {
    return {
      selector: field.selector,
      value: "Password@123"
    };
  }

  if (labelIncludes(field, ["username", "user name"])) {
    return {
      selector: field.selector,
      value: "TestUser_123"
    };
  }

  if (labelIncludes(field, ["name", "full name"])) {
    return {
      selector: field.selector,
      value: "Niharika Bordoloi"
    };
  }

  if (labelIncludes(field, ["city"])) {
    return {
      selector: field.selector,
      value: "Guwahati"
    };
  }

  if (field.tag === "textarea" || labelIncludes(field, ["message", "comment", "description"])) {
    return {
      selector: field.selector,
      value: "This is a valid automated test message."
    };
  }

  return {
    selector: field.selector,
    value: "ValidTestValue"
  };
}

function invalidValueForField(field) {
  const type = field.type;

  if (type === "checkbox" || type === "radio") {
    return {
      selector: field.selector,
      checked: false
    };
  }

  if (field.required) {
    return {
      selector: field.selector,
      value: ""
    };
  }

  if (type === "email") {
    return {
      selector: field.selector,
      value: "invalid-email"
    };
  }

  if (type === "tel" || labelIncludes(field, ["phone", "mobile", "contact"])) {
    return {
      selector: field.selector,
      value: "12345"
    };
  }

  if (type === "url") {
    return {
      selector: field.selector,
      value: "not-a-url"
    };
  }

  if (type === "number") {
    if (field.min) {
      return {
        selector: field.selector,
        value: String(Number(field.min) - 1)
      };
    }

    if (field.max) {
      return {
        selector: field.selector,
        value: String(Number(field.max) + 1)
      };
    }
  }

  if (field.pattern) {
    return {
      selector: field.selector,
      value: "invalid value !!!"
    };
  }

  if (field.minLength) {
    return {
      selector: field.selector,
      value: "a"
    };
  }

  return {
    selector: field.selector,
    value: ""
  };
}

function securityValueForField(field) {
  return {
    selector: field.selector,
    value: "' OR '1'='1' -- <script>alert('xss')</script>"
  };
}

function buildBaseValues(fields) {
  return fields.map(validValueForField);
}

function createFallbackScenarios(pageContract, desiredCount) {
  const fields = pageContract.fields || [];
  const scenarios = [];

  if (fields.length === 0) {
    return [
      {
        title: "Smoke test page load",
        intent: "smoke",
        expected: "smoke",
        fieldValues: [],
        submit: false,
        reason: "No editable fields were discovered."
      }
    ];
  }

  scenarios.push({
    title: "Happy path with valid values for all discovered fields",
    intent: "positive",
    expected: "valid",
    fieldValues: buildBaseValues(fields),
    submit: true,
    reason: "All discovered fields receive valid generated values."
  });

  const requiredField = fields.find((field) => field.required);

  if (requiredField) {
    scenarios.push({
      title: `Required field left empty: ${requiredField.label || requiredField.name || requiredField.selector}`,
      intent: "negative",
      expected: "invalid",
      fieldValues: buildBaseValues(fields).map((entry) =>
        entry.selector === requiredField.selector
          ? invalidValueForField(requiredField)
          : entry
      ),
      submit: true,
      reason: "A required field is left empty."
    });
  }

  const emailField = fields.find((field) => field.type === "email");

  if (emailField) {
    scenarios.push({
      title: "Invalid email format",
      intent: "negative",
      expected: "invalid",
      fieldValues: buildBaseValues(fields).map((entry) =>
        entry.selector === emailField.selector
          ? { selector: emailField.selector, value: "invalid-email" }
          : entry
      ),
      submit: true,
      reason: "Email field receives invalid email format."
    });
  }

  const phoneField = fields.find(
    (field) => field.type === "tel" || labelIncludes(field, ["phone", "mobile", "contact"])
  );

  if (phoneField) {
    scenarios.push({
      title: "Invalid phone value",
      intent: "negative",
      expected: "invalid",
      fieldValues: buildBaseValues(fields).map((entry) =>
        entry.selector === phoneField.selector
          ? { selector: phoneField.selector, value: "12345" }
          : entry
      ),
      submit: true,
      reason: "Phone field receives an invalid number."
    });
  }

  const textField = fields.find(
    (field) =>
      ["text", "search", "textarea"].includes(field.type) ||
      field.tag === "textarea"
  );

  if (textField) {
    scenarios.push({
      title: "Security payload in text-like field",
      intent: "security",
      expected: "smoke",
      fieldValues: buildBaseValues(fields).map((entry) =>
        entry.selector === textField.selector
          ? securityValueForField(textField)
          : entry
      ),
      submit: true,
      reason: "Checks whether the page remains stable with common injection-like input."
    });
  }

  let index = 1;

  while (scenarios.length < desiredCount) {
    const field = fields[index % fields.length];

    scenarios.push({
      title: `Generated negative variation for ${field.label || field.name || field.selector}`,
      intent: "negative",
      expected: field.required || field.pattern || field.minLength || field.type === "email"
        ? "invalid"
        : "smoke",
      fieldValues: buildBaseValues(fields).map((entry) =>
        entry.selector === field.selector ? invalidValueForField(field) : entry
      ),
      submit: true,
      reason: "Fallback scenario generated deterministically from discovered field metadata."
    });

    index += 1;
  }

  return scenarios.slice(0, desiredCount);
}

function normalizeFieldValues(fieldValues, fields) {
  const allowedSelectors = new Set(fields.map((field) => field.selector));

  return fieldValues.filter((item) => allowedSelectors.has(item.selector));
}

export function normalizeScenarios(raw, pageContract, desiredCount = 10) {
  const fields = pageContract.fields || [];
  const rawList = Array.isArray(raw) ? raw : raw?.scenarios;

  const fallback = createFallbackScenarios(pageContract, desiredCount);

  const candidates = Array.isArray(rawList)
    ? [...rawList, ...fallback]
    : fallback;

  const scenarios = [];
  const seen = new Set();

  for (const candidate of candidates) {
    const parsed = RawScenarioSchema.safeParse(candidate);

    if (!parsed.success) {
      continue;
    }

    const fieldValues = normalizeFieldValues(parsed.data.fieldValues, fields);

    const uniqueKey = JSON.stringify({
      title: parsed.data.title,
      fieldValues,
      expected: parsed.data.expected
    });

    if (seen.has(uniqueKey)) {
      continue;
    }

    seen.add(uniqueKey);

    scenarios.push({
      id: `TC-${String(scenarios.length + 1).padStart(3, "0")}`,
      title: parsed.data.title.trim().slice(0, 140),
      intent: parsed.data.intent,
      expected: parsed.data.expected,
      fieldValues,
      submit: parsed.data.submit,
      reason: parsed.data.reason || "Generated and normalized by AI QA agent."
    });

    if (scenarios.length >= desiredCount) {
      break;
    }
  }

  return scenarios;
}