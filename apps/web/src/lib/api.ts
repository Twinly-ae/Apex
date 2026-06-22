// Thin fetch wrapper. In dev VITE_API_URL is empty and Vite proxies /api to the
// backend; in prod it points at the API origin. Always sends the session cookie.
const BASE = import.meta.env.VITE_API_URL ?? "";

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  // Only declare a JSON content-type when we actually send a body. Setting it on
  // a bodyless request makes Fastify reject it ("Body cannot be empty when
  // content-type is set to 'application/json'"), silently breaking bodyless
  // POSTs (sync, toggle) and every DELETE.
  if (options.body != null && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      credentials: "include",
      ...options,
      headers,
    });
  } catch {
    // fetch only rejects on network/CORS/DNS/TLS failures.
    throw new ApiError(0, "Couldn't reach the server. Check your connection.");
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // A non-JSON body means we hit the wrong place (e.g. the web app's HTML
      // shell instead of the API) — almost always a VITE_API_URL misconfig.
      throw new ApiError(
        res.status,
        `Server returned a non-JSON ${res.status} response — check VITE_API_URL points to the API.`,
      );
    }
  }

  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new ApiError(res.status, message, (data as { details?: unknown })?.details);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
