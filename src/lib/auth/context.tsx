import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../supabase/client';
import * as SecureStore from 'expo-secure-store';
import { signInWithApple as appleSignIn, isAppleSignInAvailable } from './appleAuth';
import { signInWithGoogle as googleSignIn, isGoogleSignInAvailable } from './googleAuth';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signInWithApple: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const SESSION_STORAGE_KEY = 'minito_auth_session';

/**
 * Auth Provider Component
 * Manages authentication state and provides auth methods
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Load session from secure storage on mount
  useEffect(() => {
    loadSession();
    
    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        
        // Persist session to secure storage
        if (newSession) {
          await SecureStore.setItemAsync(
            SESSION_STORAGE_KEY,
            JSON.stringify(newSession)
          );
        } else {
          await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const loadSession = async () => {
    try {
      // Try to load from secure storage first
      const storedSession = await SecureStore.getItemAsync(SESSION_STORAGE_KEY);
      if (storedSession) {
        const parsedSession = JSON.parse(storedSession) as Session;
        setSession(parsedSession);
        setUser(parsedSession.user);
      }

      // Also check Supabase for current session
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      if (currentSession) {
        setSession(currentSession);
        setUser(currentSession.user);
        // Update stored session
        await SecureStore.setItemAsync(
          SESSION_STORAGE_KEY,
          JSON.stringify(currentSession)
        );
      }
    } catch (error) {
      console.warn('Failed to load auth session:', error);
      // Fail-soft: Continue without session
    } finally {
      setLoading(false);
    }
  };

  const signInWithApple = async () => {
    try {
      setLoading(true);
      await appleSignIn();
      // Session will be updated via onAuthStateChange listener
    } catch (error) {
      console.error('Apple Sign In error:', error);
      setLoading(false);
      throw error;
    }
  };

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      await googleSignIn();
      // Session will be updated via onAuthStateChange listener
    } catch (error) {
      console.error('Google Sign In error:', error);
      setLoading(false);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      await supabase.auth.signOut();
      await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
      setSession(null);
      setUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        loading,
        signInWithApple,
        signInWithGoogle,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Hook to access auth context
 * @throws Error if used outside AuthProvider
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

