const API_BASE = "/api";

export type ApiOptions = RequestInit & { auth?: boolean };

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> | undefined)
  };
  if (options.auth !== false) {
    const token = localStorage.getItem("access_token");
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    } else {
      console.warn("No access_token found in localStorage for request:", path);
    }
  }
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    if (res.status === 401) {
      console.error("401 Unauthorized - Token may be invalid or expired. Redirecting to login...");
      localStorage.removeItem("access_token");
      // Redirect to login page
      window.location.href = "/login";
    }
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}
