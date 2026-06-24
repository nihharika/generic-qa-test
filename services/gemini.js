import { GoogleGenAI, Type } from "@google/genai";

function extractJson(text) {
  const raw = String(text || "").trim();

  const withoutFences = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  try {
    return JSON.parse(withoutFences);
  } catch {
    const start = withoutFences.indexOf("{");
    const end = withoutFences.lastIndexOf("}");

    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Gemini did not return valid JSON.");
    }

    return JSON.parse(withoutFences.slice(start, end + 1));
  }
}

export async function generateGenericScenarios({
  pageContract,
  scenarioCount = 10
}) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY in .env file.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      scenarios: {
        type: Type.ARRAY,
        minItems: scenarioCount,
        maxItems: scenarioCount,
        items: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING
            },
            intent: {
              type: Type.STRING,
              enum: ["positive", "negative", "boundary", "security", "smoke"]
            },
            expected: {
              type: Type.STRING,
              enum: ["valid", "invalid", "smoke"]
            },
            fieldValues: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  selector: {
                    type: Type.STRING
                  },
                  value: {
                    type: Type.STRING
                  },
                  checked: {
                    type: Type.BOOLEAN
                  }
                },
                required: ["selector"],
                propertyOrdering: ["selector", "value", "checked"]
              }
            },
            submit: {
              type: Type.BOOLEAN
            },
            reason: {
              type: Type.STRING
            }
          },
          required: ["title", "intent", "expected", "fieldValues", "submit", "reason"],
          propertyOrdering: ["title", "intent", "expected", "fieldValues", "submit", "reason"]
        }
      }
    },
    required: ["scenarios"],
    propertyOrdering: ["scenarios"]
  };

  const compactContract = {
    title: pageContract.title,
    heading: pageContract.heading,
    url: pageContract.url,
    fieldCount: pageContract.fieldCount,
    fields: pageContract.fields.map((field) => ({
      selector: field.selector,
      tag: field.tag,
      type: field.type,
      label: field.label,
      name: field.name,
      placeholder: field.placeholder,
      required: field.required,
      pattern: field.pattern,
      minLength: field.minLength,
      maxLength: field.maxLength,
      min: field.min,
      max: field.max,
      options: field.options
    })),
    submitButton: pageContract.submitButton
  };

  const prompt = `
You are a senior QA automation engineer.

Generate exactly ${scenarioCount} Playwright-ready test scenarios for the discovered page.

Discovered page contract:
${JSON.stringify(compactContract, null, 2)}

Rules:
1. Use ONLY selectors that appear in the discovered fields.
2. fieldValues must contain selector and value/checked.
3. For checkboxes and radios, use checked true/false.
4. For selects, use value from available options.
5. Include positive happy path if possible.
6. Include negative cases for required fields if required fields exist.
7. Include invalid email if email field exists.
8. Include invalid phone if phone/tel field exists.
9. Include boundary values if min/max/minlength/maxlength exist.
10. Include security payloads only in text-like fields.
11. If the expected result is uncertain, use expected: "smoke".
12. Do not generate code.
13. Return only JSON matching the schema.
`;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseSchema
    }
  });

  const text =
    typeof response.text === "function" ? response.text() : response.text;

  return extractJson(text);
}