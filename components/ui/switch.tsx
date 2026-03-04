"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

type SwitchProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> & {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

const Switch = React.forwardRef<HTMLButtonElement, SwitchProps>(
  ({ checked = false, disabled, className, onClick, onCheckedChange, ...props }, ref) => (
    <button
      {...props}
      ref={ref}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      data-state={checked ? "checked" : "unchecked"}
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-transparent transition-colors outline-none",
        "focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        checked ? "bg-primary justify-end" : "bg-muted justify-start",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || disabled) return;
        onCheckedChange?.(!checked);
      }}
    >
      <span
        className={cn(
          "bg-background pointer-events-none block size-4 rounded-full shadow-sm transition-transform",
          checked ? "-translate-x-0.5" : "translate-x-0.5",
        )}
      />
    </button>
  ),
);

Switch.displayName = "Switch";

export { Switch };
