import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Flame } from "lucide-react";
import {
  courseProgress,
  fetchActivity,
  fetchCourses,
  fetchCourseTree,
  fetchEnrollments,
  fetchProgress,
  fetchStreak,
} from "@/lib/learn";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/progress")({
  head: () => ({
    meta: [
      { title: "Your progress — Arete Learn" },
      { name: "description", content: "Track your lesson completion, module progress and streak." },
      { property: "og:title", content: "Your progress — Arete Learn" },
      { property: "og:description", content: "Track your lesson completion, module progress and streak." },
    ],
  }),
  component: ProgressPage,
});

function ProgressPage() {
  const courses = useQuery({ queryKey: ["courses"], queryFn: fetchCourses });
  const enrolled = useQuery({ queryKey: ["enrollments"], queryFn: fetchEnrollments });
  const progress = useQuery({ queryKey: ["progress"], queryFn: fetchProgress });
  const streak = useQuery({ queryKey: ["streak"], queryFn: fetchStreak });
  const activity = useQuery({ queryKey: ["activity"], queryFn: () => fetchActivity(30) });

  const myCourses = (courses.data ?? []).filter((c) => (enrolled.data ?? []).includes(c.id));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold md:text-3xl">Your progress</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          How far you've come, module by module.
        </p>
      </div>

      <div className="flex items-center gap-4 rounded-2xl border bg-card p-6 shadow-card">
        <span className="flex size-12 items-center justify-center rounded-xl bg-secondary">
          <Flame className="size-6 text-warning" />
        </span>
        <div>
          <p className="font-display text-2xl font-semibold">
            {streak.data?.current_streak ?? 0}-day streak
          </p>
          <p className="text-xs text-muted-foreground">
            Longest streak: {streak.data?.longest_streak ?? 0} days
          </p>
        </div>
      </div>

      {progress.isLoading && <Skeleton className="h-40 w-full rounded-2xl" />}

      {myCourses.map((c) => (
        <CourseProgressCard key={c.id} slug={c.slug} />
      ))}

      {!myCourses.length && !courses.isLoading && (
        <p className="text-sm text-muted-foreground">
          Enrol in a course to start tracking your progress.
        </p>
      )}

      <div className="rounded-2xl border bg-card p-6 shadow-card">
        <h2 className="text-base font-semibold">Recent learning activity</h2>
        {(activity.data ?? []).length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No activity in the last 30 days.</p>
        ) : (
          <ul className="mt-3 divide-y">
            {(activity.data ?? []).slice(0, 12).map((a, i) => (
              <li key={i} className="flex items-center justify-between py-2.5 text-sm">
                <span>
                  {a.activity_type === "lesson_completed" ? "Completed a lesson" : "Opened a lesson"}
                </span>
                <span className="text-xs text-muted-foreground">{a.activity_date}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function CourseProgressCard({ slug }: { slug: string }) {
  const tree = useQuery({ queryKey: ["course-tree", slug], queryFn: () => fetchCourseTree(slug) });
  const progress = useQuery({ queryKey: ["progress"], queryFn: fetchProgress });

  if (!tree.data) return <Skeleton className="h-40 w-full rounded-2xl" />;
  const stats = courseProgress(tree.data, progress.data ?? []);

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-card">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">{tree.data.course.title}</h2>
        <span className="text-sm font-semibold text-primary">{stats.percent}%</span>
      </div>
      <Progress value={stats.percent} className="mt-3" />
      <p className="mt-2 text-xs text-muted-foreground">
        {stats.completed} of {stats.total} lessons complete
      </p>
      <div className="mt-5 space-y-3">
        {stats.modules.map((m) => (
          <div key={m.id}>
            <div className="flex items-center justify-between text-sm">
              <span>{m.title}</span>
              <span className="text-muted-foreground">{m.percent}%</span>
            </div>
            <Progress value={m.percent} className="mt-1.5 h-1.5" />
          </div>
        ))}
      </div>
    </div>
  );
}
