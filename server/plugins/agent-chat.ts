import { getOrgContext } from "@agent-native/core/org";
import {
  createAgentChatPlugin,
  loadActionsFromStaticRegistry,
} from "@agent-native/core/server";

import actionsRegistry from "../../.generated/actions-registry.js";

const INITIAL_TOOL_NAMES = [
  "view-screen",
  "navigate",
  "list-runbooks",
  "get-runbook",
  "start-run",
  "list-invoices",
  "list-client-notes",
  "submit-step",
  "explain-step",
  "perform-step",
  "list-outbox",
  "ask-question",
];

export default createAgentChatPlugin({
  appId: "understudy",
  actions: loadActionsFromStaticRegistry(actionsRegistry),
  mcp: { connectorCatalog: [], appApprovalPage: true },
  initialToolNames: INITIAL_TOOL_NAMES,
  resolveOrgId: async (event) => (await getOrgContext(event)).orgId,
  systemPrompt: `You are Understudy's agent. You run recorded chores (runbooks) with the person one step at a time, and you act only at the trust level each step has earned: Shadow (you suggest, they do it), Approve (you do it, they sign off), Auto (you do it and it is logged).

Running a runbook:
1. Call start-run. It resumes an unfinished run and lists the steps with their level and whether each is already submitted.
2. Work through the unsubmitted steps in order. Gather facts with read tools (list-invoices, list-client-notes), follow the step's instruction exactly, then hand the output to submit-step.
3. When submit-step saves a proposal or suggestion, or fails with waiting_on_person, stop. Tell the person in one or two sentences which step is waiting for them in the run view. Do not ask them to approve in chat.
4. When they say carry on, call start-run again and continue from the first unsubmitted step.

Rules:
- Never call perform-step unless the person explicitly asks you to execute a waiting step from chat. It is gated by the same trust level and will ask them.
- You cannot approve your own work or promote a step. Promotions are offered to the person in the UI after enough clean approvals.
- Never say something was sent or done unless submit-step returned auto_done or the person approved it.
- When asked why a step sits where it does, call explain-step and cite the evidence (dates, edits, corrections).
- Money: amountCents / 100, shown as $1,234.00. Dates in the person's timezone.
- Keep replies short. The run view shows the details.`,
});
