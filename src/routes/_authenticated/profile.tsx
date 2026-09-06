import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchProfile, fetchProgress, fetchStreak } from "@/lib/learn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Your profile — Arete Learn" },
      { name: "description", content: "Manage your details, reminder time and notifications." },
      { property: "og:title", content: "Your profile — Arete Learn" },
      { property: "og:description", content: "Manage your details, reminder time and notifications." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const qc = useQueryClient();
  const profile = useQuery({ queryKey: ["profile"], queryFn: fetchProfile });
  const streak = useQuery({ queryKey: ["streak"], queryFn: fetchStreak });
  const progress = useQuery({ queryKey: ["progress"], queryFn: fetchProgress });

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    reminder_time: "19:00",
    daily_reminders: true,
    email_notifications: true,
  });

  useEffect(() => {
    if (!profile.data) return;
    setForm({
      full_name: profile.data.full_name ?? "",
      phone: profile.data.phone ?? "",
      reminder_time: (profile.data.reminder_time ?? "19:00:00").slice(0, 5),
      daily_reminders: profile.data.daily_reminders ?? true,
      email_notifications: profile.data.email_notifications ?? true,
    });
  }, [profile.data]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error("Not signed in");
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: form.full_name,
          phone: form.phone,
          reminder_time: form.reminder_time,
          daily_reminders: form.daily_reminders,
          email_notifications: form.email_notifications,
          updated_at: new Date().toISOString(),
        })
        .eq("id", auth.user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Your details are saved.");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: () => toast.error("We couldn't save your changes. Please try again."),
  });

  const completed = (progress.data ?? []).filter((p) => p.completed).length;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold md:text-3xl">Your profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Details, reminders and notifications.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border bg-card p-5 text-center shadow-card">
          <p className="font-display text-2xl font-semibold">{completed}</p>
          <p className="text-xs text-muted-foreground">Lessons completed</p>
        </div>
        <div className="rounded-2xl border bg-card p-5 text-center shadow-card">
          <p className="font-display text-2xl font-semibold">{streak.data?.current_streak ?? 0}</p>
          <p className="text-xs text-muted-foreground">Day streak</p>
        </div>
      </div>

      <form
        className="space-y-5 rounded-2xl border bg-card p-6 shadow-card"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={profile.data?.email ?? ""} disabled />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone number</Label>
          <Input
            id="phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="time">Daily reminder time</Label>
          <Input
            id="time"
            type="time"
            value={form.reminder_time}
            onChange={(e) => setForm({ ...form, reminder_time: e.target.value })}
          />
        </div>
        <div className="flex items-center justify-between rounded-xl border p-4">
          <div>
            <p className="text-sm font-medium">Daily learning reminders</p>
            <p className="text-xs text-muted-foreground">A nudge if you haven't learned that day.</p>
          </div>
          <Switch
            checked={form.daily_reminders}
            onCheckedChange={(v) => setForm({ ...form, daily_reminders: v })}
          />
        </div>
        <div className="flex items-center justify-between rounded-xl border p-4">
          <div>
            <p className="text-sm font-medium">Email notifications</p>
            <p className="text-xs text-muted-foreground">Announcements and new resources.</p>
          </div>
          <Switch
            checked={form.email_notifications}
            onCheckedChange={(v) => setForm({ ...form, email_notifications: v })}
          />
        </div>
        <Button type="submit" className="w-full" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </div>
  );
}
