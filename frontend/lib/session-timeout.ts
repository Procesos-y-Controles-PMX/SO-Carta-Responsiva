"use client";

import { useEffect, useRef } from "react";

/** 30 minutes without interaction → logout */
export const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

/** 8 hours from login → logout even if active (matches server cookie TTL) */
export const ABSOLUTE_TIMEOUT_MS = 8 * 60 * 60 * 1000;

const ACTIVITY_THROTTLE_MS = 15_000;
const CHECK_INTERVAL_MS = 30_000;

const ACTIVITY_EVENTS = [
  "mousedown",
  "mousemove",
  "keydown",
  "touchstart",
  "scroll",
] as const;

export type SessionTimestamps = {
  issuedAt: number;
  lastActivityAt: number;
};

export type SessionExpiryReason = "idle" | "absolute";

export function createSessionTimestamps(now = Date.now()): SessionTimestamps {
  return { issuedAt: now, lastActivityAt: now };
}

export function getSessionExpiryReason(
  timestamps: SessionTimestamps,
  now = Date.now()
): SessionExpiryReason | null {
  if (now - timestamps.issuedAt >= ABSOLUTE_TIMEOUT_MS) return "absolute";
  if (now - timestamps.lastActivityAt >= IDLE_TIMEOUT_MS) return "idle";
  return null;
}

export function touchSessionActivity(
  timestamps: SessionTimestamps,
  now = Date.now()
): SessionTimestamps {
  return { ...timestamps, lastActivityAt: now };
}

type UseSessionTimeoutOptions = {
  enabled: boolean;
  getTimestamps: () => SessionTimestamps | null;
  setTimestamps: (timestamps: SessionTimestamps) => void;
  onExpire: (reason: SessionExpiryReason) => void;
};

/**
 * Watches activity and forces logout on idle (30m) or absolute (8h) expiry.
 * Checks on an interval and when the tab becomes visible again (covers sleeping laptops).
 */
export function useSessionTimeout({
  enabled,
  getTimestamps,
  setTimestamps,
  onExpire,
}: UseSessionTimeoutOptions): void {
  const getRef = useRef(getTimestamps);
  const setRef = useRef(setTimestamps);
  const onExpireRef = useRef(onExpire);
  getRef.current = getTimestamps;
  setRef.current = setTimestamps;
  onExpireRef.current = onExpire;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const check = () => {
      const timestamps = getRef.current();
      if (!timestamps) return;
      const reason = getSessionExpiryReason(timestamps);
      if (reason) onExpireRef.current(reason);
    };

    let lastTouchWrite = 0;
    const onActivity = () => {
      const now = Date.now();
      if (now - lastTouchWrite < ACTIVITY_THROTTLE_MS) return;
      lastTouchWrite = now;

      const timestamps = getRef.current();
      if (!timestamps) return;

      const reason = getSessionExpiryReason(timestamps, now);
      if (reason) {
        onExpireRef.current(reason);
        return;
      }
      setRef.current(touchSessionActivity(timestamps, now));
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") check();
    };

    check();
    const intervalId = window.setInterval(check, CHECK_INTERVAL_MS);
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(intervalId);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity);
      }
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled]);
}
