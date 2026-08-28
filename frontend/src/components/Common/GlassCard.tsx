import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  interactive?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
}

const paddingMap = {
  none: "",
  sm: "p-4",
  md: "p-6",
  lg: "p-8",
};

export function GlassCard({ children, interactive = false, padding = "md", className, ...rest }: GlassCardProps) {
  return (
    <div
      className={cn("glass-card animate-fade-in", interactive && "glass-card--interactive cursor-pointer", paddingMap[padding], className)}
      {...rest}
    >
      {children}
    </div>
  );
}
