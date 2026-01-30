import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

// Providers
import { SupabaseAuthProvider } from '@/context/SupabaseAuthContext';
import { ConfigProvider } from '@/context/ConfigContext';
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
import MyTeam from '@/pages/MyTeam';
import Cells from '@/pages/Cells';
import Rankings from '@/pages/Rankings';
import UploadHistory from '@/pages/UploadHistory';
import Placeholder from '@/pages/Placeholder';
import NotFound from '@/pages/NotFound';

function App() {
  return (
    <BrowserRouter>
      <TooltipProvider>
        <SupabaseAuthProvider>
          <ConfigProvider>
            <SalesProvider>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/register-sale" element={<RegisterSale />} />
                <Route path="/sales-history" element={<SalesHistory />} />
                <Route path="/medals" element={<Medals />} />
                <Route path="/settings" element={<Settings />} />
                
                {/* Core routes */}
                <Route path="/ranking" element={<Rankings />} />
                <Route path="/cells" element={<Cells />} />
                <Route path="/upload-history" element={<UploadHistory />} />
                <Route path="/team" element={<MyTeam />} />
                <Route path="/users" element={<Users />} />
                
                {/* Placeholder routes for future features */}
                <Route path="/missions" element={<Placeholder title="Misiones" />} />
                <Route path="/profile" element={<Placeholder title="Mi Perfil" />} />
                <Route path="/create-mission" element={<Placeholder title="Crear Misión" />} />
                <Route path="/analytics" element={<Placeholder title="Análisis" />} />
                
                <Route path="*" element={<NotFound />} />
              </Routes>
              <Toaster />
            </SalesProvider>
          </ConfigProvider>
        </SupabaseAuthProvider>
      </TooltipProvider>
    </BrowserRouter>
  );
}

export default App;
