import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";

// Called by the scheduled reminders job. Creates daily-learning and inactivity
// reminders for students who have not learned recently.
export const Route = createFileRoute("/api/public/hooks/reminders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const unauthorized = await authenticateCronRequest(request);
        if (unauthorized) return unauthorized;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const today = new Date().toISOString().slice(0, 10);

        const { data: profiles, error } = await supabaseAdmin
          .from("profiles")
          .select("id, daily_reminders");
        if (error) {
          return Response.json({ error: error.message }, { status: 500 });
        }

        const { data: streaks } = await supabaseAdmin
          .from("learning_streaks")
          .select("user_id, last_activity_date");
        const lastByUser = new Map(
          (streaks ?? []).map((s) => [s.user_id as string, s.last_activity_date as string | null]),
        );

        // Skip anyone who already received a reminder today.
        const { data: sentToday } = await supabaseAdmin
          .from("notifications")
          .select("user_id")
          .in("type", ["daily_reminder", "inactivity"])
          .gte("created_at", `${today}T00:00:00Z`);
        const alreadySent = new Set((sentToday ?? []).map((n) => n.user_id as string));

        const rows: { user_id: string; title: string; message: string; type: string }[] = [];

        for (const p of profiles ?? []) {
          if (!p.daily_reminders || alreadySent.has(p.id)) continue;
          const last = lastByUser.get(p.id) ?? null;
          if (last === today) continue;

          const daysIdle = last
            ? Math.floor((Date.parse(today) - Date.parse(last)) / 86400000)
            : 999;

          if (daysIdle >= 7) {
            rows.push({
              user_id: p.id,
              title: "Don't lose your progress",
              message: "Your next lesson is ready and waiting. Pick up where you stopped.",
              type: "inactivity",
            });
          } else if (daysIdle >= 3) {
            rows.push({
              user_id: p.id,
              title: "Your learning journey is waiting",
              message: "Come back and continue your course — a short session is enough.",
              type: "inactivity",
            });
          } else if (daysIdle >= 1) {
            rows.push({
              user_id: p.id,
              title: "Keep your momentum going",
              message: "You haven't continued your learning today. Spend 30 minutes on a lesson.",
              type: "inactivity",
            });
          } else {
            rows.push({
              user_id: p.id,
              title: "📊 Time to learn!",
              message:
                "Keep your Data Analysis journey moving. Spend at least 30 minutes learning today.",
              type: "daily_reminder",
            });
          }
        }

        if (rows.length) {
          const { error: insertError } = await supabaseAdmin.from("notifications").insert(rows);
          if (insertError) {
            return Response.json({ error: insertError.message }, { status: 500 });
          }
        }

        return Response.json({ success: true, sent: rows.length });
      },
    },
  },
});
