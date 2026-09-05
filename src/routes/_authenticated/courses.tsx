import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Clock } from "lucide-react";
import { toast } from "sonner";
import { enroll, fetchCourses, fetchEnrollments } from "@/lib/learn";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/courses")({
  head: () => ({
    meta: [
      { title: "Course library — Arete Learn" },
      { name: "description", content: "Browse and join Arete Academia courses." },
      { property: "og:title", content: "Course library — Arete Learn" },
      { property: "og:description", content: "Browse and join Arete Academia courses." },
    ],
  }),
  component: CourseLibrary,
});

function CourseLibrary() {
  const qc = useQueryClient();
  const courses = useQuery({ queryKey: ["courses"], queryFn: fetchCourses });
  const enrolled = useQuery({ queryKey: ["enrollments"], queryFn: fetchEnrollments });

  const join = useMutation({
    mutationFn: enroll,
    onSuccess: () => {
      toast.success("You're enrolled. Happy learning!");
      qc.invalidateQueries({ queryKey: ["enrollments"] });
    },
    onError: () => toast.error("We couldn't enrol you right now. Please try again."),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold md:text-3xl">Course library</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every Arete Academia programme available to you.
        </p>
      </div>

      {courses.isLoading && (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {(courses.data ?? []).map((course) => {
          const isEnrolled = (enrolled.data ?? []).includes(course.id);
          return (
            <div key={course.id} className="flex flex-col rounded-2xl border bg-card p-6 shadow-card">
              <span className="w-fit rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                {course.category}
              </span>
              <h2 className="mt-3 text-lg font-semibold">{course.title}</h2>
              <p className="mt-2 flex-1 text-sm text-muted-foreground">{course.description}</p>
              <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="size-3.5" /> {course.duration_weeks} weeks
                </span>
                <span className="flex items-center gap-1">
                  <BookOpen className="size-3.5" /> Self-paced
                </span>
              </div>
              <div className="mt-5 flex gap-2">
                {isEnrolled ? (
                  <Button asChild className="flex-1">
                    <Link to="/courses/$slug" params={{ slug: course.slug }}>
                      Open course
                    </Link>
                  </Button>
                ) : (
                  <Button
                    className="flex-1"
                    disabled={join.isPending}
                    onClick={() => join.mutate(course.id)}
                  >
                    Enrol
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
