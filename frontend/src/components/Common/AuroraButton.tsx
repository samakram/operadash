import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuroraButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  icon?: ReactNode;
}

const sizeMap = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2.5 text-sm",
  lg: "px-6 py-3 text-base",
};

const variantClass = {
  primary: "aurora-button",
  ghost: "aurora-button aurora-button--ghost",
  danger: "aurora-button aurora-button--danger",
};

export function AuroraButton({
  children,
  variant = "primary",
  size = "md",
  isLoading = false,
  icon,
  disabled,
  className,
  ...rest
}: AuroraButtonProps) {
  return (
    <button
      className={cn(variantClass[variant], sizeMap[size], "inline-flex items-center justify-center gap-2", className)}
      disabled={disabled || isLoading}
      {...rest}
    >
      {isLoading ? <Loader2 size={16} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}
