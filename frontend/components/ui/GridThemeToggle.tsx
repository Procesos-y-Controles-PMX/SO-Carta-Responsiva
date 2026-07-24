"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

type GridThemeToggleProps = {
  /** Icon-only square for the collapsed sidebar. */
  compact?: boolean;
  className?: string;
};

/**
 * Prototype: theme control that reads as a Promexma mesh cell,
 * not a generic sun/moon button. Lit cell slides across a tiny lattice.
 */
export default function GridThemeToggle({ compact = false, className }: GridThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted ? resolvedTheme === "dark" : true;
  const label = isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro";

  function toggle() {
    setTheme(isDark ? "light" : "dark");
  }

  if (compact) {
    return (
      <button
        type="button"
        aria-label={label}
        title={isDark ? "Modo claro" : "Modo oscuro"}
        onClick={toggle}
        className={cn(
          "relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-sm",
          "border border-white/12 bg-[#0a0e14] text-white",
          "transition-colors hover:border-brand/50 hover:bg-white/[0.04]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
          className,
        )}
      >
        <LatticeBg className="opacity-40" />
        <span
          className={cn(
            "relative z-10 flex h-4 w-4 items-center justify-center",
            "bg-brand/90 text-white shadow-[0_0_12px_-2px_rgba(237,28,36,0.85)]",
            "ring-1 ring-brand/60",
          )}
        >
          {isDark ? <MoonGlyph /> : <SunGlyph />}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      title={isDark ? "Modo claro" : "Modo oscuro"}
      onClick={toggle}
      className={cn(
        "group relative flex w-full items-center gap-3 overflow-hidden rounded-sm",
        "border border-white/12 bg-[#0a0e14] px-3 py-2.5 text-left",
        "transition-colors hover:border-white/20 hover:bg-white/[0.03]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40",
        className,
      )}
    >
      <LatticeBg className="opacity-[0.28]" />

      <div className="relative z-10 min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-fg-subtle">
          Apariencia
        </p>
        <p className="mt-0.5 text-xs font-semibold text-fg-faint">
          {mounted ? (isDark ? "Modo oscuro" : "Modo claro") : "Tema"}
        </p>
      </div>

      {/* Track: 2×5 cell mesh; thumb = lit brand cell */}
      <div
        className="relative z-10 h-8 w-[4.5rem] shrink-0 overflow-hidden rounded-[2px] border border-white/10 bg-[#070a0e]"
        aria-hidden
      >
        <div
          className="absolute inset-0 grid grid-cols-5 grid-rows-2 gap-px p-px"
          style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
        >
          {Array.from({ length: 10 }, (_, i) => (
            <span key={i} className="bg-[#0d1117]" />
          ))}
        </div>
        <span
          className={cn(
            "absolute z-10 flex h-[14px] w-[14px] items-center justify-center",
            "bg-brand text-white",
            "shadow-[0_0_14px_-1px_rgba(237,28,36,0.9)]",
            "transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
            "group-hover:shadow-[0_0_18px_0_rgba(237,28,36,0.95)]",
            isDark ? "translate-x-[54px] translate-y-[15px]" : "translate-x-[2px] translate-y-[2px]",
          )}
        >
          {isDark ? <MoonGlyph className="h-2.5 w-2.5" /> : <SunGlyph className="h-2.5 w-2.5" />}
        </span>
      </div>
    </button>
  );
}

function LatticeBg({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-0",
        "[background-image:linear-gradient(to_right,rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.07)_1px,transparent_1px)]",
        "[background-size:10px_10px]",
        "[mask-image:radial-gradient(ellipse_90%_80%_at_70%_50%,black,transparent)]",
        className,
      )}
    />
  );
}

function SunGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      className={cn("h-3.5 w-3.5", className)}
      aria-hidden
    >
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.1 5.1l1.6 1.6M17.3 17.3l1.6 1.6M5.1 18.9l1.6-1.6M17.3 6.7l1.6-1.6" />
    </svg>
  );
}

function MoonGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-3.5 w-3.5", className)}
      aria-hidden
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />
    </svg>
  );
}
