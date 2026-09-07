"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme, type ThemeMode } from "./useTheme";

export function ThemeToggle() {
  const { mode, setTheme, hasStored } = useTheme();
  // Avoid hydration mismatch: render a placeholder until the client has read
  // the actual stored / system preference.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isDark = mounted && mode === "dark";

  return (
    <div
      role="group"
      aria-label="Theme"
      className="inline-flex items-center gap-1 rounded-full border rule bg-[color:var(--surface)] p-1"
    >
      <ThemeOption
        active={isDark ? false : true}
        label="Light"
        onClick={() => setTheme("light")}
      >
        <Sun className="h-3.5 w-3.5" />
      </ThemeOption>
      <ThemeOption
        active={isDark}
        label="Dark"
        onClick={() => setTheme("dark")}
      >
        <Moon className="h-3.5 w-3.5" />
      </ThemeOption>
      {!hasStored && mounted && (
        <span
          className="ml-1 hidden text-[10px] uppercase tracking-[0.2em] text-[color:var(--ink-faint)] sm:inline"
          title="Following your system preference"
        >
          auto
        </span>
      )}
    </div>
  );
}

function ThemeOption({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={
        "grid h-7 w-7 place-items-center rounded-full transition " +
        (active
          ? "bg-[color:var(--ink)] text-[color:var(--paper)] shadow-sm"
          : "text-[color:var(--ink-soft)] hover:text-[color:var(--ink)]")
      }
    >
      {children}
    </button>
  );
}

export function ThemeBadge({ mode }: { mode: ThemeMode }) {
  return (
    <span className="tag">
      {mode === "dark" ? (
        <>
          <Moon className="h-3.5 w-3.5" /> Dark
        </>
      ) : (
        <>
          <Sun className="h-3.5 w-3.5" /> Light
        </>
      )}
    </span>
  );
}
