import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-field w-full rounded-md border border-border bg-transparent px-3 text-body text-fg placeholder:text-subtle outline-none transition-colors duration-[var(--duration-base)] hover:border-border-strong focus-visible:border-border-strong focus-visible:ring-2 focus-visible:ring-accent/30",
        className,
      )}
      {...props}
    />
  );
}
