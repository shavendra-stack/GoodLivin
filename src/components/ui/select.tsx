import * as React from "react";
import { cn } from "@/lib/utils";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn("h-12 w-full rounded-xl border border-forest-100 bg-white px-3.5 text-sm text-ink shadow-sm outline-none transition-all focus:border-forest-500 focus:ring-4 focus:ring-forest-100/70", className)} {...props} />
));
Select.displayName = "Select";
