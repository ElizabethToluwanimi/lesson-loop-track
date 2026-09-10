import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  fetchStepProgress,
  fetchToolResources,
  fetchTools,
  fetchToolSteps,
  resourceKinds,
  setStepDone,
  toolCompletion,
} from "@/lib/tools";
import { ResourceButton } from "@/components/tools/ResourceButton";

export const Route = createFileRoute("/_authenticated/tools/$slug")({
  head: () => ({
    meta: [
      { title: "Tool setup guide — Arete Learn" },
      {
        name: "description",
        content: "Step-by-step installation instructions and downloads for your course tools.",
      },
      { property: "og:title", content: "Tool setup guide — Arete Learn" },
      {
        property: "og:description",
        content: "Step-by-step installation instructions and downloads for your course tools.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ToolDetailPage,
});

function ToolDetailPage() {
  const { slug } = Route.useParams();
  const qc = useQueryClient();
  const tools = useQuery({ queryKey: ["tools"], queryFn: fetchTools });
  const tool = tools.data?.find((t) => t.slug === slug);
  const steps = useQuery({
    queryKey: ["tool-steps", tool?.id],
    queryFn: () => fetchToolSteps(tool!.id),
    enabled: !!tool,
  });
  const resources = useQuery({
    queryKey: ["tool-resources", tool?.id],
    queryFn: () => fetchToolResources(tool!.id),
    enabled: !!tool,
  });
  const done = useQuery({ queryKey: ["tool-step-progress"], queryFn: fetchStepProgress });

  const toggle = useMutation({
    mutationFn: ({ id, value }: { id: string; value: boolean }) => setStepDone(id, value),
    onMutate: async ({ id, value }) => {
      await qc.cancelQueries({ queryKey: ["tool-step-progress"] });
      const prev = qc.getQueryData<Set<string>>(["tool-step-progress"]);
      const next = new Set(prev ?? []);
      if (value) next.add(id);
      else next.delete(id);
      qc.setQueryData(["tool-step-progress"], next);
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["tool-step-progress"], ctx.prev);
      toast.error("Couldn't save that step. Try again.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["tool-step-progress"] }),
  });

  if (tools.isLoading) return <Skeleton className="mx-auto h-72 max-w-3xl rounded-2xl" />;
  if (!tool) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border bg-card p-10 text-center shadow-card">
        <h1 className="text-lg font-semibold">Tool not found</h1>
        <Button asChild variant="link" className="mt-2">
          <Link to="/tools">Back to tools</Link>
        </Button>
      </div>
    );
  }

  const doneSet = done.data ?? new Set<string>();
  const list = steps.data ?? [];
  const c = toolCompletion(list, doneSet);
  const allDone = c.total > 0 && c.completed === c.total;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-2">
          <Link to="/tools">
            <ArrowLeft className="mr-1 size-4" /> All tools
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold md:text-3xl">{tool.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{tool.blurb}</p>
      </div>

      <section className="rounded-2xl border bg-card p-6 shadow-card">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Setup steps</h2>
          <span className="text-sm text-muted-foreground">
            {c.completed}/{c.total} done
          </span>
        </div>
        <Progress value={c.pct} className="mt-3" />
        {allDone && (
          <p className="mt-3 rounded-lg bg-success/10 px-3 py-2 text-sm font-medium text-success">
            {tool.name} is set up — you're ready for class.
          </p>
        )}

        <ol className="mt-5 space-y-3">
          {steps.isLoading && [0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
          {list.map((step, i) => {
            const checked = doneSet.has(step.id);
            return (
              <li
                key={step.id}
                className={cn(
                  "rounded-xl border p-4 transition-colors",
                  checked ? "border-success/40 bg-success/5" : "bg-background",
                )}
              >
                <label className="flex cursor-pointer items-start gap-3">
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(v) => toggle.mutate({ id: step.id, value: v === true })}
                    className="mt-0.5"
                    aria-label={`Mark step ${i + 1} ${checked ? "not done" : "done"}`}
                  />
                  <div className="flex-1">
                    <p className={cn("font-medium", checked && "line-through text-muted-foreground")}>
                      <span className="mr-2 text-xs font-semibold text-primary">STEP {i + 1}</span>
                      {step.title}
                    </p>
                    {step.instructions && (
                      <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
                        {step.instructions}
                      </p>
                    )}
                    {step.link_url && (
                      <Button asChild size="sm" variant="secondary" className="mt-3">
                        <a href={step.link_url} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-2 size-4" />
                          {step.link_label || "Open link"}
                        </a>
                      </Button>
                    )}
                  </div>
                </label>
              </li>
            );
          })}
          {!steps.isLoading && list.length === 0 && (
            <p className="text-sm text-muted-foreground">No setup steps have been added yet.</p>
          )}
        </ol>
      </section>

      {resourceKinds.map((k) => {
        const items = (resources.data ?? []).filter((r) => r.kind === k.value);
        if (!items.length) return null;
        return (
          <section key={k.value} className="space-y-3">
            <h2 className="text-base font-semibold">{k.label}</h2>
            <ul className="grid gap-3 md:grid-cols-2">
              {items.map((r) => (
                <li key={r.id} className="flex flex-col rounded-2xl border bg-card p-4 shadow-card">
                  <p className="font-medium">{r.title}</p>
                  {r.description && (
                    <p className="mt-0.5 flex-1 text-xs text-muted-foreground">{r.description}</p>
                  )}
                  <div className="mt-3">
                    <ResourceButton resource={r} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
