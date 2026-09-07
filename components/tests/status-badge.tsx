import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, type TestStatus } from "@/lib/tests/status";
import { cn } from "@/lib/utils";

export function StatusBadge({ status, className }: { status: TestStatus; className?: string }) {
  if (status === "LIVE") {
    return (
      <Badge className={cn("gap-1.5 bg-green-600 text-white hover:bg-green-600", className)}>
        <span className="relative flex size-2">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-white" />
        </span>
        {STATUS_LABEL[status]}
      </Badge>
    );
  }
  return (
    <Badge variant={status === "SCHEDULED" ? "secondary" : "outline"} className={className}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}
