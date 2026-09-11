import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchToolResources,
  fetchTools,
  fetchToolSteps,
  resourceKinds,
  type ToolResourceKind,
} from "@/lib/tools";

type Row = { id: string; sort_order: number };

export function ToolsManager() {
  const qc = useQueryClient();
  const tools = useQuery({ queryKey: ["tools"], queryFn: fetchTools });
  const [toolId, setToolId] = useState("");
  const activeId = toolId || tools.data?.[0]?.id || "";

  const steps = useQuery({
    queryKey: ["tool-steps", activeId],
    queryFn: () => fetchToolSteps(activeId),
    enabled: !!activeId,
  });
  const resources = useQuery({
    queryKey: ["tool-resources", activeId],
    queryFn: () => fetchToolResources(activeId),
    enabled: !!activeId,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["tools"] });
    qc.invalidateQueries({ queryKey: ["tool-steps"] });
    qc.invalidateQueries({ queryKey: ["tool-resources"] });
  };

  const [tool, setTool] = useState({ name: "", slug: "", blurb: "" });
  const addTool = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tools").insert({
        name: tool.name,
        slug: tool.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        blurb: tool.blurb,
        sort_order: (tools.data?.length ?? 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Tool added.");
      setTool({ name: "", slug: "", blurb: "" });
      refresh();
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't add the tool."),
  });

  const [step, setStep] = useState({ title: "", instructions: "", link_url: "", link_label: "" });
  const addStep = useMutation({
    mutationFn: async () => {
      if (!activeId) throw new Error("Pick a tool");
      const { error } = await supabase.from("tool_steps").insert({
        tool_id: activeId,
        title: step.title,
        instructions: step.instructions,
        link_url: step.link_url || null,
        link_label: step.link_label || null,
        sort_order: (steps.data?.length ?? 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Step added.");
      setStep({ title: "", instructions: "", link_url: "", link_label: "" });
      refresh();
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't add the step."),
  });

  const [res, setRes] = useState({
    title: "",
    description: "",
    url: "",
    kind: "download" as ToolResourceKind,
  });
  const addResource = useMutation({
    mutationFn: async () => {
      if (!activeId) throw new Error("Pick a tool");
      const { error } = await supabase.from("tool_resources").insert({
        tool_id: activeId,
        title: res.title,
        description: res.description,
        url: res.url,
        kind: res.kind,
        sort_order: (resources.data?.length ?? 0) + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Material added.");
      setRes({ title: "", description: "", url: "", kind: "download" });
      refresh();
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't add the material."),
  });

  const mutateRow = useMutation({
    mutationFn: async ({
      table,
      id,
      values,
    }: {
      table: "tool_steps" | "tool_resources" | "tools";
      id: string;
      values: Record<string, unknown>;
    }) => {
      const { error } = await supabase.from(table).update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message || "Couldn't save."),
  });

  const removeRow = useMutation({
    mutationFn: async ({
      table,
      id,
    }: {
      table: "tool_steps" | "tool_resources" | "tools";
      id: string;
    }) => {
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removed.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't remove."),
  });

  function move(
    table: "tool_steps" | "tool_resources" | "tools",
    rows: Row[],
    index: number,
    dir: -1 | 1,
  ) {
    const target = rows[index + dir];
    const current = rows[index];
    if (!target || !current) return;
    mutateRow.mutate({ table, id: current.id, values: { sort_order: target.sort_order } });
    mutateRow.mutate({ table, id: target.id, values: { sort_order: current.sort_order } });
  }

  if (tools.isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;

  const stepRows = steps.data ?? [];
  const resRows = resources.data ?? [];
  const toolRows = tools.data ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-6 shadow-card">
        <Label>Tool</Label>
        <Select value={activeId} onValueChange={setToolId}>
          <SelectTrigger className="mt-2">
            <SelectValue placeholder="Select a tool" />
          </SelectTrigger>
          <SelectContent>
            {toolRows.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <ul className="mt-4 divide-y">
          {toolRows.map((t, i) => (
            <li key={t.id} className="flex items-center gap-2 py-2 text-sm">
              <span className="flex-1">{t.name}</span>
              <OrderButtons
                onUp={() => move("tools", toolRows, i, -1)}
                onDown={() => move("tools", toolRows, i, 1)}
                disableUp={i === 0}
                disableDown={i === toolRows.length - 1}
              />
              <DeleteButton
                label={`Delete ${t.name}`}
                onDelete={() => removeRow.mutate({ table: "tools", id: t.id })}
              />
            </li>
          ))}
        </ul>
      </div>

      <form
        className="space-y-4 rounded-2xl border bg-card p-6 shadow-card"
        onSubmit={(e) => {
          e.preventDefault();
          addTool.mutate();
        }}
      >
        <h2 className="text-base font-semibold">Add a tool</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="tn">Name</Label>
            <Input id="tn" required value={tool.name} onChange={(e) => setTool({ ...tool, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ts">Page address</Label>
            <Input id="ts" required placeholder="tableau" value={tool.slug} onChange={(e) => setTool({ ...tool, slug: e.target.value })} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tb">Short description</Label>
          <Input id="tb" value={tool.blurb} onChange={(e) => setTool({ ...tool, blurb: e.target.value })} />
        </div>
        <Button type="submit" disabled={addTool.isPending}>Add tool</Button>
      </form>

      <div className="rounded-2xl border bg-card p-6 shadow-card">
        <h2 className="text-base font-semibold">Setup steps</h2>
        <ul className="mt-3 divide-y">
          {stepRows.map((s, i) => (
            <li key={s.id} className="space-y-2 py-3">
              <div className="flex items-start gap-2">
                <Input
                  defaultValue={s.title}
                  onBlur={(e) =>
                    e.target.value !== s.title &&
                    mutateRow.mutate({ table: "tool_steps", id: s.id, values: { title: e.target.value } })
                  }
                  aria-label="Step title"
                />
                <OrderButtons
                  onUp={() => move("tool_steps", stepRows, i, -1)}
                  onDown={() => move("tool_steps", stepRows, i, 1)}
                  disableUp={i === 0}
                  disableDown={i === stepRows.length - 1}
                />
                <DeleteButton
                  label="Delete step"
                  onDelete={() => removeRow.mutate({ table: "tool_steps", id: s.id })}
                />
              </div>
              <Textarea
                rows={2}
                defaultValue={s.instructions}
                onBlur={(e) =>
                  e.target.value !== s.instructions &&
                  mutateRow.mutate({ table: "tool_steps", id: s.id, values: { instructions: e.target.value } })
                }
                aria-label="Step instructions"
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  defaultValue={s.link_url ?? ""}
                  placeholder="Link (optional)"
                  onBlur={(e) =>
                    e.target.value !== (s.link_url ?? "") &&
                    mutateRow.mutate({ table: "tool_steps", id: s.id, values: { link_url: e.target.value || null } })
                  }
                  aria-label="Step link"
                />
                <Input
                  defaultValue={s.link_label ?? ""}
                  placeholder="Link button text"
                  onBlur={(e) =>
                    e.target.value !== (s.link_label ?? "") &&
                    mutateRow.mutate({ table: "tool_steps", id: s.id, values: { link_label: e.target.value || null } })
                  }
                  aria-label="Step link label"
                />
              </div>
            </li>
          ))}
          {stepRows.length === 0 && (
            <li className="py-3 text-sm text-muted-foreground">No steps yet.</li>
          )}
        </ul>
      </div>

      <form
        className="space-y-4 rounded-2xl border bg-card p-6 shadow-card"
        onSubmit={(e) => {
          e.preventDefault();
          addStep.mutate();
        }}
      >
        <h2 className="text-base font-semibold">Add a setup step</h2>
        <div className="space-y-2">
          <Label htmlFor="st">Title</Label>
          <Input id="st" required value={step.title} onChange={(e) => setStep({ ...step, title: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="si">Instructions</Label>
          <Textarea id="si" rows={3} value={step.instructions} onChange={(e) => setStep({ ...step, instructions: e.target.value })} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="su">Link (optional)</Label>
            <Input id="su" type="url" value={step.link_url} onChange={(e) => setStep({ ...step, link_url: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sl">Link button text</Label>
            <Input id="sl" value={step.link_label} onChange={(e) => setStep({ ...step, link_label: e.target.value })} />
          </div>
        </div>
        <Button type="submit" disabled={addStep.isPending}>Add step</Button>
      </form>

      <div className="rounded-2xl border bg-card p-6 shadow-card">
        <h2 className="text-base font-semibold">Videos, tutorials &amp; downloads</h2>
        <ul className="mt-3 divide-y">
          {resRows.map((r, i) => (
            <li key={r.id} className="flex items-center gap-2 py-3 text-sm">
              <div className="flex-1">
                <p className="font-medium">{r.title}</p>
                <p className="text-xs text-muted-foreground">{r.kind}</p>
              </div>
              <OrderButtons
                onUp={() => move("tool_resources", resRows, i, -1)}
                onDown={() => move("tool_resources", resRows, i, 1)}
                disableUp={i === 0}
                disableDown={i === resRows.length - 1}
              />
              <DeleteButton
                label="Delete material"
                onDelete={() => removeRow.mutate({ table: "tool_resources", id: r.id })}
              />
            </li>
          ))}
          {resRows.length === 0 && (
            <li className="py-3 text-sm text-muted-foreground">Nothing added yet.</li>
          )}
        </ul>
      </div>

      <form
        className="space-y-4 rounded-2xl border bg-card p-6 shadow-card"
        onSubmit={(e) => {
          e.preventDefault();
          addResource.mutate();
        }}
      >
        <h2 className="text-base font-semibold">Add a video, tutorial or download</h2>
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={res.kind} onValueChange={(v) => setRes({ ...res, kind: v as ToolResourceKind })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {resourceKinds.map((k) => (
                <SelectItem key={k.value} value={k.value}>
                  {k.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="rt">Title</Label>
          <Input id="rt" required value={res.title} onChange={(e) => setRes({ ...res, title: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rd">Short description</Label>
          <Input id="rd" value={res.description} onChange={(e) => setRes({ ...res, description: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ru2">Link</Label>
          <Input id="ru2" required type="url" value={res.url} onChange={(e) => setRes({ ...res, url: e.target.value })} />
        </div>
        <Button type="submit" disabled={addResource.isPending}>Add material</Button>
      </form>
    </div>
  );
}

function OrderButtons({
  onUp,
  onDown,
  disableUp,
  disableDown,
}: {
  onUp: () => void;
  onDown: () => void;
  disableUp: boolean;
  disableDown: boolean;
}) {
  return (
    <div className="flex shrink-0 gap-1">
      <Button type="button" variant="ghost" size="icon" onClick={onUp} disabled={disableUp} aria-label="Move up">
        <ArrowUp className="size-4" />
      </Button>
      <Button type="button" variant="ghost" size="icon" onClick={onDown} disabled={disableDown} aria-label="Move down">
        <ArrowDown className="size-4" />
      </Button>
    </div>
  );
}

function DeleteButton({ label, onDelete }: { label: string; onDelete: () => void }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="shrink-0 text-destructive"
      aria-label={label}
      onClick={() => {
        if (confirm("Remove this permanently?")) onDelete();
      }}
    >
      <Trash2 className="size-4" />
    </Button>
  );
}
