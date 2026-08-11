"use client";

import { LoaderCircle } from "lucide-react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";

export function SubmitButton({ children, pendingLabel = "Saving…", ...props }: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return <Button {...props} type="submit" disabled={pending || props.disabled}>{pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}{pending ? pendingLabel : children}</Button>;
}
