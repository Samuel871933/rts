import { useAuthStore } from '../store/authStore';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: Record<string, string[] | undefined>,
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Lets the request finish even if the page is being closed / reloaded. */
  keepalive?: boolean;
}

export async function apiFetch<T>(path: string, { method = 'GET', body, keepalive }: RequestOptions = {}): Promise<T> {
  const token = useAuthStore.getState().token;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      keepalive,
    });
  } catch {
    throw new ApiError('Serveur injoignable', 0);
  }

  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && token) useAuthStore.getState().logout();
    throw new ApiError(data?.error?.message ?? `Erreur ${res.status}`, res.status, data?.error?.details);
  }
  return data as T;
}
