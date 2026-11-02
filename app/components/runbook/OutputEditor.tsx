import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import type { Effect } from "./types";

type Note = { summary: string; items: { label: string; detail: string }[] };
type Emails = {
  emails: { invoiceId: string; to: string; subject: string; body: string }[];
};
type Log = { entries: { invoiceId: string; note: string }[] };
type Escalate = { to: string; subject: string; body: string };

export type Output = Record<string, unknown>;

interface Props {
  effect: Effect;
  value: Output;
  onChange?: ((value: Output) => void) | undefined;
  invoiceLabel: (id: string) => string;
}

/** Shows a step's output; editable when onChange is given. */
export function OutputEditor({ effect, value, onChange, invoiceLabel }: Props) {
  const readOnly = !onChange;
  const set = (next: unknown) => onChange?.(next as Output);

  if (effect === "send_emails") {
    const v = value as unknown as Emails;
    return (
      <div className="space-y-3">
        {v.emails.map((email, index) => {
          const patch = (field: keyof Emails["emails"][number], text: string) =>
            set({
              emails: v.emails.map((e, i) =>
                i === index ? { ...e, [field]: text } : e,
              ),
            });
          return (
            <article
              key={index}
              className="rounded-lg border border-border bg-background"
            >
              <header className="flex items-center justify-between gap-3 border-b border-border px-3 py-2">
                <span className="truncate font-mono text-xs text-muted-foreground">
                  {email.to}
                </span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {invoiceLabel(email.invoiceId)}
                </span>
              </header>
              <div className="space-y-2 p-3">
                {readOnly ? (
                  <>
                    <p className="text-sm font-medium">{email.subject}</p>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {email.body}
                    </p>
                  </>
                ) : (
                  <>
                    <Input
                      aria-label="Subject"
                      value={email.subject}
                      onChange={(e) => patch("subject", e.target.value)}
                    />
                    <Textarea
                      aria-label="Body"
                      rows={4}
                      value={email.body}
                      onChange={(e) => patch("body", e.target.value)}
                    />
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
    );
  }

  if (effect === "log") {
    const v = value as unknown as Log;
    return (
      <ul className="divide-y divide-border rounded-lg border border-border bg-background">
        {v.entries.map((entry, index) => (
          <li key={index} className="flex items-center gap-3 px-3 py-2">
            <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">
              {invoiceLabel(entry.invoiceId)}
            </span>
            {readOnly ? (
              <span className="text-sm">{entry.note}</span>
            ) : (
              <Input
                aria-label={`Log for ${invoiceLabel(entry.invoiceId)}`}
                value={entry.note}
                onChange={(e) =>
                  set({
                    entries: v.entries.map((x, i) =>
                      i === index ? { ...x, note: e.target.value } : x,
                    ),
                  })
                }
              />
            )}
          </li>
        ))}
      </ul>
    );
  }

  if (effect === "escalate") {
    const v = value as unknown as Escalate;
    return (
      <article className="rounded-lg border border-border bg-background">
        <header className="border-b border-border px-3 py-2 font-mono text-xs text-muted-foreground">
          {v.to}
        </header>
        <div className="space-y-2 p-3">
          {readOnly ? (
            <>
              <p className="text-sm font-medium">{v.subject}</p>
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {v.body}
              </p>
            </>
          ) : (
            <>
              <Input
                aria-label="Subject"
                value={v.subject}
                onChange={(e) => set({ ...v, subject: e.target.value })}
              />
              <Textarea
                aria-label="Body"
                rows={5}
                value={v.body}
                onChange={(e) => set({ ...v, body: e.target.value })}
              />
            </>
          )}
        </div>
      </article>
    );
  }

  const v = value as unknown as Note;
  return (
    <div className="space-y-2">
      {readOnly ? (
        <p className="text-sm">{v.summary}</p>
      ) : (
        <div className="space-y-1.5">
          <Label className="sr-only">Summary</Label>
          <Textarea
            aria-label="Summary"
            rows={2}
            value={v.summary}
            onChange={(e) => set({ ...v, summary: e.target.value })}
          />
        </div>
      )}
      {v.items?.length ? (
        <ul className="divide-y divide-border rounded-lg border border-border bg-background">
          {v.items.map((item, index) => (
            <li key={index} className="flex gap-3 px-3 py-2">
              <span className="w-24 shrink-0 pt-0.5 font-mono text-xs text-muted-foreground">
                {item.label}
              </span>
              {readOnly ? (
                <span className="text-sm">{item.detail}</span>
              ) : (
                <Textarea
                  aria-label={`Detail for ${item.label}`}
                  rows={2}
                  value={item.detail}
                  onChange={(e) =>
                    set({
                      ...v,
                      items: v.items.map((x, i) =>
                        i === index ? { ...x, detail: e.target.value } : x,
                      ),
                    })
                  }
                />
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
