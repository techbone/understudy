import { defineAppConfig } from "@agent-native/core/server";

export default defineAppConfig({
  app: {
    // This name appears in transactional emails. Change it to your product name.
    name: "Understudy",
    // The source template keeps a renamed app from inheriting first-party email branding.
    sourceTemplate: "chat",
    // Keep the template's authenticated entry explicit after renaming the app.
    homePath: "/runbooks",
    // Optional: use your own absolute HTTPS logo URL in transactional emails.
    // logoUrl: "https://example.com/logo.png",
  },
  agent: {
    // Hand a hosted turn off to a fresh request at 30 s, inside the 60 s
    // function cap on Vercel Hobby (see scripts/vercel-function-config.mjs).
    // The framework continues a turn only 3 times, so shorter chunks end a
    // long turn sooner; RunPanel picks the run back up when that happens.
    runSoftTimeoutMs: 30_000,
  },
});
