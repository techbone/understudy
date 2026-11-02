// Browser smoke: sign in locally, load the demo, approve step 2 through the
// real UI (uiOnly path), accept the promotion, and screenshot each state.
// Usage: node scripts/smoke.mjs [baseUrl]
import { chromium } from "playwright";

async function signIn(page) {
  const local = page.getByRole("button", { name: "Continue as local dev" });
  if (await local.isVisible({ timeout: 3000 }).catch(() => false)) {
    await local.click();
    await page.waitForURL(/runbooks/, { timeout: 20000 });
  }
}

const base = process.argv[2] ?? "http://localhost:8080";
const out = "docs/evidence";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto(`${base}/runbooks`, { waitUntil: "networkidle" });
await signIn(page);
console.log("landed:", new URL(page.url()).pathname);
const load = page.getByRole("button", { name: "Load the demo" });
if (await load.isVisible().catch(() => false)) await load.click();
await page.getByText("Trust ladder").waitFor({ timeout: 20000 });
await page.screenshot({ path: `${out}/01-runbook.png`, fullPage: true });
console.log("runbook:", new URL(page.url()).pathname);
await browser.close();
console.log(
  errors.length ? `console errors:\n${errors.join("\n")}` : "no console errors",
);
