import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle, Clock } from "lucide-react";
import { courseProgress, fetchCourseTree, fetchProgress } from "@/lib/learn";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/_authenticated/courses/$slug")({
  head: () => ({
    meta: [
      { title: "Course — Arete Learn" },
      { name: "description", content: "Course modules, lessons and your progress." },
      { property: "og:title", content: "Course — Arete Learn" },
      { property: "og:description", content: "Course modules, lessons and your progress." },
    ],
  }),
  component: CourseDetail,
});

function CourseDetail() {
  const { slug } = Route.useParams();
  const tree = useQuery({ queryKey: ["course-tree", slug], queryFn: () => fetchCourseTree(slug) });
  const progress = useQuery({ queryKey: ["progress"], queryFn: fetchProgress });

  if (tree.isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (!tree.data) return <p className="text-muted-foreground">This course isn't available.</p>;

  const stats = courseProgress(tree.data, progress.data ?? []);
  const done = new Set((progress.data ?? []).filter((p) => p.completed).map((p) => p.lesson_id));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="rounded-2xl border bg-card p-6 shadow-card">
        <h1 className="text-2xl font-semibold">{tree.data.course.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{tree.data.course.description}</p>
        <div className="mt-5 flex items-center justify-between text-sm">
          <span className="font-medium">Your progress</span>
          <span className="font-semibold text-primary">{stats.percent}%</span>
        </div>
        <Progress value={stats.percent} className="mt-2" />
        <p className="mt-2 text-xs text-muted-foreground">
          {stats.completed} completed · {stats.total - stats.completed} remaining
        </p>
      </div>

      <Accordion type="multiple" defaultValue={[tree.data.modules[0]?.id ?? ""]} className="space-y-3">
        {tree.data.modules.map((m, i) => {
          const mStats = stats.modules.find((x) => x.id === m.id)!;
          return (
            <AccordionItem
              key={m.id}
              value={m.id}
              className="rounded-2xl border bg-card px-5 shadow-card"
            >
              <AccordionTrigger className="hover:no-underline">
                <div className="flex w-full items-center gap-3 pr-3 text-left">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-sm font-semibold text-secondary-foreground">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{m.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {mStats.completed}/{mStats.total} lessons · {mStats.percent}%
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-1 pb-2">
                  {m.lessons.map((l) => (
                    <li key={l.id}>
                      <Link
                        to="/lesson/$lessonId"
                        params={{ lessonId: l.id }}
                        className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-secondary"
                      >
                        {done.has(l.id) ? (
                          <CheckCircle2 className="size-4 shrink-0 text-success" />
                        ) : (
                          <Circle className="size-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="flex-1 text-sm">{l.title}</span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="size-3" />
                          {l.duration_minutes}m
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
