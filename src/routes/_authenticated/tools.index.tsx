import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CheckCircle2, ChevronRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  fetchStepProgress,
  fetchToolResources,
  fetchTools,
  fetchToolSteps,
  resourceKinds,
  toolCompletion,
  type ToolResourceKind,
} from "@/lib/tools";
import { ResourceButton } from "@/components/tools/ResourceButton";

export const Route = createFileRoute("/_authenticated/tools/")({
  head: () => ({
    meta: [
      { title: "Tools & setup checklist — Arete Learn" },
      {
        name: "description",
        content:
          "Install Excel, Power BI, PostgreSQL and Python step by step, and find tutorials, videos, templates and downloads.",
      },
      { property: "og:title", content: "Tools & setup checklist — Arete Learn" },
      {
        property: "og:description",
        content:
          "Install Excel, Power BI, PostgreSQL and Python step by step, and find tutorials, videos, templates and downloads.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ToolsPage,
});

function ToolsPage() {
  const tools = useQuery({ queryKey: ["tools"], queryFn: fetchTools });
  const steps = useQuery({ queryKey: ["tool-steps"], queryFn: () => fetchToolSteps() });
  const resources = useQuery({ queryKey: ["tool-resources"], queryFn: () => fetchToolResources() });
  const done = useQuery({ queryKey: ["tool-step-progress"], queryFn: fetchStepProgress });

  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<ToolResourceKind | "all">("all");
  const [toolFilter, setToolFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (resources.data ?? []).filter((r) => {
      if (kind !== "all" && r.kind !== kind) return false;
      if (toolFilter !== "all" && r.tool_id !== toolFilter) return false;
      if (!q) return true;
      const tool = tools.data?.find((t) => t.id === r.tool_id);
      return `${r.title} ${r.description} ${r.kind} ${tool?.name ?? ""}`.toLowerCase().includes(q);
    });
  }, [resources.data, tools.data, query, kind, toolFilter]);

  const loading = tools.isLoading || steps.isLoading;
  const doneSet = done.data ?? new Set<string>();
  const allSteps = steps.data ?? [];
  const overall = toolCompletion(allSteps, doneSet);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold md:text-3xl">Tools &amp; setup</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Get Excel, Power BI, SQL and Python installed. Tick off each step as you go.
        </p>
      </div>

      <section className="rounded-2xl border bg-card p-6 shadow-card">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Installation checklist</h2>
            <p className="text-xs text-muted-foreground">
              {overall.completed} of {overall.total} steps done
            </p>
          </div>
          <span className="font-display text-2xl font-semibold text-primary">{overall.pct}%</span>
        </div>
        <Progress value={overall.pct} className="mt-3" />

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {loading &&
            [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          {(tools.data ?? []).map((tool) => {
            const c = toolCompletion(
              allSteps.filter((s) => s.tool_id === tool.id),
              doneSet,
            );
            const complete = c.total > 0 && c.completed === c.total;
            return (
              <Link
                key={tool.id}
                to="/tools/$slug"
                params={{ slug: tool.slug }}
                className="group flex flex-col rounded-xl border bg-background p-4 transition-colors hover:border-primary/50"
              >
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 font-medium">
                    {complete && <CheckCircle2 className="size-4 text-success" />}
                    {tool.name}
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{tool.blurb}</p>
                <div className="mt-3 flex items-center gap-2">
                  <Progress value={c.pct} className="h-1.5 flex-1" />
                  <span className="text-xs text-muted-foreground">
                    {c.completed}/{c.total}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-base font-semibold">Find tutorials, videos, templates &amp; downloads</h2>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search e.g. pgAdmin, pandas, install video…"
            className="pl-9"
            aria-label="Search tools and resources"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip active={kind === "all"} onClick={() => setKind("all")}>
            All types
          </Chip>
          {resourceKinds.map((k) => (
            <Chip key={k.value} active={kind === k.value} onClick={() => setKind(k.value)}>
              {k.label}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Chip active={toolFilter === "all"} onClick={() => setToolFilter("all")} subtle>
            All tools
          </Chip>
          {(tools.data ?? []).map((t) => (
            <Chip key={t.id} active={toolFilter === t.id} onClick={() => setToolFilter(t.id)} subtle>
              {t.name}
            </Chip>
          ))}
        </div>

        {resources.isLoading ? (
          <Skeleton className="h-40 rounded-2xl" />
        ) : filtered.length === 0 ? (
          <p className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Nothing matches that search. Try a different word or clear the filters.
          </p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {filtered.map((r) => {
              const tool = tools.data?.find((t) => t.id === r.tool_id);
              return (
                <li key={r.id} className="flex flex-col rounded-2xl border bg-card p-4 shadow-card">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{r.title}</p>
                      {r.description && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{r.description}</p>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                      {tool?.name}
                    </span>
                  </div>
                  <div className="mt-3">
                    <ResourceButton resource={r} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <p className="text-center text-xs text-muted-foreground">
        Trouble installing anything? Ask your instructor in class or send a message.
      </p>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
  subtle,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  subtle?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? subtle
            ? "border-primary bg-primary/10 text-primary"
            : "border-primary bg-primary text-primary-foreground"
          : "bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
