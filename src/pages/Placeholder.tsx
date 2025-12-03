import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { Card } from '@/components/ui/card';
import { Construction } from 'lucide-react';

interface PlaceholderProps {
  title: string;
}

const Placeholder = ({ title }: PlaceholderProps) => {
  const { isAuthenticated } = useSupabaseAuthContext();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Layout title={title}>
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="p-12 shadow-smooth-xl border-2 text-center max-w-md">
          <div className="w-20 h-20 bg-gradient-primary rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-smooth-lg">
            <Construction className="w-10 h-10 text-primary-foreground" />
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-3">
            Sección en Construcción
          </h2>
          <p className="text-muted-foreground">
            Esta funcionalidad estará disponible pronto.
          </p>
          <p className="text-primary font-bold mt-4">
            ¡Estamos trabajando en algo increíble! 🚀
          </p>
        </Card>
      </div>
    </Layout>
  );
};

export default Placeholder;
