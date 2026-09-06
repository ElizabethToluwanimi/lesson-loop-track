import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { fetchNotifications } from "@/lib/learn";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Arete Learn" },
      { name: "description", content: "Reminders, announcements and course updates." },
      { property: "og:title", content: "Notifications — Arete Learn" },
      { property: "og:description", content: "Reminders, announcements and course updates." },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const qc = useQueryClient();
  const notifications = useQuery({ queryKey: ["notifications"], queryFn: fetchNotifications });

  const markAll = useMutation({
    mutationFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", auth.user.id)
        .eq("read", false);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const list = notifications.data ?? [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold md:text-3xl">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Reminders, new resources and announcements.
          </p>
        </div>
        {list.some((n) => !n.read) && (
          <Button variant="secondary" size="sm" onClick={() => markAll.mutate()}>
            Mark all read
          </Button>
        )}
      </div>

      {notifications.isLoading && <Skeleton className="h-32 w-full rounded-2xl" />}

      {!notifications.isLoading && list.length === 0 && (
        <div className="rounded-2xl border bg-card p-10 text-center shadow-card">
          <Bell className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">You're all caught up</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Reminders and announcements will appear here.
          </p>
        </div>
      )}

      <ul className="space-y-3">
        {list.map((n) => (
          <li
            key={n.id}
            className={cn(
              "rounded-2xl border bg-card p-5 shadow-card",
              !n.read && "border-primary/40 bg-secondary/40",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium">{n.title}</p>
              <span className="shrink-0 text-xs text-muted-foreground">
                {new Date(n.created_at).toLocaleDateString()}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
