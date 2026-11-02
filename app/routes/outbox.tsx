import { useActionQuery } from "@agent-native/core/client/hooks";
import { useSetPageTitle } from "@agent-native/toolkit/app-shell/header-actions";
import { useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function meta() {
  return [{ title: "Outbox · Understudy" }];
}

export default function OutboxRoute() {
  const { data, isPending } = useActionQuery("list-outbox", {});
  const [openId, setOpenId] = useState<string | null>(null);
  useSetPageTitle("Demo outbox");
  const messages = data?.messages ?? [];
  const open = messages.find((m) => m.id === openId) ?? messages[0];

  if (isPending) {
    return (
      <div className="space-y-2 p-6">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-14 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <p className="border-b border-border px-6 py-2 text-xs text-muted-foreground">
        Nothing here leaves the app. This outbox stands in for the billing
        inbox.
      </p>
      {messages.length ? (
        <div className="grid min-h-0 flex-1 md:grid-cols-[22rem_minmax(0,1fr)]">
          <ul className="min-h-0 overflow-y-auto border-b border-border md:border-b-0 md:border-r">
            {messages.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(m.id)}
                  className={cn(
                    "w-full border-b border-border px-4 py-3 text-left hover:bg-muted/60",
                    open?.id === m.id && "bg-muted",
                  )}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate font-mono text-xs">{m.to}</span>
                    <time className="tnum shrink-0 font-mono text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      }).format(new Date(m.sentAt))}
                    </time>
                  </span>
                  <span className="mt-1 block truncate text-sm">
                    {m.subject}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {open ? (
            <article className="min-h-0 overflow-y-auto p-6">
              <p className="font-mono text-xs text-muted-foreground">
                To {open.to}
              </p>
              <h2 className="mt-2 text-lg font-semibold tracking-tight">
                {open.subject}
              </h2>
              <p className="mt-4 whitespace-pre-wrap text-sm leading-6">
                {open.body}
              </p>
            </article>
          ) : null}
        </div>
      ) : (
        <p className="p-6 text-sm text-muted-foreground">
          Nothing sent yet. Approved reminders show up here.
        </p>
      )}
    </div>
  );
}
