import fs from "node:fs/promises";
import path from "node:path";

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export async function resolveTarget({
  baseAppUrl,
  targetType,
  targetUrl,
  html
}) {
  await fs.mkdir("generated", { recursive: true });

  if (targetType === "url") {
    if (!targetUrl || !isHttpUrl(targetUrl)) {
      throw new Error("Please provide a valid http:// or https:// website URL.");
    }

    return {
      sourceType: "url",
      targetUrl,
      savedHtmlPath: null
    };
  }

  if (targetType === "html") {
    if (!html || String(html).trim().length < 20) {
      throw new Error("Please upload or paste a valid HTML file.");
    }

    const savedHtmlPath = path.resolve("generated/target.html");

    await fs.writeFile(savedHtmlPath, String(html), "utf8");

    return {
      sourceType: "html",
      targetUrl: `${baseAppUrl}/target/target.html`,
      savedHtmlPath: path.relative(process.cwd(), savedHtmlPath)
    };
  }

  throw new Error("Invalid targetType. Use either 'url' or 'html'.");
}