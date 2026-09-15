import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { authRepository, type SignUpResult } from '../../../repositories/authRepository';

type SocialProviders = {
  google: boolean;
  apple: boolean;
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  isInitializing: boolean;
  providers: SocialProviders;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<SignUpResult>;
  signInWithGoogle: () => Promise<void>;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

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
      }),
    []
  );

  useEffect(() => {
    let active = true;
    Promise.all([
      authRepository.isGoogleSignInAvailable(),
      authRepository.isAppleSignInAvailable(),
    ]).then(([google, apple]) => {
      if (active) {
        setProviders({ google, apple });
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isInitializing,
      providers,
      signInWithEmail: authRepository.signInWithEmail,
      signUpWithEmail: authRepository.signUpWithEmail,
      signInWithGoogle: authRepository.signInWithGoogle,
      signInWithApple: authRepository.signInWithApple,
      signOut: authRepository.signOut,
    }),
    [session, isInitializing, providers]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
