"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("goodlivin-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const nextDark = saved ? saved === "dark" : prefersDark;
    document.documentElement.classList.toggle("dark", nextDark);
    setDark(nextDark);
  }, []);

  function toggle() {
    const nextDark = !dark;
    document.documentElement.classList.toggle("dark", nextDark);
    window.localStorage.setItem("goodlivin-theme", nextDark ? "dark" : "light");
    setDark(nextDark);
  }

  return <Button type="button" variant="ghost" size="sm" aria-label={dark ? "Use light theme" : "Use dark theme"} title={dark ? "Use light theme" : "Use dark theme"} onClick={toggle}>{dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}<span className="sr-only">{dark ? "Use light theme" : "Use dark theme"}</span></Button>;
}
