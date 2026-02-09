export const API_BASE = "/api";

export type ApiOptions = RequestInit & { auth?: boolean };

function buildHeaders(path: string, options: ApiOptions): Record<string, string> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined)
  };
  const isFormData = options.body instanceof FormData;
  if (!isFormData && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  if (options.auth !== false) {
    const token = localStorage.getItem("access_token");
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    } else {
      console.warn("No access_token found in localStorage for request:", path);
    }
  }
  return headers;
}

export async function apiRequest(path: string, options: ApiOptions = {}): Promise<Response> {
  const headers = buildHeaders(path, options);
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (!res.ok && res.status === 401) {
    console.error("401 Unauthorized - Token may be invalid or expired. Redirecting to login...");
    localStorage.removeItem("access_token");
    window.location.href = "/login";
  }
  return res;
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const res = await apiRequest(path, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}
