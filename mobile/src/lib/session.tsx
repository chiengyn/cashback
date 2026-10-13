import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { setAuthToken } from '@/lib/api';

type Session = { token: string; phone: string };

type SessionContextValue = {
  session: Session | null;
  isLoading: boolean;
  signIn: (session: Session) => Promise<void>;
  signOut: () => Promise<void>;
};

const STORAGE_KEY = 'session';
const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as Session;
        setAuthToken(saved.token);
        setSession(saved);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  async function signIn(next: Session) {
    await SecureStore.setItemAsync(STORAGE_KEY, JSON.stringify(next));
    setAuthToken(next.token);
    setSession(next);
  }

  async function signOut() {
    await SecureStore.deleteItemAsync(STORAGE_KEY);
    setAuthToken(null);
    setSession(null);
  }

  return (
    <SessionContext.Provider value={{ session, isLoading, signIn, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession phải nằm trong <SessionProvider>');
  return value;
}
