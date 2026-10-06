import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { authRepository, type SignUpResult } from '../../../repositories/authRepository';
import { setMonitoringUser } from '../../../lib/monitoring/sentry';

type SocialProviders = {
  google: boolean;
  apple: boolean;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  displayName: string | null;
  isInitializing: boolean;
  isBackendAvailable: boolean;
  providers: SocialProviders;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, displayName: string) => Promise<SignUpResult>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Social providers fill full_name/name, which serve as a fallback until the user picks a handle.
function readDisplayName(user: User | null): string | null {
  const metadata = user?.user_metadata ?? {};
  const candidate = metadata.display_name ?? metadata.full_name ?? metadata.name;
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [providers, setProviders] = useState<SocialProviders>({ google: false, apple: false });

  // Supabase emits INITIAL_SESSION on subscribe, so the first callback marks restoration complete.
  useEffect(
    () =>
      authRepository.onSessionChange((nextSession) => {
        setSession(nextSession);
        setIsInitializing(false);
        setMonitoringUser(nextSession?.user.id ?? null);
      }),
    []
  );

  useEffect(() => {
    let active = true;
    Promise.all([authRepository.isGoogleSignInAvailable(), authRepository.isAppleSignInAvailable()])
      .then(([google, apple]) => {
        if (active) {
          setProviders({ google, apple });
        }
      })
      // A provider that cannot be probed is simply not offered.
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => {
    const user = session?.user ?? null;
    return {
      session,
      user,
      displayName: readDisplayName(user),
      isInitializing,
      isBackendAvailable: authRepository.isBackendAvailable,
      providers,
      signInWithEmail: authRepository.signInWithEmail,
      signUpWithEmail: authRepository.signUpWithEmail,
      signInWithGoogle: authRepository.signInWithGoogle,
      signInWithApple: authRepository.signInWithApple,
      signOut: authRepository.signOut,
      updateDisplayName: authRepository.updateDisplayName,
    };
  }, [session, isInitializing, providers]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
