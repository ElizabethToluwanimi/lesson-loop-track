import { supabase } from "@/integrations/supabase/client";

export type Tool = {
  id: string;
  slug: string;
  name: string;
  blurb: string;
  sort_order: number;
};

export type ToolStep = {
  id: string;
  tool_id: string;
  title: string;
  instructions: string;
  link_url: string | null;
  link_label: string | null;
  sort_order: number;
};

export type ToolResourceKind = "download" | "video" | "tutorial" | "template";

export type ToolResource = {
  id: string;
  tool_id: string;
  kind: ToolResourceKind;
  title: string;
  description: string;
  url: string;
  sort_order: number;
};

export const resourceKinds: { value: ToolResourceKind; label: string }[] = [
  { value: "download", label: "Downloads" },
  { value: "video", label: "Videos" },
  { value: "tutorial", label: "Tutorials" },
  { value: "template", label: "Templates" },
];

export async function fetchTools() {
  const { data, error } = await supabase.from("tools").select("*").order("sort_order");
  if (error) throw error;
  return (data ?? []) as Tool[];
}

export async function fetchToolSteps(toolId?: string) {
  let q = supabase.from("tool_steps").select("*").order("sort_order");
  if (toolId) q = q.eq("tool_id", toolId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ToolStep[];
}

export async function fetchToolResources(toolId?: string) {
  let q = supabase.from("tool_resources").select("*").order("sort_order");
  if (toolId) q = q.eq("tool_id", toolId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as ToolResource[];
}

export async function fetchStepProgress() {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new Set<string>();
  const { data, error } = await supabase
    .from("tool_step_progress")
    .select("step_id")
    .eq("user_id", auth.user.id);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.step_id as string));
}

export async function setStepDone(stepId: string, done: boolean) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not signed in");
  if (done) {
    const { error } = await supabase
      .from("tool_step_progress")
      .upsert({ user_id: auth.user.id, step_id: stepId }, { onConflict: "user_id,step_id" });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("tool_step_progress")
      .delete()
      .eq("user_id", auth.user.id)
      .eq("step_id", stepId);
    if (error) throw error;
  }
}

export function toolCompletion(steps: ToolStep[], done: Set<string>) {
  const total = steps.length;
  const completed = steps.filter((s) => done.has(s.id)).length;
  return { total, completed, pct: total ? Math.round((completed / total) * 100) : 0 };
}
