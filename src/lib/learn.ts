import { supabase } from "@/integrations/supabase/client";

export type Course = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  duration_weeks: number;
  is_published: boolean;
  sort_order: number;
};

export type Module = {
  id: string;
  course_id: string;
  title: string;
  description: string;
  sort_order: number;
};

export type Lesson = {
  id: string;
  module_id: string;
  title: string;
  description: string;
  content: string;
  video_url: string | null;
  duration_minutes: number;
  sort_order: number;
};

export type LessonResource = {
  id: string;
  lesson_id: string;
  name: string;
  file_type: string;
  file_url: string;
  file_size_kb: number;
  downloadable: boolean;
};

export type ProgressRow = {
  lesson_id: string;
  completed: boolean;
  completed_at: string | null;
  last_opened_at: string;
};

export const todayIso = () => new Date().toISOString().slice(0, 10);

export async function fetchCourses() {
  const { data, error } = await supabase
    .from("courses")
    .select("*")
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as Course[];
}

export async function fetchEnrollments() {
  const { data, error } = await supabase.from("enrollments").select("course_id");
  if (error) throw error;
  return (data ?? []).map((r) => r.course_id as string);
}

export async function enroll(courseId: string) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not signed in");
  const { error } = await supabase
    .from("enrollments")
    .insert({ course_id: courseId, user_id: auth.user.id });
  if (error) throw error;
}

export type CourseTree = {
  course: Course;
  modules: (Module & { lessons: Lesson[] })[];
};

export async function fetchCourseTree(slug: string): Promise<CourseTree> {
  const { data: course, error: cErr } = await supabase
    .from("courses")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (cErr) throw cErr;
  if (!course) throw new Error("Course not found");

  const { data: modules, error: mErr } = await supabase
    .from("modules")
    .select("*")
    .eq("course_id", course.id)
    .order("sort_order");
  if (mErr) throw mErr;

  const moduleIds = (modules ?? []).map((m) => m.id);
  const { data: lessons, error: lErr } = moduleIds.length
    ? await supabase
        .from("lessons")
        .select("*")
        .in("module_id", moduleIds)
        .order("sort_order")
    : { data: [], error: null };
  if (lErr) throw lErr;

  return {
    course: course as Course,
    modules: (modules ?? []).map((m) => ({
      ...(m as Module),
      lessons: ((lessons ?? []) as Lesson[]).filter((l) => l.module_id === m.id),
    })),
  };
}

export async function fetchProgress() {
  const { data, error } = await supabase
    .from("lesson_progress")
    .select("lesson_id, completed, completed_at, last_opened_at");
  if (error) throw error;
  return (data ?? []) as ProgressRow[];
}

export async function fetchLesson(lessonId: string) {
  const { data, error } = await supabase
    .from("lessons")
    .select("*, modules(*, courses(*))")
    .eq("id", lessonId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("Lesson not found");
  return data as Lesson & { modules: Module & { courses: Course } };
}

export async function fetchLessonResources(lessonId: string) {
  const { data, error } = await supabase
    .from("lesson_resources")
    .select("*")
    .eq("lesson_id", lessonId);
  if (error) throw error;
  return (data ?? []) as LessonResource[];
}

export async function recordActivity(activityType: string, lessonId?: string) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  await supabase.from("learning_activity").insert({
    user_id: auth.user.id,
    lesson_id: lessonId ?? null,
    activity_type: activityType,
    activity_date: todayIso(),
  });
}

export async function openLesson(lessonId: string) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  await supabase.from("lesson_progress").upsert(
    {
      user_id: auth.user.id,
      lesson_id: lessonId,
      last_opened_at: new Date().toISOString(),
    },
    { onConflict: "user_id,lesson_id", ignoreDuplicates: false },
  );
  await recordActivity("lesson_started", lessonId);
}

export async function setLessonComplete(lessonId: string, completed: boolean) {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) throw new Error("Not signed in");
  const { error } = await supabase.from("lesson_progress").upsert(
    {
      user_id: auth.user.id,
      lesson_id: lessonId,
      completed,
      completed_at: completed ? new Date().toISOString() : null,
      last_opened_at: new Date().toISOString(),
    },
    { onConflict: "user_id,lesson_id" },
  );
  if (error) throw error;
  if (completed) await recordActivity("lesson_completed", lessonId);
}

export async function fetchStreak() {
  const { data, error } = await supabase
    .from("learning_streaks")
    .select("current_streak, longest_streak, last_activity_date")
    .maybeSingle();
  if (error) throw error;
  return data ?? { current_streak: 0, longest_streak: 0, last_activity_date: null };
}

export async function fetchActivity(days = 30) {
  const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("learning_activity")
    .select("activity_date, activity_type, created_at")
    .gte("activity_date", since)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchProfile() {
  const { data, error } = await supabase.from("profiles").select("*").maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchNotifications() {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function isStaff() {
  const { data, error } = await supabase.from("user_roles").select("role");
  if (error) return false;
  return (data ?? []).some((r) => r.role === "admin" || r.role === "instructor");
}

export function courseProgress(tree: CourseTree, progress: ProgressRow[]) {
  const done = new Set(progress.filter((p) => p.completed).map((p) => p.lesson_id));
  const all = tree.modules.flatMap((m) => m.lessons);
  const completed = all.filter((l) => done.has(l.id)).length;
  return {
    total: all.length,
    completed,
    percent: all.length ? Math.round((completed / all.length) * 100) : 0,
    modules: tree.modules.map((m) => {
      const c = m.lessons.filter((l) => done.has(l.id)).length;
      return {
        id: m.id,
        title: m.title,
        total: m.lessons.length,
        completed: c,
        percent: m.lessons.length ? Math.round((c / m.lessons.length) * 100) : 0,
      };
    }),
    nextLesson: all.find((l) => !done.has(l.id)) ?? null,
  };
}
