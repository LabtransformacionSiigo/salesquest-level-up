import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

// Providers in hierarchical order
import { ConfigProvider } from '@/context/ConfigContext';
import { AuthProvider } from '@/context/AuthContext';
import { SalesProvider } from '@/context/SalesContext';

// Pages
import Index from '@/pages/Index';
import Login from '@/components/auth/Login';
import Dashboard from '@/pages/Dashboard';
import RegisterSale from '@/pages/RegisterSale';
import SalesHistory from '@/pages/SalesHistory';
import Settings from '@/pages/Settings';
import Medals from '@/pages/Medals';
import Users from '@/pages/Users';
import Placeholder from '@/pages/Placeholder';
import NotFound from '@/pages/NotFound';

function App() {
  return (
    <BrowserRouter>
      <TooltipProvider>
        <ConfigProvider>
          <AuthProvider>
            <SalesProvider>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/register-sale" element={<RegisterSale />} />
              <Route path="/sales-history" element={<SalesHistory />} />
              <Route path="/medals" element={<Medals />} />
              <Route path="/settings" element={<Settings />} />
                
                {/* Placeholder routes for future features */}
                <Route path="/missions" element={<Placeholder title="Misiones" />} />
                <Route path="/ranking" element={<Placeholder title="Ranking" />} />
                <Route path="/profile" element={<Placeholder title="Mi Perfil" />} />
                <Route path="/team" element={<Placeholder title="Mi Equipo" />} />
                <Route path="/create-mission" element={<Placeholder title="Crear Misión" />} />
                <Route path="/users" element={<Users />} />
                <Route path="/analytics" element={<Placeholder title="Análisis" />} />
                
                <Route path="*" element={<NotFound />} />
              </Routes>
              <Toaster />
            </SalesProvider>
          </AuthProvider>
        </ConfigProvider>
      </TooltipProvider>
    </BrowserRouter>
  );
}

export default App;
