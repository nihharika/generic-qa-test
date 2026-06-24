const targetTypeRadios = document.querySelectorAll('input[name="targetType"]');
const urlPanel = document.querySelector("#urlPanel");
const htmlPanel = document.querySelector("#htmlPanel");
const targetUrl = document.querySelector("#targetUrl");
const htmlFile = document.querySelector("#htmlFile");
const htmlCode = document.querySelector("#htmlCode");
const scenarioCount = document.querySelector("#scenarioCount");
const runAiTestsBtn = document.querySelector("#runAiTestsBtn");
const testOutput = document.querySelector("#testOutput");
const testLinks = document.querySelector("#testLinks");

function getSelectedTargetType() {
  return document.querySelector('input[name="targetType"]:checked').value;
}

for (const radio of targetTypeRadios) {
  radio.addEventListener("change", () => {
    const selected = getSelectedTargetType();

    urlPanel.hidden = selected !== "url";
    htmlPanel.hidden = selected !== "html";
  });
}

htmlFile.addEventListener("change", async () => {
  const file = htmlFile.files?.[0];

  if (!file) {
    return;
  }

  htmlCode.value = await file.text();
});

runAiTestsBtn.addEventListener("click", async () => {
  runAiTestsBtn.disabled = true;
  testLinks.innerHTML = "";
  testOutput.textContent = "Discovering page fields, asking Gemini for scenarios, and running Playwright...";

  try {
    const targetType = getSelectedTargetType();

    const payload = {
      targetType,
      scenarioCount: Number(scenarioCount.value || 10)
    };

    if (targetType === "url") {
      payload.targetUrl = targetUrl.value.trim();
    } else {
      payload.html = htmlCode.value;
    }

    const response = await fetch("/api/run-ai-tests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    testOutput.textContent = JSON.stringify(data, null, 2);

    testLinks.innerHTML = `
      <a href="/reports/report.html" target="_blank">Open Summary Report</a>
      <a href="/reports/playwright-report/index.html" target="_blank">Open Playwright Report</a>
      <a href="/generated/discovered-page.json" target="_blank">View Discovered Fields</a>
      <a href="/generated/test-cases.json" target="_blank">View AI Test Cases</a>
    `;
  } catch (error) {
    testOutput.textContent = JSON.stringify(
      {
        ok: false,
        error: error.message
      },
      null,
      2
    );
  } finally {
    runAiTestsBtn.disabled = false;
  }
});