'use client';

import * as React from 'react';
import { USE_MOCK_API } from '@/lib/api';
import { realAuthApi, ApiError } from '@/lib/api/realApi';
import {
  AUTH_EXPIRED_EVENT,
  type AuthUser,
  getAuthSession,
  saveAuthSession,
} from '@/lib/authSession';
import { notifyToast } from '@/components/shared/FeedbackProvider';

export type MockAuthUser = AuthUser;

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  hydrated: boolean;
  loginWithEmail: (email: string, password?: string) => Promise<void>;
  loginAsDemo: () => Promise<void>;
  requestMagicLink: (email: string) => Promise<{ message: string }>;
  logout: () => void;
}

const AuthContext = React.createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<AuthUser | null>(null);
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    const existing = getAuthSession();

    async function hydrate() {
      if (!existing) {
        if (active) setHydrated(true);
        return;
      }

      if (!USE_MOCK_API) {
        if (!existing.accessToken) {
          saveAuthSession(null);
          if (active) {
            setUser(null);
            setHydrated(true);
          }
          return;
        }
        if (active) {
          setUser(existing.user);
          setHydrated(true);
        }
        try {
          const me = await realAuthApi.getMe(existing.accessToken);
          if (!active) return;
          const refreshedUser: AuthUser = {
            id: me.id,
            email: me.email,
            name: me.name,
            role: me.role,
            companyId: me.companyId,
            companyName: me.companyName,
            isDemo: me.isDemo,
            mode: me.isDemo ? 'demo' : 'email',
            signedInAt: existing.user.signedInAt,
          };
          saveAuthSession({ accessToken: existing.accessToken, user: refreshedUser });
          setUser(refreshedUser);
        } catch (err) {
          if (err instanceof ApiError && err.status === 401) {
            saveAuthSession(null);
            if (active) setUser(null);
          }
        }
        return;
      }

      if (active) {
        setUser(existing.user);
        setHydrated(true);
      }
    }

    hydrate();

    const onExpired = (ev: Event) => {
      const reason = (ev as CustomEvent<{ reason?: string }>).detail?.reason;
      setUser(null);
      if (reason) notifyToast('info', reason);
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => {
      active = false;
      window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
    };
  }, []);

  const loginWithEmail = React.useCallback(async (email: string, password = '') => {
    const cleanEmail = email.trim().toLowerCase();
    if (USE_MOCK_API) {
      const displayName = cleanEmail.split('@')[0] || 'Exporter Manager';
      const nextUser: AuthUser = {
        email: cleanEmail,
        name: displayName,
        mode: 'email',
        isDemo: false,
        signedInAt: new Date().toISOString(),
      };
      saveAuthSession({ accessToken: null, user: nextUser });
      setUser(nextUser);
      return;
    }

    const res = await realAuthApi.login(cleanEmail, password);
    const nextUser: AuthUser = {
      id: res.user.id,
      email: res.user.email,
      name: res.user.name,
      role: res.user.role,
      companyId: res.user.companyId,
      companyName: res.user.companyName,
      isDemo: res.user.isDemo,
      mode: res.user.isDemo ? 'demo' : 'email',
      signedInAt: new Date().toISOString(),
    };
    saveAuthSession({ accessToken: res.accessToken, user: nextUser });
    setUser(nextUser);
  }, []);

  const loginAsDemo = React.useCallback(async () => {
    if (USE_MOCK_API) {
      const demoUser: AuthUser = {
        email: 'demo@demofasteners.example',
        name: 'Demo Fasteners User',
        companyName: 'Demo Fasteners Pvt Ltd',
        isDemo: true,
        mode: 'demo',
        signedInAt: new Date().toISOString(),
      };
      saveAuthSession({ accessToken: null, user: demoUser });
      setUser(demoUser);
      return;
    }

    const res = await realAuthApi.demoLogin();
    const demoUser: AuthUser = {
      id: res.user.id,
      email: res.user.email,
      name: res.user.name,
      role: res.user.role,
      companyId: res.user.companyId,
      companyName: res.user.companyName,
      isDemo: res.user.isDemo,
      mode: 'demo',
      signedInAt: new Date().toISOString(),
    };
    saveAuthSession({ accessToken: res.accessToken, user: demoUser });
    setUser(demoUser);
  }, []);

  const requestMagicLink = React.useCallback(async (email: string) => {
    if (USE_MOCK_API) {
      return { message: 'Check your email' };
    }
    return realAuthApi.requestMagicLink(email.trim().toLowerCase());
  }, []);

  const logout = React.useCallback(() => {
    saveAuthSession(null);
    setUser(null);
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      hydrated,
      loginWithEmail,
      loginAsDemo,
      requestMagicLink,
      logout,
    }),
    [user, hydrated, loginWithEmail, loginAsDemo, requestMagicLink, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
