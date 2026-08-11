import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn("min-h-28 w-full rounded-xl border border-forest-100 bg-white px-3.5 py-3 text-sm text-ink shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-forest-500 focus:ring-4 focus:ring-forest-100/70", className)} {...props} />
));
Textarea.displayName = "Textarea";
