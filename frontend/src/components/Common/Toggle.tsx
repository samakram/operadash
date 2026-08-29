import { cn } from "@/lib/utils";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  size?: "sm" | "md";
}

const trackSize = { sm: "h-5 w-9", md: "h-7 w-12" };
const knobSize = { sm: "h-4 w-4", md: "h-6 w-6" };
const knobTravel = { sm: "translate-x-4", md: "translate-x-5" };

/** An iOS-style pill switch — used everywhere a plain checkbox represents an on/off state. */
export function Toggle({ checked, onChange, label, disabled, size = "md" }: ToggleProps) {
  const switchEl = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex shrink-0 items-center rounded-full transition-colors duration-300 ease-in-out",
        "shadow-inner focus:outline-none focus-visible:ring-2 focus-visible:ring-aurora-cyan/50",
        trackSize[size],
        checked ? "bg-aurora-accent" : "bg-black/15",
        disabled && "cursor-not-allowed opacity-40",
      )}
    >
      <span
        className={cn(
          "inline-block transform rounded-full bg-white shadow-md transition-transform duration-300 ease-in-out",
          knobSize[size],
          checked ? knobTravel[size] : "translate-x-0.5",
        )}
      />
    </button>
  );

  if (!label) return switchEl;

  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
      <span>{label}</span>
      {switchEl}
    </label>
  );
}
