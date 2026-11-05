// Runs after `agent-native build` with the Vercel preset.
// 1. Pins the server function next to the Supabase database (eu-west-1) and
//    caps it at 60 s, the Hobby limit without Fluid Compute. Keep Fluid off:
//    with it one instance served dozens of requests through this small pool
//    and queries timed out ("database temporarily unavailable"). Agent turns
//    hand off at 30 s (agent.runSoftTimeoutMs in the app config) so a slow
//    model call still finishes inside the 60 s cap.
// 2. Raises the framework's serverless Postgres pool from 1 to 5. With one
//    connection, startup queries wait on each other until the 8 s timeout,
//    the pool is ended, and every later query fails with CONNECTION_ENDED.
//    The Supabase transaction pooler (port 6543) shares real connections, so
//    a few per instance is safe. See docs/build-log.md.
import { readFileSync, writeFileSync } from "node:fs";

const fn = ".vercel/output/functions/__server.func";

const configPath = `${fn}/.vc-config.json`;
const config = JSON.parse(readFileSync(configPath, "utf8"));
config.regions = ["dub1"];
config.maxDuration = 60;
writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");

const poolMax = 5;
const corePath = `${fn}/_chunks/agent-native-core.mjs`;
const core = readFileSync(corePath, "utf8");
const pattern = /(\.runtime\.databasePoolMax;return [\w$]+\(\)\?)1(:[\w$]+\?\?20\})/;
if (!pattern.test(core)) {
  throw new Error(`[vercel] pool size code not found in ${corePath}; check the framework version`);
}
writeFileSync(corePath, core.replace(pattern, `$1${poolMax}$2`));

console.log(`[vercel] regions=${config.regions} maxDuration=${config.maxDuration} serverlessPoolMax=${poolMax}`);
