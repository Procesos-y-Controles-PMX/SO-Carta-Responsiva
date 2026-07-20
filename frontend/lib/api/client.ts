type ApiResponse<T> = {
  ok?: boolean;
  data?: T;
  message?: string;
};

export async function apiFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; message: string; status: number }> {
  try {
    const response = await fetch(path, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      credentials: "same-origin",
    });
    const payload = (await response.json().catch(() => ({}))) as ApiResponse<T>;
    if (!response.ok || payload.ok === false) {
      return {
        ok: false,
        message: payload.message ?? "Error de servidor.",
        status: response.status,
      };
    }
    return { ok: true, data: (payload.data as T) };
  } catch {
    return { ok: false, message: "No se pudo contactar al servidor.", status: 0 };
  }
}
