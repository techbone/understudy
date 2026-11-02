import { chromium } from "playwright";

async function signIn(page) {
  const local = page.getByRole("button", { name: "Continue as local dev" });
  if (await local.isVisible({ timeout: 3000 }).catch(() => false)) {
    await local.click();
    await page.waitForURL(/runbooks/, { timeout: 20000 });
  }
}
const base = process.argv[2] ?? "http://localhost:8080";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto(`${base}/runbooks`, { waitUntil: "networkidle" });
await signIn(p);
const load = p.getByRole("button", { name: "Load the demo" });
if (await load.isVisible().catch(() => false)) await load.click();
else {
  await p.getByText("Trust ladder").waitFor({ timeout: 20000 });
  await p.getByRole("button", { name: "More" }).click();
  await p.getByRole("menuitem", { name: "Reset demo data" }).click();
}
await p.waitForTimeout(1500);
await p.getByText("Trust ladder").waitFor({ timeout: 20000 });
console.log(new URL(p.url()).pathname);
await b.close();
