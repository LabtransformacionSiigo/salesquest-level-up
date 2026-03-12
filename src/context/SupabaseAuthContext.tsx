import { createContext, useContext, ReactNode } from 'react';
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

const SupabaseAuthContext = createContext<SupabaseAuthContextType | undefined>(undefined);

export const SupabaseAuthProvider = ({ children }: { children: ReactNode }) => {
  const auth = useSupabaseAuth();
  return (
    <SupabaseAuthContext.Provider value={auth}>
      {children}
    </SupabaseAuthContext.Provider>
  );
};

export const useSupabaseAuthContext = () => {
  const context = useContext(SupabaseAuthContext);
  if (context === undefined) {
    throw new Error('useSupabaseAuthContext must be used within a SupabaseAuthProvider');
  }
  return context;
};
