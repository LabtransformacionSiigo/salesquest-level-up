import { Navigate } from 'react-router-dom';
import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { ReactNode } from 'react';

const EspecialistaRoute = ({ children }: { children: ReactNode }) => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (profile?.role !== 'especialista' && profile?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default EspecialistaRoute;
