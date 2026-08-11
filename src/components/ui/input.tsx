import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn("h-12 w-full rounded-xl border border-forest-100 bg-white px-3.5 text-sm text-ink shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-forest-500 focus:ring-4 focus:ring-forest-100/70", className)} {...props} />
));
Input.displayName = "Input";
