import { BookOpen, Download, FileSpreadsheet, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ToolResource, ToolResourceKind } from "@/lib/tools";

const iconMap = {
  download: Download,
  video: PlayCircle,
  tutorial: BookOpen,
  template: FileSpreadsheet,
} as const;

const labelMap: Record<ToolResourceKind, string> = {
  download: "Download",
  video: "Watch video",
  tutorial: "Open tutorial",
  template: "Get template",
};

export function ResourceButton({ resource }: { resource: ToolResource }) {
  const Icon = iconMap[resource.kind] ?? Download;
  return (
    <Button
      asChild
      size="sm"
      className="w-full justify-start"
      variant={resource.kind === "download" ? "default" : "secondary"}
    >
      <a href={resource.url} target="_blank" rel="noreferrer">
        <Icon className="mr-2 size-4" />
        {labelMap[resource.kind]}
      </a>
    </Button>
  );
}
