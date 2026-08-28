import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function LoadingSpinner({ size = 24, fullscreen = false, className }: { size?: number; fullscreen?: boolean; className?: string }) {
  const spinner = <Loader2 size={size} className={cn("animate-spin text-aurora-cyan", className)} />;

  if (fullscreen) {
    return <div className="flex h-full min-h-[200px] w-full items-center justify-center">{spinner}</div>;
  }
  return spinner;
}
