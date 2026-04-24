'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ACCESS_TOKEN_STORAGE_KEY,
  AUTH_CHANGED_EVENT,
  getStoredAccessToken,
} from '@/lib/auth-token';
import { USER_CREDIT_BALANCE_REFRESH_EVENT } from '@/lib/user-credit-balance';
import { fetchMe, type MeUser } from '@/lib/auth';

type AuthSessionValue = {
  user: MeUser | null;
  loading: boolean;
  setUser: (u: MeUser | null) => void;
};

const AuthSessionContext = createContext<AuthSessionValue | null>(null);

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const userRef = useRef<MeUser | null>(null);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    let cancelled = false;

    const resolve = async (silent: boolean) => {
      const token = getStoredAccessToken();
      if (!token) {
        if (!cancelled) {
          setUser(null);
          setLoading(false);
        }
        return;
      }
      if (!silent && !cancelled) setLoading(true);
      const me = await fetchMe();
      if (!cancelled) {
        setUser(me);
        setLoading(false);
      }
    };

    void resolve(false);

    function onAuthChanged() {
      void resolve(userRef.current != null);
    }

    function onStorage(e: StorageEvent) {
      if (e.storageArea !== localStorage) return;
      if (e.key !== ACCESS_TOKEN_STORAGE_KEY) return;
      void resolve(userRef.current != null);
    }

    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
    window.addEventListener('storage', onStorage);

    return () => {
      cancelled = true;
      window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  /** Refetch `/me` when points change (generation, translate, …) so header balance updates without reload. */
  useEffect(() => {
    let cancelled = false;
    const onCreditsRefresh = () => {
      void (async () => {
        const token = getStoredAccessToken();
        if (!token) {
          if (!cancelled) setUser(null);
          return;
        }
        const me = await fetchMe();
        if (!cancelled) setUser(me);
      })();
    };
    window.addEventListener(USER_CREDIT_BALANCE_REFRESH_EVENT, onCreditsRefresh);
    return () => {
      cancelled = true;
      window.removeEventListener(USER_CREDIT_BALANCE_REFRESH_EVENT, onCreditsRefresh);
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      setUser,
    }),
    [user, loading],
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession() {
  const ctx = useContext(AuthSessionContext);
  if (!ctx) {
    throw new Error('useAuthSession must be used within AuthSessionProvider');
  }
  return ctx;
}
