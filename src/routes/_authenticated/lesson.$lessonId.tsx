import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Download, Eye, FileText } from "lucide-react";
import { toast } from "sonner";
import {
  courseProgress,
  fetchCourseTree,
  fetchLesson,
  fetchLessonResources,
  fetchProgress,
  openLesson,
  setLessonComplete,
} from "@/lib/learn";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/lesson/$lessonId")({
  head: () => ({
    meta: [
      { title: "Lesson — Arete Learn" },
      { name: "description", content: "Study your lesson and download its resources." },
      { property: "og:title", content: "Lesson — Arete Learn" },
      { property: "og:description", content: "Study your lesson and download its resources." },
    ],
  }),
  component: LessonPage,
});

function LessonPage() {
  const { lessonId } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const lesson = useQuery({ queryKey: ["lesson", lessonId], queryFn: () => fetchLesson(lessonId) });
  const resources = useQuery({
    queryKey: ["lesson-resources", lessonId],
    queryFn: () => fetchLessonResources(lessonId),
  });
  const progress = useQuery({ queryKey: ["progress"], queryFn: fetchProgress });
  const slug = lesson.data?.modules?.courses?.slug;
  const tree = useQuery({
    queryKey: ["course-tree", slug],
    queryFn: () => fetchCourseTree(slug!),
    enabled: !!slug,
  });

  useEffect(() => {
    openLesson(lessonId).then(() => {
      qc.invalidateQueries({ queryKey: ["streak"] });
      qc.invalidateQueries({ queryKey: ["activity"] });
    });
  }, [lessonId, qc]);

  const completed = (progress.data ?? []).some((p) => p.lesson_id === lessonId && p.completed);

  const complete = useMutation({
    mutationFn: () => setLessonComplete(lessonId, !completed),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["progress"] });
      qc.invalidateQueries({ queryKey: ["streak"] });
      toast.success(completed ? "Marked as not completed" : "Lesson completed. Progress updated!");
      if (!completed && nextLesson) {
        navigate({ to: "/lesson/$lessonId", params: { lessonId: nextLesson.id } });
      }
    },
    onError: () => toast.error("We couldn't save that. Please try again."),
  });

  const allLessons = (tree.data?.modules ?? []).flatMap((m) => m.lessons);
  const index = allLessons.findIndex((l) => l.id === lessonId);
  const prevLesson = index > 0 ? allLessons[index - 1] : null;
  const nextLesson = index >= 0 && index < allLessons.length - 1 ? allLessons[index + 1] : null;
  const stats = tree.data ? courseProgress(tree.data, progress.data ?? []) : null;

  if (lesson.isLoading) return <Skeleton className="h-72 w-full rounded-2xl" />;
  if (!lesson.data) return <p className="text-muted-foreground">This lesson isn't available.</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {slug && (
        <Link
          to="/courses/$slug"
          params={{ slug }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> {lesson.data.modules.courses.title}
        </Link>
      )}

      <div className="rounded-2xl border bg-card p-6 shadow-card">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {lesson.data.modules.title} · {lesson.data.duration_minutes} min
        </p>
        <h1 className="mt-2 text-2xl font-semibold">{lesson.data.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{lesson.data.description}</p>

        {lesson.data.video_url && (
          <div className="mt-5 aspect-video overflow-hidden rounded-xl bg-muted">
            {/\.(mp4|webm|ogg|mov)(\?|$)/i.test(lesson.data.video_url) ? (
              <video
                src={lesson.data.video_url}
                title={lesson.data.title}
                className="size-full"
                controls
                playsInline
                preload="metadata"
              />
            ) : (
              <iframe
                src={lesson.data.video_url}
                title={lesson.data.title}
                className="size-full"
                allowFullScreen
              />
            )}
          </div>
        )}

        <div className="mt-5 whitespace-pre-line text-[15px] leading-relaxed">
          {lesson.data.content}
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-card">
        <h2 className="text-base font-semibold">Lesson resources</h2>
        {resources.isLoading && <Skeleton className="mt-4 h-16 w-full rounded-xl" />}
        {!resources.isLoading && (resources.data ?? []).length === 0 && (
          <p className="mt-2 text-sm text-muted-foreground">
            No files attached to this lesson yet.
          </p>
        )}
        <ul className="mt-3 space-y-2">
          {(resources.data ?? []).map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-3 rounded-xl border p-3"
            >
              <FileText className="size-5 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{r.name}</p>
                <p className="text-xs uppercase text-muted-foreground">
                  {r.file_type} · {r.file_size_kb} KB
                </p>
              </div>
              <Button asChild size="sm" variant={r.downloadable ? "default" : "secondary"}>
                <a
                  href={r.file_url}
                  target="_blank"
                  rel="noreferrer"
                  {...(r.downloadable ? { download: "" } : {})}
                >
                  {r.downloadable ? (
                    <>
                      <Download className="mr-1 size-4" /> Download
                    </>
                  ) : (
                    <>
                      <Eye className="mr-1 size-4" /> View
                    </>
                  )}
                </a>
              </Button>
            </li>
          ))}
        </ul>
      </div>

      <div className="sticky bottom-20 z-20 rounded-2xl border bg-card p-4 shadow-lift md:bottom-4">
        <Button
          className="w-full"
          size="lg"
          variant={completed ? "secondary" : "default"}
          disabled={complete.isPending}
          onClick={() => complete.mutate()}
        >
          <CheckCircle2 className="mr-2 size-4" />
          {completed ? "Completed — undo" : "Mark as completed"}
        </Button>
        {stats && (
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Course progress: {stats.percent}%
          </p>
        )}
        <div className="mt-3 flex justify-between gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={!prevLesson}
            onClick={() =>
              prevLesson && navigate({ to: "/lesson/$lessonId", params: { lessonId: prevLesson.id } })
            }
          >
            <ArrowLeft className="mr-1 size-4" /> Previous
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={!nextLesson}
            onClick={() =>
              nextLesson && navigate({ to: "/lesson/$lessonId", params: { lessonId: nextLesson.id } })
            }
          >
            Next <ArrowRight className="ml-1 size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
