const ADMIN_TOKEN_KEY = 'cbt_admin_token_v1';
const ADMIN_USER_KEY = 'cbt_admin_user_v1';

export function getAdminToken(): string | null {
  return localStorage.getItem(ADMIN_TOKEN_KEY);
}

export function setAdminAuth(token: string, user: { name: string; role: string; email?: string }) {
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
  localStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
}

export function getAdminUser(): { name: string; role: string; email?: string } | null {
  const raw = localStorage.getItem(ADMIN_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearAdminAuth() {
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  localStorage.removeItem(ADMIN_USER_KEY);
}

export class ApiError extends Error {
  status: number;
  code?: string;
  title?: string;
  session_id?: number;

  constructor(
    message: string,
    status: number,
    extra?: { code?: string; title?: string; session_id?: number }
  ) {
    super(message);
    this.status = status;
    this.code = extra?.code;
    this.title = extra?.title;
    this.session_id = extra?.session_id;
  }
}

export async function apiFetch<T>(
  url: string,
  options: RequestInit & { admin?: boolean } = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (options.admin) {
    const token = getAdminToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    if (res.status === 401 && options.admin) {
      clearAdminAuth();
    }
    throw new ApiError(data?.error || 'Terjadi kesalahan pada server', res.status, {
      code: data?.code,
      title: data?.title,
      session_id: data?.session_id,
    });
  }

  return data as T;
}
