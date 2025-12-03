import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import ExecutiveDashboard from '@/components/dashboard/ExecutiveDashboard';
import ManagerDashboard from '@/components/dashboard/ManagerDashboard';
import AdminDashboard from '@/components/dashboard/AdminDashboard';

const Dashboard = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const getDashboardComponent = () => {
    switch (profile?.role) {
      case 'EJECUTIVO':
        return <ExecutiveDashboard />;
      case 'GERENTE':
        return <ManagerDashboard />;
      case 'ADMINISTRADOR':
        return <AdminDashboard />;
      default:
        return <div>Role no reconocido</div>;
    }
  };

  const getTitle = () => {
    switch (profile?.role) {
      case 'EJECUTIVO':
        return 'Mi Dashboard';
      case 'GERENTE':
        return 'Dashboard de Gerente';
      case 'ADMINISTRADOR':
        return 'Panel de Administración';
      default:
        return 'Dashboard';
    }
  };

  return (
    <Layout title={getTitle()}>
      {getDashboardComponent()}
    </Layout>
  );
};

export default Dashboard;
