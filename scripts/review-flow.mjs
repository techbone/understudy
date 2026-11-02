// Plays the agent through the CLI (no LLM) and the person through the browser:
// the same actions and gate the real agent uses.
import { execFileSync } from "node:child_process";

import { chromium } from "playwright";

const base = process.argv[2] ?? "http://localhost:8080";
const env = { ...process.env, AGENT_USER_EMAIL: "dev@local.test" };
const act = (name, args = {}) => {
  const flags = Object.entries(args).flatMap(([k, v]) => [
    `--${k}`,
    typeof v === "string" ? v : JSON.stringify(v),
  ]);
  const out = execFileSync("pnpm", ["--silent", "action", name, ...flags], {
    env,
    encoding: "utf8",
  });
  const start = out.indexOf("{");
  return start < 0 ? out : Function(`return (${out.slice(start)})`)();
};

const { runbooks } = act("list-runbooks");
const runbookId = runbooks[0].id;
const rb = act("get-runbook", { runbookId });
const stepId = (n) => rb.steps[n - 1].id;
const { runId } = act("start-run", { runbookId });
const { invoices } = act("list-invoices");
const overdue = invoices.filter((i) => i.daysOverdue >= 7);
act("submit-step", {
  runId,
  stepId: stepId(1),
  output: {
    summary: `${overdue.length} invoices 7+ days overdue.`,
    items: overdue.map((i) => ({
      label: i.number,
      detail: `${i.daysOverdue} days overdue, $${i.amount}`,
    })),
  },
});
act("submit-step", {
  runId,
  stepId: stepId(2),
  output: {
    summary:
      "Skip Acme (AP on leave until the 10th). Keep Fable warm. Dunmore goes to the founder.",
    items: [
      { label: "Acme Logistics", detail: "Skip this week." },
      { label: "Fable & Co", detail: "Warm tone, no late-fee language." },
    ],
  },
});
console.log("agent: steps 1-2 submitted; step 2 is waiting on the person");

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto(`${base}/runbooks/${runbookId}`, { waitUntil: "networkidle" });
const local = p.getByRole("button", { name: "Continue as local dev" });
if (await local.isVisible({ timeout: 3000 }).catch(() => false))
  await local.click();
await p.getByText("Waiting on you (1)").waitFor({ timeout: 20000 });
await p.screenshot({ path: "docs/evidence/02-waiting.png", fullPage: true });
console.log("ui: run shows 'Waiting on you (1)'");

await p.getByRole("button", { name: "Approve", exact: true }).click();
await p.getByText("Move up to Auto?").waitFor({ timeout: 20000 });
await p.screenshot({
  path: "docs/evidence/03-promotion-offer.png",
  fullPage: true,
});
console.log("ui: approved; promotion offer appeared (3/3)");

await p.getByRole("button", { name: "Promote" }).click();
await p.getByText("Promoted to Auto").waitFor({ timeout: 20000 });
console.log("ui: promoted to Auto");

await p
  .locator("button", { hasText: "Check client exceptions" })
  .first()
  .click();
await p.getByText("Evidence").waitFor({ timeout: 20000 });
await p.waitForTimeout(800);
await p.screenshot({ path: "docs/evidence/04-evidence.png" });
console.log("ui: evidence drawer open");
await b.close();
