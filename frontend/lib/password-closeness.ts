export type ClosenessKind = "n_a" | "typo" | "similar" | "unrelated";

export type PasswordCloseness = {
  closeness: ClosenessKind;
  distance: number | null;
  hint: string | null;
  attemptLen: number;
};

function isHashedPassword(password: string): boolean {
  if (password.startsWith("$2a$") || password.startsWith("$2b$") || password.startsWith("$2y$")) {
    return true;
  }
  return /^[0-9a-fA-F]{32,64}$/.test(password);
}

function levenshtein(a: string, b: string): number {
  const s = a.slice(0, 64);
  const t = b.slice(0, 64);
  const m = s.length;
  const n = t.length;
  const prev = new Array<number>(n + 1);
  const next = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    next[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      next[j] = Math.min(prev[j] + 1, next[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = next[j];
  }
  return prev[n];
}

/** Compare attempted vs stored password in memory. Never persist either value. */
export function scorePasswordCloseness(
  attempted: string,
  stored: string | null | undefined,
  email?: string,
): PasswordCloseness {
  const attempt = attempted ?? "";
  const attemptLen = attempt.length;
  if (!stored) return { closeness: "n_a", distance: null, hint: "sin_password", attemptLen };
  if (isHashedPassword(stored)) {
    return { closeness: "n_a", distance: null, hint: "hash", attemptLen };
  }

  // Exact match: the attempt was the real password (reachable when the login was
  // rejected for another reason, e.g. an inactive account). Never report it as a typo.
  if (attempt === stored) {
    return { closeness: "n_a", distance: 0, hint: null, attemptLen };
  }

  const local = (email || "").split("@")[0]?.trim() || "";
  if (local && attempt.toLowerCase() === local.toLowerCase()) {
    return {
      closeness: "unrelated",
      distance: levenshtein(attempt, stored),
      hint: "correo_como_password",
      attemptLen,
    };
  }

  if (attempt.trim() === stored || attempt === stored.trim()) {
    return { closeness: "typo", distance: 1, hint: "espacio", attemptLen };
  }
  if (attempt.toLowerCase() === stored.toLowerCase()) {
    return { closeness: "typo", distance: 0, hint: "mayusculas", attemptLen };
  }

  const d = levenshtein(attempt, stored);
  if (d <= 2) return { closeness: "typo", distance: d, hint: "un_caracter", attemptLen };
  const rel = d / Math.max(attempt.length, stored.length, 1);
  if (rel <= 0.25) return { closeness: "similar", distance: d, hint: "parecida", attemptLen };
  return { closeness: "unrelated", distance: d, hint: "distinta", attemptLen };
}
