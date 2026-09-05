import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, BellRing, BookOpen, Flame, GraduationCap, PlayCircle } from "lucide-react";
import heroImage from "@/assets/hero-analytics.jpg";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Arete Learn — Learn Data. Track Progress. Build Your Future." },
      {
        name: "description",
        content:
          "The Arete Academia learning platform for Data Analysis students: lessons, resources, progress tracking, streaks and daily learning reminders in one place.",
      },
      { property: "og:title", content: "Arete Learn — Learn Data. Track Progress." },
      {
        property: "og:description",
        content:
          "Lessons, downloadable resources, progress tracking and daily reminders for Arete Academia Data Analysis students.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: BookOpen,
    title: "Every lesson in one place",
    body: "Excel, SQL, Power BI, Python and AI — structured into modules you work through step by step.",
  },
  {
    icon: PlayCircle,
    title: "Continue learning",
    body: "Open the app and your next lesson is already waiting. No hunting through chat groups.",
  },
  {
    icon: BarChart3,
    title: "Real progress tracking",
    body: "See your percentage complete for the whole programme and for each module.",
  },
  {
    icon: Flame,
    title: "Learning streaks",
    body: "Build the habit. Every day you study counts towards your streak.",
  },
  {
    icon: BellRing,
    title: "Daily reminders",
    body: "Pick your study time and get nudged if a day slips by without learning.",
  },
  {
    icon: GraduationCap,
    title: "Downloadable resources",
    body: "Datasets, workbooks and slides attached to the lesson they belong to.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="size-5" />
          </span>
          <span className="font-display text-lg font-semibold">Arete Learn</span>
        </div>
        <Button asChild variant="secondary" size="sm">
          <Link to="/auth">Sign in</Link>
        </Button>
      </header>

      <section className="surface-gradient">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 md:grid-cols-2 md:py-24">
          <div>
            <p className="text-sm font-medium tracking-wide text-navy-foreground/70">
              Arete Academia
            </p>
            <h1 className="mt-3 text-4xl font-bold leading-tight text-navy-foreground md:text-5xl">
              Learn Data. <span className="text-gradient">Track Progress.</span> Build Your Future.
            </h1>
            <p className="mt-5 max-w-lg text-base text-navy-foreground/80">
              The learning home for Arete Academia Data Analysis students. Study your lessons,
              download your resources and watch your progress climb — all in one place.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to="/auth">Create your account</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/auth">I already have an account</Link>
              </Button>
            </div>
          </div>
          <img
            src={heroImage}
            alt="Data analytics dashboard with charts and trend lines"
            width={1600}
            height={1000}
            className="rounded-2xl shadow-lift"
          />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-2xl font-semibold md:text-3xl">Built around your daily learning loop</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Sign in, see where you stopped, finish a lesson, watch progress update — and come back
          tomorrow.
        </p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-2xl border bg-card p-6 shadow-card">
              <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary">
                <f.icon className="size-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t py-8 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Arete Academia · Arete Learn
      </footer>
    </div>
  );
}
