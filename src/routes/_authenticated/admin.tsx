import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { fetchCourses, fetchCourseTree, isStaff } from "@/lib/learn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Admin — Arete Learn" },
      { name: "description", content: "Manage students, lessons, resources and announcements." },
      { property: "og:title", content: "Admin — Arete Learn" },
      { property: "og:description", content: "Manage students, lessons, resources and announcements." },
    ],
  }),
  component: AdminPage,
});

async function fetchAdminStats() {
  const [students, enrollments, lessons, completions, activity] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email, created_at").order("created_at", { ascending: false }),
    supabase.from("enrollments").select("id", { count: "exact", head: true }),
    supabase.from("lessons").select("id", { count: "exact", head: true }),
    supabase.from("lesson_progress").select("id", { count: "exact", head: true }).eq("completed", true),
    supabase.from("learning_activity").select("user_id, activity_date"),
  ]);
  const since = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const weeklyActive = new Set(
    (activity.data ?? []).filter((a) => a.activity_date >= since).map((a) => a.user_id),
  ).size;
  return {
    students: students.data ?? [],
    enrollments: enrollments.count ?? 0,
    lessons: lessons.count ?? 0,
    completions: completions.count ?? 0,
    weeklyActive,
  };
}

function AdminPage() {
  const staff = useQuery({ queryKey: ["is-staff"], queryFn: isStaff });

  if (staff.isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;
  if (!staff.data) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border bg-card p-10 text-center shadow-card">
        <h1 className="text-lg font-semibold">Admin access only</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This area is limited to instructors and administrators.
        </p>
      </div>
    );
  }
  return <AdminContent />;
}

function AdminContent() {
  const stats = useQuery({ queryKey: ["admin-stats"], queryFn: fetchAdminStats });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold md:text-3xl">Admin dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Students, content and announcements.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          ["Students", stats.data?.students.length ?? 0],
          ["Weekly active", stats.data?.weeklyActive ?? 0],
          ["Enrolments", stats.data?.enrollments ?? 0],
          ["Lessons", stats.data?.lessons ?? 0],
          ["Completions", stats.data?.completions ?? 0],
        ].map(([label, value]) => (
          <div key={label as string} className="rounded-2xl border bg-card p-5 shadow-card">
            <p className="font-display text-2xl font-semibold">{value as number}</p>
            <p className="text-xs text-muted-foreground">{label as string}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="content">
        <TabsList>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="students">Students</TabsTrigger>
          <TabsTrigger value="announce">Announcements</TabsTrigger>
        </TabsList>

        <TabsContent value="content" className="mt-4 space-y-4">
          <ContentManager />
        </TabsContent>

        <TabsContent value="students" className="mt-4">
          <div className="rounded-2xl border bg-card p-6 shadow-card">
            <h2 className="text-base font-semibold">Students</h2>
            <ul className="mt-3 divide-y">
              {(stats.data?.students ?? []).map((s) => (
                <li key={s.id} className="flex items-center justify-between py-3 text-sm">
                  <div>
                    <p className="font-medium">{s.full_name || "Unnamed student"}</p>
                    <p className="text-xs text-muted-foreground">{s.email}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(s.created_at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="announce" className="mt-4">
          <Announcer students={(stats.data?.students ?? []).map((s) => s.id)} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ContentManager() {
  const qc = useQueryClient();
  const courses = useQuery({ queryKey: ["courses"], queryFn: fetchCourses });
  const [slug, setSlug] = useState<string>("");
  const activeSlug = slug || courses.data?.[0]?.slug || "";
  const tree = useQuery({
    queryKey: ["course-tree", activeSlug],
    queryFn: () => fetchCourseTree(activeSlug),
    enabled: !!activeSlug,
  });

  const [moduleId, setModuleId] = useState("");
  const [lesson, setLesson] = useState({ title: "", description: "", content: "", duration: "20" });
  const [lessonId, setLessonId] = useState("");
  const [resource, setResource] = useState({ name: "", url: "", type: "pdf", downloadable: true });

  const addLesson = useMutation({
    mutationFn: async () => {
      const target = moduleId || tree.data?.modules[0]?.id;
      if (!target) throw new Error("Pick a module");
      const count = tree.data?.modules.find((m) => m.id === target)?.lessons.length ?? 0;
      const { error } = await supabase.from("lessons").insert({
        module_id: target,
        title: lesson.title,
        description: lesson.description,
        content: lesson.content,
        duration_minutes: Number(lesson.duration) || 20,
        sort_order: count + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lesson added.");
      setLesson({ title: "", description: "", content: "", duration: "20" });
      qc.invalidateQueries({ queryKey: ["course-tree"] });
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't add the lesson."),
  });

  const addResource = useMutation({
    mutationFn: async () => {
      if (!lessonId) throw new Error("Pick a lesson");
      const { error } = await supabase.from("lesson_resources").insert({
        lesson_id: lessonId,
        name: resource.name,
        file_url: resource.url,
        file_type: resource.type,
        downloadable: resource.downloadable,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Resource attached.");
      setResource({ name: "", url: "", type: "pdf", downloadable: true });
      qc.invalidateQueries({ queryKey: ["lesson-resources"] });
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't attach the resource."),
  });

  const allLessons = (tree.data?.modules ?? []).flatMap((m) =>
    m.lessons.map((l) => ({ ...l, moduleTitle: m.title })),
  );

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-6 shadow-card">
        <Label>Course</Label>
        <Select value={activeSlug} onValueChange={setSlug}>
          <SelectTrigger className="mt-2">
            <SelectValue placeholder="Select a course" />
          </SelectTrigger>
          <SelectContent>
            {(courses.data ?? []).map((c) => (
              <SelectItem key={c.id} value={c.slug}>
                {c.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <form
        className="space-y-4 rounded-2xl border bg-card p-6 shadow-card"
        onSubmit={(e) => {
          e.preventDefault();
          addLesson.mutate();
        }}
      >
        <h2 className="text-base font-semibold">Add a lesson</h2>
        <div className="space-y-2">
          <Label>Module</Label>
          <Select value={moduleId} onValueChange={setModuleId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a module" />
            </SelectTrigger>
            <SelectContent>
              {(tree.data?.modules ?? []).map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="lt">Title</Label>
          <Input id="lt" required value={lesson.title} onChange={(e) => setLesson({ ...lesson, title: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ld">Short description</Label>
          <Input id="ld" value={lesson.description} onChange={(e) => setLesson({ ...lesson, description: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lc">Lesson content</Label>
          <Textarea id="lc" rows={4} value={lesson.content} onChange={(e) => setLesson({ ...lesson, content: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lm">Duration (minutes)</Label>
          <Input id="lm" type="number" min="1" value={lesson.duration} onChange={(e) => setLesson({ ...lesson, duration: e.target.value })} />
        </div>
        <Button type="submit" disabled={addLesson.isPending}>
          Add lesson
        </Button>
      </form>

      <form
        className="space-y-4 rounded-2xl border bg-card p-6 shadow-card"
        onSubmit={(e) => {
          e.preventDefault();
          addResource.mutate();
        }}
      >
        <h2 className="text-base font-semibold">Attach a resource</h2>
        <div className="space-y-2">
          <Label>Lesson</Label>
          <Select value={lessonId} onValueChange={setLessonId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a lesson" />
            </SelectTrigger>
            <SelectContent>
              {allLessons.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  {l.moduleTitle} — {l.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="rn">File name</Label>
          <Input id="rn" required value={resource.name} onChange={(e) => setResource({ ...resource, name: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ru">File link</Label>
          <Input id="ru" required type="url" value={resource.url} onChange={(e) => setResource({ ...resource, url: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Access</Label>
          <Select
            value={resource.downloadable ? "download" : "view"}
            onValueChange={(v) => setResource({ ...resource, downloadable: v === "download" })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="download">Downloadable</SelectItem>
              <SelectItem value="view">View only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={addResource.isPending}>
          Attach resource
        </Button>
      </form>
    </div>
  );
}

function Announcer({ students }: { students: string[] }) {
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");

  const send = useMutation({
    mutationFn: async () => {
      if (!students.length) throw new Error("No students to notify yet");
      const rows = students.map((id) => ({
        user_id: id,
        title,
        message,
        type: "announcement",
      }));
      const { error } = await supabase.from("notifications").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Announcement sent to all students.");
      setTitle("");
      setMessage("");
    },
    onError: (e: Error) => toast.error(e.message || "Couldn't send the announcement."),
  });

  return (
    <form
      className="space-y-4 rounded-2xl border bg-card p-6 shadow-card"
      onSubmit={(e) => {
        e.preventDefault();
        send.mutate();
      }}
    >
      <h2 className="text-base font-semibold">Send an announcement</h2>
      <div className="space-y-2">
        <Label htmlFor="at">Title</Label>
        <Input id="at" required value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="am">Message</Label>
        <Textarea id="am" rows={4} required value={message} onChange={(e) => setMessage(e.target.value)} />
      </div>
      <Button type="submit" disabled={send.isPending}>
        Send to all students
      </Button>
    </form>
  );
}
