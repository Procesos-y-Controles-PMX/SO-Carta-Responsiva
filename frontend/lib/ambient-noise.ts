"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import type { NoiseFieldProps } from "@promexma/ui";

/**
 * Per-user in-app NoiseField knobs. Runtime catalog is Shared/CP table
 * `so_ambient_noise`. This map is only a first-paint / Equipo fallback.
 * Adding someone: upsert a row. No app deploy, no admin grant.
 */
export type AmbientNoiseTune = Pick<
  NoiseFieldProps,
  | "color"
  | "waveStrength"
  | "waveSeconds"
  | "waveLength"
  | "waveSharpness"
  | "waveFalloff"
  | "waveWarp"
  | "waveDirection"
  | "wave"
  | "driftX"
  | "gustAmplitude"
  | "gustSeconds"
  | "evolve"
  | "driftY"
  | "featureWidth"
  | "featureHeight"
  | "contrast"
  | "baseLevel"
  | "texture"
  | "octaveAmplitude"
  | "octaveFrequency"
  | "octaves"
  | "maxOpacity"
  | "minOpacity"
  | "cellWidth"
  | "cellHeight"
  | "gap"
  | "radius"
  | "pulse"
  | "pulseSeconds"
>;

export const AMBIENT_NOISE_PROFILES: Record<string, AmbientNoiseTune> = {
  "alejandra.rangel@ext.cemex.com": {
    color: [0, 66, 170],
    waveStrength: 0,
    waveSeconds: 8,
    waveLength: 1530,
    waveDirection: 1,
    driftX: 20,
    gustAmplitude: 20,
    gustSeconds: 1,
    evolve: 0.26,
    driftY: -9,
    featureWidth: 300,
    featureHeight: 150,
    contrast: 3,
    baseLevel: 0.4,
    texture: 0.5,
    octaveAmplitude: 0,
    octaveFrequency: 2.8,
    maxOpacity: 1,
    cellWidth: 15,
    cellHeight: 15,
    gap: 0,
    radius: 20,
  },
};

export function customAmbientNoise(
  email: string | null | undefined,
): AmbientNoiseTune | null {
  const key = (email ?? "").trim().toLowerCase();
  return AMBIENT_NOISE_PROFILES[key] ?? null;
}

export type CustomAmbientNoise = AmbientNoiseTune;

function parseAmbientTune(value: unknown): AmbientNoiseTune | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as AmbientNoiseTune;
}

function ambientClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/** DB row wins when present; local map is fallback if the table is missing. */
export function useCustomAmbientNoise(
  email: string | null | undefined,
): AmbientNoiseTune | null {
  const key = (email ?? "").trim().toLowerCase();
  const fallback = key ? customAmbientNoise(key) : null;
  const [tune, setTune] = useState<AmbientNoiseTune | null>(fallback);

  useEffect(() => {
    if (!key) {
      setTune(null);
      return;
    }
    setTune(customAmbientNoise(key));
    const sb = ambientClient();
    if (!sb) return;
    let cancelled = false;
    void sb
      .from("so_ambient_noise")
      .select("props")
      .eq("email", key)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error) return;
        const parsed = parseAmbientTune(data?.props);
        if (parsed) setTune(parsed);
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  return tune;
}

const BRAND_VAR_KEYS = [
  "--brand",
  "--brand-hover",
  "--brand-active",
  "--brand-tint",
] as const;

function clampByte(n: number) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function mixRgb(
  rgb: [number, number, number],
  toward: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    clampByte(rgb[0] + (toward[0] - rgb[0]) * t),
    clampByte(rgb[1] + (toward[1] - rgb[1]) * t),
    clampByte(rgb[2] + (toward[2] - rgb[2]) * t),
  ];
}

function toHex(rgb: [number, number, number]) {
  return `#${rgb.map((n) => clampByte(n).toString(16).padStart(2, "0")).join("")}`;
}

/** Map a NoiseField RGB onto clay `--brand*` tokens. */
export function brandVarsFromColor(
  color: [number, number, number],
): Record<(typeof BRAND_VAR_KEYS)[number], string> {
  const rgb: [number, number, number] = [
    clampByte(color[0]),
    clampByte(color[1]),
    clampByte(color[2]),
  ];
  const hover = mixRgb(rgb, [0, 0, 0], 0.16);
  const active = mixRgb(rgb, [0, 0, 0], 0.28);
  return {
    "--brand": toHex(rgb),
    "--brand-hover": toHex(hover),
    "--brand-active": toHex(active),
    "--brand-tint": `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.14)`,
  };
}

/** Retint brand chrome to the custom field color. Owner (no color) keeps red. */
export function useAmbientBrand(
  color: [number, number, number] | null | undefined,
) {
  const r = color?.[0];
  const g = color?.[1];
  const b = color?.[2];

  useEffect(() => {
    const root = document.documentElement;
    if (r == null || g == null || b == null) return;
    const vars = brandVarsFromColor([r, g, b]);
    for (const key of BRAND_VAR_KEYS) root.style.setProperty(key, vars[key]);
    return () => {
      for (const key of BRAND_VAR_KEYS) root.style.removeProperty(key);
    };
  }, [r, g, b]);
}
