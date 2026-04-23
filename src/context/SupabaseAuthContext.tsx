import React, { createContext, useContext, ReactNode } from 'react';
import { useSupabaseAuth, AuthUser, Gerente } from '@/hooks/useSupabaseAuth';
import { User, Session } from '@supabase/supabase-js';

interface SupabaseAuthContextType {
  user: User | null;
  session: Session | null;
  profile: AuthUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<{ data?: any; error: any }>;
  signUp: (email: string, password: string, metadata?: { name?: string }) => Promise<{ data?: any; error: any }>;
  signOut: () => Promise<{ error: any }>;
  updateProfile: (updates: Partial<Gerente>) => Promise<{ data?: any; error: any }>;
  refreshProfile: () => void;
}

// Use a global symbol so HMR / duplicate module evaluation share the same context instance
const CTX_KEY = '__SIIGO_ARENA_SUPABASE_AUTH_CTX__';
const globalAny = globalThis as any;
const SupabaseAuthContext: React.Context<SupabaseAuthContextType | undefined> =
  globalAny[CTX_KEY] || (globalAny[CTX_KEY] = createContext<SupabaseAuthContextType | undefined>(undefined));

export const SupabaseAuthProvider = ({ children }: { children: ReactNode }) => {
  const auth = useSupabaseAuth();
  return (
    <SupabaseAuthContext.Provider value={auth}>
      {children}
    </SupabaseAuthContext.Provider>
  );
};

const FALLBACK_AUTH: SupabaseAuthContextType = {
  user: null,
  session: null,
  profile: null,
  loading: true,
  isAuthenticated: false,
  signIn: async () => ({ error: new Error('Auth provider no disponible') }),
  signUp: async () => ({ error: new Error('Auth provider no disponible') }),
  signOut: async () => ({ error: null }),
  updateProfile: async () => ({ error: new Error('Auth provider no disponible') }),
  refreshProfile: () => {},
};

export const useSupabaseAuthContext = () => {
  const context = useContext(SupabaseAuthContext);
  if (context === undefined) {
    if (typeof window !== 'undefined') {
      console.warn('[SupabaseAuthContext] consumer rendered outside provider — using fallback');
    }
    return FALLBACK_AUTH;
  }
  return context;
};
