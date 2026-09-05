import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpen, CheckCircle2, Flame, PlayCircle } from "lucide-react";
import {
  courseProgress,
  fetchActivity,
  fetchCourses,
  fetchCourseTree,
  fetchEnrollments,
  fetchProfile,
  fetchProgress,
  fetchStreak,
  todayIso,
} from "@/lib/learn";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Your dashboard — Arete Learn" },
      { name: "description", content: "Your course progress, streak and next lesson." },
      { property: "og:title", content: "Your dashboard — Arete Learn" },
      { property: "og:description", content: "Pick up your Data Analysis course where you left off." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const profile = useQuery({ queryKey: ["profile"], queryFn: fetchProfile });
  const courses = useQuery({ queryKey: ["courses"], queryFn: fetchCourses });
  const enrolled = useQuery({ queryKey: ["enrollments"], queryFn: fetchEnrollments });
  const progress = useQuery({ queryKey: ["progress"], queryFn: fetchProgress });
  const streak = useQuery({ queryKey: ["streak"], queryFn: fetchStreak });
  const activity = useQuery({ queryKey: ["activity"], queryFn: () => fetchActivity(14) });

  const activeCourse =
    (courses.data ?? []).find((c) => (enrolled.data ?? []).includes(c.id)) ?? null;

  const tree = useQuery({
    queryKey: ["course-tree", activeCourse?.slug],
    queryFn: () => fetchCourseTree(activeCourse!.slug),
    enabled: !!activeCourse,
  });

  const stats = tree.data ? courseProgress(tree.data, progress.data ?? []) : null;
  const learnedToday = (activity.data ?? []).some((a) => a.activity_date === todayIso());
  const firstName = (profile.data?.full_name || "there").split(" ")[0];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold md:text-3xl">Welcome back, {firstName} 👋</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {learnedToday
            ? "You've already learned today. Nice work keeping the habit."
            : "Spend at least 30 minutes learning today to keep your streak alive."}
        </p>
      </div>

      {!activeCourse && !courses.isLoading && (
        <div className="rounded-2xl border bg-card p-8 text-center shadow-card">
          <BookOpen className="mx-auto size-8 text-muted-foreground" />
          <h2 className="mt-3 text-lg font-semibold">You're not enrolled in a course yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse the course library and join your programme to start learning.
          </p>
          <Button asChild className="mt-5">
            <Link to="/courses">Browse courses</Link>
          </Button>
        </div>
      )}

      {activeCourse && (
        <div className="surface-gradient rounded-2xl p-6 text-navy-foreground shadow-lift md:p-8">
          <p className="text-xs font-medium uppercase tracking-wider text-navy-foreground/70">
            Continue learning
          </p>
          {stats?.nextLesson ? (
            <>
              <h2 className="mt-2 text-xl font-semibold md:text-2xl">{stats.nextLesson.title}</h2>
              <p className="mt-1 text-sm text-navy-foreground/75">
                {activeCourse.title} · {stats.nextLesson.duration_minutes} min
              </p>
              <Button asChild className="mt-6" size="lg">
                <Link to="/lesson/$lessonId" params={{ lessonId: stats.nextLesson.id }}>
                  Continue lesson <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
            </>
          ) : (
            <>
              <h2 className="mt-2 text-xl font-semibold md:text-2xl">
                {tree.isLoading ? "Loading your next lesson…" : "You've completed every lesson 🎉"}
              </h2>
              {!tree.isLoading && (
                <Button asChild variant="secondary" className="mt-6">
                  <Link to="/courses">Explore more courses</Link>
                </Button>
              )}
            </>
          )}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Flame className="size-5 text-warning" />}
          label="Learning streak"
          value={`${streak.data?.current_streak ?? 0} day${(streak.data?.current_streak ?? 0) === 1 ? "" : "s"}`}
          loading={streak.isLoading}
        />
        <StatCard
          icon={<CheckCircle2 className="size-5 text-success" />}
          label="Lessons completed"
          value={String((progress.data ?? []).filter((p) => p.completed).length)}
          loading={progress.isLoading}
        />
        <StatCard
          icon={<PlayCircle className="size-5 text-primary" />}
          label="Lessons remaining"
          value={stats ? String(stats.total - stats.completed) : "—"}
          loading={tree.isLoading}
        />
      </div>

      {stats && activeCourse && (
        <div className="rounded-2xl border bg-card p-6 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">{activeCourse.title}</h2>
            <span className="text-sm font-semibold text-primary">{stats.percent}%</span>
          </div>
          <Progress value={stats.percent} className="mt-3" />
          <p className="mt-2 text-xs text-muted-foreground">
            {stats.completed} of {stats.total} lessons complete
          </p>
          <div className="mt-5 space-y-3">
            {stats.modules.slice(0, 4).map((m) => (
              <div key={m.id}>
                <div className="flex items-center justify-between text-sm">
                  <span>{m.title}</span>
                  <span className="text-muted-foreground">{m.percent}%</span>
                </div>
                <Progress value={m.percent} className="mt-1.5 h-1.5" />
              </div>
            ))}
          </div>
          <Button asChild variant="secondary" className="mt-6 w-full">
            <Link to="/courses/$slug" params={{ slug: activeCourse.slug }}>
              Open course
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  loading?: boolean;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-card">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-7 w-20" />
      ) : (
        <p className="mt-2 font-display text-2xl font-semibold">{value}</p>
      )}
    </div>
  );
}
