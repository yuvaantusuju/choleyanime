"use client";

import { useCallback, useEffect, useState } from "react";

export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "choleyanime-theme";

function applyMode(mode: ThemeMode) {
  const root = document.documentElement;
  if (mode === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  root.dataset.theme = mode;
  root.style.colorScheme = mode;
}

function getSystemMode(): ThemeMode {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function getInitialMode(): ThemeMode {
  if (typeof document === "undefined") return "light";
  // The bootstrap script in <head> already set the class, so read from it
  // rather than re-deriving — guarantees a single source of truth.
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(getInitialMode);
  const [hasStored, setHasStored] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem(STORAGE_KEY) !== null;
    } catch {
      return false;
    }
  });

  // Persist whenever the user explicitly changes the theme.
  const setTheme = useCallback((next: ThemeMode) => {
    applyMode(next);
    setMode(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
      setHasStored(true);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(mode === "dark" ? "light" : "dark");
  }, [mode, setTheme]);

  // Track system preference changes — only react to them if the user has
  // never explicitly chosen a theme. This keeps "auto" behaviour intuitive.
  useEffect(() => {
    if (hasStored) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      const next: ThemeMode = e.matches ? "dark" : "light";
      applyMode(next);
      setMode(next);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [hasStored]);

  return { mode, setTheme, toggleTheme, hasStored };
}
