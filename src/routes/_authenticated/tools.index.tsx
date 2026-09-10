import { createFileRoute } from "@tanstack/react-router";
import { Download, ExternalLink, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/tools")({
  head: () => ({
    meta: [
      { title: "Tools & downloads — Arete Learn" },
      {
        name: "description",
        content:
          "Download Power BI, PostgreSQL, Excel and set up Python for your Arete Academia data analysis courses.",
      },
      { property: "og:title", content: "Tools & downloads — Arete Learn" },
      {
        property: "og:description",
        content:
          "Download Power BI, PostgreSQL, Excel and set up Python for your Arete Academia data analysis courses.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ToolsPage,
});

type ToolLink = {
  label: string;
  url: string;
  kind: "download" | "video" | "folder";
};

type Tool = {
  name: string;
  blurb: string;
  links: ToolLink[];
};

const tools: Tool[] = [
  {
    name: "Power BI",
    blurb: "Power BI Desktop for the Power BI, DAX and visualisation courses.",
    links: [
      {
        label: "Download Power BI Desktop",
        url: "https://www.microsoft.com/en-us/power-platform/products/power-bi/desktop",
        kind: "download",
      },
    ],
  },
  {
    name: "SQL (PostgreSQL)",
    blurb: "PostgreSQL is the database used throughout the SQL course.",
    links: [
      {
        label: "Download PostgreSQL",
        url: "https://www.enterprisedb.com/downloads/postgres-postgresql-downloads",
        kind: "download",
      },
      {
        label: "Watch: how to install PostgreSQL",
        url: "https://youtu.be/T1PrXly6kOs?si=UfHZJo7O2I3Csxk6",
        kind: "video",
      },
    ],
  },
  {
    name: "Excel",
    blurb: "Microsoft Excel via Microsoft 365 for all Excel modules.",
    links: [
      {
        label: "Download Microsoft 365 / Excel",
        url: "https://www.microsoft.com/en-us/microsoft-365/download-office?utm_source",
        kind: "download",
      },
    ],
  },
  {
    name: "Python",
    blurb:
      "Setup instructions live in the Python folder of the Arete class content.",
    links: [
      {
        label: "Open the Python setup folder",
        url: "https://drive.google.com/drive/folders/1vn9UILmWcSOY5cSAsTrBxGtVcYnOLv4J?usp=drive_link",
        kind: "folder",
      },
    ],
  },
];

const iconFor = (kind: ToolLink["kind"]) =>
  kind === "video" ? PlayCircle : kind === "folder" ? ExternalLink : Download;

function ToolsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold md:text-3xl">Tools &amp; downloads</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything you need installed for Excel, Power BI, SQL and Python. Tap a
          button to open the official download page.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {tools.map((tool) => (
          <div key={tool.name} className="flex flex-col rounded-2xl border bg-card p-6 shadow-card">
            <h2 className="text-lg font-semibold">{tool.name}</h2>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">{tool.blurb}</p>
            <div className="mt-4 space-y-2">
              {tool.links.map((link) => {
                const Icon = iconFor(link.kind);
                return (
                  <Button
                    key={link.url}
                    asChild
                    className="w-full justify-start"
                    variant={link.kind === "download" ? "default" : "secondary"}
                  >
                    <a href={link.url} target="_blank" rel="noreferrer">
                      <Icon className="mr-2 size-4" />
                      {link.label}
                    </a>
                  </Button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Trouble installing anything? Ask your instructor in class or send a message.
      </p>
    </div>
  );
}
