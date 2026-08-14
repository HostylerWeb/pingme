export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/v1';

export type AdminRole = 'super_admin' | 'moderator' | 'support';

export interface AdminSession {
  accessToken: string;
  admin: {
    id: string;
    email: string;
    role: AdminRole;
  };
}

const TOKEN_KEY = 'pingme_admin_token';
const ADMIN_KEY = 'pingme_admin_user';

export function getStoredSession(): AdminSession | null {
  if (typeof window === 'undefined') return null;
  const accessToken = localStorage.getItem(TOKEN_KEY);
  const adminRaw = localStorage.getItem(ADMIN_KEY);
  if (!accessToken || !adminRaw) return null;
  try {
    return { accessToken, admin: JSON.parse(adminRaw) };
  } catch {
    return null;
  }
}

export function storeSession(session: AdminSession) {
  localStorage.setItem(TOKEN_KEY, session.accessToken);
  localStorage.setItem(ADMIN_KEY, JSON.stringify(session.admin));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ADMIN_KEY);
}

export async function adminFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const session = getStoredSession();
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (session?.accessToken) {
    headers.set('Authorization', `Bearer ${session.accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearSession();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message =
      body.error?.message ?? body.message ?? `Request failed (${response.status})`;
    throw new Error(message);
  }

  return response.json() as Promise<T>;
}

export async function loginAdmin(email: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.message ?? 'Login failed');
  }

  const data = (await response.json()) as AdminSession;
  storeSession(data);
  return data;
}
