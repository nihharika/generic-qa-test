import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { runAiTestPipeline } from "./services/aiTestPipeline.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let testRunInProgress = false;

export function createApp() {
  const app = express();

  app.use(express.json({ limit: "10mb" }));

  app.use(express.static(path.join(__dirname, "public")));
  app.use("/target", express.static(path.join(__dirname, "generated")));
  app.use("/reports", express.static(path.join(__dirname, "reports")));
  app.use("/screenshots", express.static(path.join(__dirname, "screenshots")));
  app.use("/generated", express.static(path.join(__dirname, "generated")));

  app.get("/health", (_req, res) => {
    res.json({
      ok: true,
      service: "generic-ai-qa-agent"
    });
  });

  app.post("/api/run-ai-tests", async (req, res) => {
    if (testRunInProgress) {
      return res.status(409).json({
        ok: false,
        error: "A test run is already in progress. Please wait."
      });
    }

    testRunInProgress = true;

    try {
      const port = Number(process.env.PORT || 3000);
      const baseAppUrl = `http://127.0.0.1:${port}`;

      const result = await runAiTestPipeline({
        baseAppUrl,
        targetType: req.body.targetType,
        targetUrl: req.body.targetUrl,
        html: req.body.html,
        scenarioCount: Number(req.body.scenarioCount || process.env.SCENARIO_COUNT || 10),
        headed: process.env.HEADED === "true",
        safeMode: process.env.SAFE_MODE !== "false"
      });

      return res.status(result.ok ? 200 : 500).json(result);
    } catch (error) {
      console.error("[AI TEST ERROR]", error);

      return res.status(500).json({
        ok: false,
        error: error.message,
        stack: process.env.NODE_ENV === "production" ? undefined : error.stack
      });
    } finally {
      testRunInProgress = false;
    }
  });

  app.use((_req, res) => {
    res.status(404).json({
      ok: false,
      error: "Route not found"
    });
  });

  return app;
}

export function startServer(port = Number(process.env.PORT || 3000)) {
  const app = createApp();

  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      const url = `http://127.0.0.1:${port}`;
      console.log(`Generic AI QA Agent running at ${url}`);
      resolve({ app, server, url });
    });

    server.once("error", reject);
  });
}

const isEntryPoint =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isEntryPoint) {
  startServer().catch((error) => {
    console.error("Failed to start server:", error);
    process.exit(1);
  });
}