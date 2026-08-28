import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface FieldWrapperProps {
  label?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}

function FieldWrapper({ label, error, hint, children }: FieldWrapperProps) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      {label && <span className="font-medium text-aurora-text/90">{label}</span>}
      {children}
      {error ? <span className="text-xs text-aurora-error">{error}</span> : hint ? <span className="text-xs text-aurora-text/50">{hint}</span> : null}
    </label>
  );
}

interface GlassInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const GlassInput = forwardRef<HTMLInputElement, GlassInputProps>(function GlassInput(
  { label, error, hint, className, ...rest },
  ref,
) {
  return (
    <FieldWrapper label={label} error={error} hint={hint}>
      <input
        ref={ref}
        className={cn(
          "glass-input w-full px-3.5 py-2.5 text-aurora-text placeholder:text-aurora-text/40",
          error && "border-aurora-error/70",
          className,
        )}
        {...rest}
      />
    </FieldWrapper>
  );
});

interface GlassTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const GlassTextarea = forwardRef<HTMLTextAreaElement, GlassTextareaProps>(function GlassTextarea(
  { label, error, hint, className, ...rest },
  ref,
) {
  return (
    <FieldWrapper label={label} error={error} hint={hint}>
      <textarea
        ref={ref}
        className={cn("glass-input w-full px-3.5 py-2.5 text-aurora-text placeholder:text-aurora-text/40", className)}
        {...rest}
      />
    </FieldWrapper>
  );
});

interface GlassSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const GlassSelect = forwardRef<HTMLSelectElement, GlassSelectProps>(function GlassSelect(
  { label, error, hint, className, options, placeholder, ...rest },
  ref,
) {
  return (
    <FieldWrapper label={label} error={error} hint={hint}>
      <select ref={ref} className={cn("glass-input w-full px-3.5 py-2.5 text-aurora-text", className)} {...rest}>
        {placeholder && (
          <option value="" disabled className="bg-aurora-bg">
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-aurora-bg">
            {opt.label}
          </option>
        ))}
      </select>
    </FieldWrapper>
  );
});
