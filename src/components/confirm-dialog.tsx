"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ConfirmDialog({ triggerLabel, title, description, confirmLabel = "Confirm", onConfirm }: { triggerLabel: string; title: string; description: string; confirmLabel?: string; onConfirm?: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>{triggerLabel}</Button>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex gap-3"><div className="rounded-full bg-amber-50 p-2 text-amber-700"><AlertTriangle className="h-5 w-5" /></div><div><h2 className="font-display text-lg font-bold text-ink" id="confirm-title">{title}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{description}</p></div></div>
            <div className="mt-6 flex justify-end gap-2"><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={() => { onConfirm?.(); setOpen(false); }}>{confirmLabel}</Button></div>
          </div>
        </div>
      ) : null}
    </>
  );
}
