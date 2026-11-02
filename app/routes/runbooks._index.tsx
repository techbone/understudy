import {
  actionErrorMessage,
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import { IconChevronRight } from "@tabler/icons-react";
import { useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function RunbooksIndex() {
  const navigate = useNavigate();
  const { data, isPending } = useActionQuery("list-runbooks", {});
  const seed = useActionMutation("reset-demo", {
    onSuccess: (result) => navigate(`/runbooks/${result.runbookId}`),
    onError: (error) =>
      toast.error(actionErrorMessage(error) ?? "Could not load the demo"),
  });
  const runbooks = data?.runbooks ?? [];

  // One runbook is the common case: open it directly.
  useEffect(() => {
    const only = runbooks.length === 1 ? runbooks[0] : undefined;
    if (only) navigate(`/runbooks/${only.id}`, { replace: true });
  }, [runbooks, navigate]);

  if (isPending || runbooks.length === 1) {
    return (
      <div className="mx-auto max-w-2xl space-y-3 p-6">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
    );
  }

  if (!runbooks.length) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4 px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">
          Show it once. Let it earn the rest.
        </h1>
        <p className="text-sm text-muted-foreground">
          Understudy turns a chore you recorded into a runbook. Each step starts
          where you put it and moves up only after clean approvals. Load the
          demo agency to see a few weeks of history.
        </p>
        <div>
          <Button disabled={seed.isPending} onClick={() => seed.mutate({})}>
            {seed.isPending ? "Loading…" : "Load the demo"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ul className="mx-auto max-w-2xl divide-y divide-border p-6">
      {runbooks.map((runbook) => (
        <li key={runbook.id}>
          <Link
            to={`/runbooks/${runbook.id}`}
            className="flex items-center gap-3 py-3 hover:text-foreground"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {runbook.title}
              </span>
              <span className="block truncate text-sm text-muted-foreground">
                {runbook.summary}
              </span>
            </span>
            <IconChevronRight className="size-4 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
