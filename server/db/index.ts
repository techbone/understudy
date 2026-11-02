import { createGetDb } from "@agent-native/core/db";
import { registerIdentityColumns } from "@agent-native/core/org";

import * as schema from "./schema.js";

export const getDb = createGetDb(schema);
export { schema };

registerIdentityColumns([
  {
    table: "invoices",
    column: "contact_email",
    emailChange: "retain",
    offboard: "retain",
    reason: "A client's billing contact in the demo ledger, not a member.",
  },
]);
