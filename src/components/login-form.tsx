"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LockKeyhole, Mail } from "lucide-react";
import { isDemoMode } from "@/lib/config";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setError("Supabase is not configured. Add the values from .env.example, or enable the local demo workspace.");
      setLoading(false);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return <div><div className="mb-5">{isDemoMode() ? <Badge tone="warning">Demo mode enabled</Badge> : <Badge tone="sage">Protected by Supabase Auth</Badge>}</div><form className="space-y-4" onSubmit={handleSubmit}><label className="block"><span className="mb-2 block text-sm font-semibold text-ink">Work email</span><div className="relative"><Mail className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" /><Input required type="email" autoComplete="email" placeholder="you@goodlivin.lk" className="pl-10" value={email} onChange={(event) => setEmail(event.target.value)} /></div></label><label className="block"><span className="mb-2 block text-sm font-semibold text-ink">Password</span><div className="relative"><LockKeyhole className="pointer-events-none absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" /><Input required type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Enter your password" className="pl-10 pr-11" value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" className="absolute right-3 top-3 rounded-md text-slate-400 hover:text-forest-700" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></div></label>{error ? <p className="rounded-xl border border-red-100 bg-red-50 px-3.5 py-3 text-sm leading-6 text-red-700" role="alert">{error}</p> : null}<Button className="mt-2 w-full" size="lg" type="submit" disabled={loading}>{loading ? "Signing in…" : "Sign in"}</Button></form><p className="mt-6 text-center text-xs leading-5 text-slate-400">Access is managed by your GoodLivin administrator. Never share your password.</p></div>;
}
