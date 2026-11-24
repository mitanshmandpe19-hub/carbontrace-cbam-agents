export interface AuthUser {
  id?: string;
  email: string;
  name: string;
  role?: string;
  companyId?: string;
  companyName?: string;
  isDemo?: boolean;
  mode: 'email' | 'demo';
  signedInAt: string;
}

export interface StoredAuthSession {
  accessToken: string | null;
  user: AuthUser;
}

const SESSION_KEY = 'carbontrace_auth_session_v1';
const LEGACY_SESSION_KEY = 'carbontrace_mock_auth_v1';

export const AUTH_EXPIRED_EVENT = 'carbontrace:auth-expired';

let memorySession: StoredAuthSession | null = null;

export function getAuthSession(): StoredAuthSession | null {
  if (memorySession) return memorySession;
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredAuthSession>;
    if (!parsed?.user || typeof parsed.user.email !== 'string') return null;

    memorySession = {
      accessToken: typeof parsed.accessToken === 'string' ? parsed.accessToken : null,
      user: {
        id: typeof parsed.user.id === 'string' ? parsed.user.id : undefined,
        email: parsed.user.email,
        name: typeof parsed.user.name === 'string' ? parsed.user.name : 'Exporter User',
        role: typeof parsed.user.role === 'string' ? parsed.user.role : undefined,
        companyId:
          typeof parsed.user.companyId === 'string' ? parsed.user.companyId : undefined,
        companyName:
          typeof parsed.user.companyName === 'string' ? parsed.user.companyName : undefined,
        isDemo: typeof parsed.user.isDemo === 'boolean' ? parsed.user.isDemo : undefined,
        mode: parsed.user.mode === 'email' ? 'email' : 'demo',
        signedInAt:
          typeof parsed.user.signedInAt === 'string'
            ? parsed.user.signedInAt
            : new Date().toISOString(),
      },
    };
    return memorySession;
  } catch {
    return null;
  }
}

export function getAccessToken(): string | null {
  return getAuthSession()?.accessToken ?? null;
}

export function saveAuthSession(session: StoredAuthSession | null): void {
  memorySession = session;
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.removeItem(LEGACY_SESSION_KEY);
    if (!session) {
      window.sessionStorage.removeItem(SESSION_KEY);
      return;
    }
    // Only safe session metadata and bearer token are stored (never passwords).
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Ignore sessionStorage restrictions in private/headless contexts.
  }
}

export function emitAuthExpired(reason = 'Your session ended. Please log in again.'): void {
  saveAuthSession(null);
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT, { detail: { reason } }));
}

