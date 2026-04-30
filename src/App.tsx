import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';

// Providers
import { SupabaseAuthProvider } from '@/context/SupabaseAuthContext';

// Pages
import Login from '@/components/auth/Login';
import Dashboard from '@/pages/Dashboard';
import Rankings from '@/pages/Rankings';
import MiPerformance from '@/pages/MiPerformance';
import Medallas from '@/pages/Medallas';
import Reconocimientos from '@/pages/Reconocimientos';
import MiEquipo from '@/pages/MiEquipo';
import Retos from '@/pages/Retos';
import NotFound from '@/pages/NotFound';
import Premios from '@/pages/Premios';

// Admin Pages
import AdminGerentes from '@/pages/admin/AdminGerentes';
import AdminAsesores from '@/pages/admin/AdminAsesores';
import AdminMedallas from '@/pages/admin/AdminMedallas';
import AdminRachas from '@/pages/admin/AdminRachas';
import AdminCalculoSP from '@/pages/admin/AdminCalculoSP';
import AdminDatabricks from '@/pages/admin/AdminDatabricks';
import AdminPremios from '@/pages/admin/AdminPremios';
import AdminEspecialista from '@/pages/admin/AdminEspecialista';
import AdminEspecialistaPremios from '@/pages/admin/AdminEspecialistaPremios';
import AdminSimulacion from '@/pages/admin/AdminSimulacion';
import AdminMetasAcv from '@/pages/admin/AdminMetasAcv';
import AdminAdvisorSegments from '@/pages/admin/AdminAdvisorSegments';
import AdminGamification from '@/pages/admin/AdminGamification';
import AdminRoute from '@/components/auth/AdminRoute';
import EspecialistaRoute from '@/components/auth/EspecialistaRoute';

function App() {
  return (
    <BrowserRouter>
      <TooltipProvider>
        <SupabaseAuthProvider>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/ranking" element={<Rankings />} />
            <Route path="/mi-performance" element={<MiPerformance />} />
            <Route path="/medallas" element={<Medallas />} />
            <Route path="/reconocimientos" element={<Reconocimientos />} />
            <Route path="/mi-equipo" element={<MiEquipo />} />
            <Route path="/retos" element={<Retos />} />
            <Route path="/premios" element={<Premios />} />
            {/* Admin - Solo administradores */}
            <Route path="/admin/gerentes" element={<AdminRoute><AdminGerentes /></AdminRoute>} />
            <Route path="/admin/asesores" element={<AdminRoute><AdminAsesores /></AdminRoute>} />
            <Route path="/admin/medallas" element={<AdminRoute><AdminMedallas /></AdminRoute>} />
            <Route path="/admin/rachas" element={<AdminRoute><AdminRachas /></AdminRoute>} />
            <Route path="/admin/calculos" element={<AdminRoute><AdminCalculoSP /></AdminRoute>} />
            <Route path="/admin/databricks" element={<AdminRoute><AdminDatabricks /></AdminRoute>} />
            <Route path="/admin/premios" element={<AdminRoute><AdminPremios /></AdminRoute>} />
            <Route path="/admin/simulacion" element={<AdminRoute><AdminSimulacion /></AdminRoute>} />
            <Route path="/admin/metas-acv" element={<AdminRoute><AdminMetasAcv /></AdminRoute>} />
            <Route path="/admin/especialista" element={<EspecialistaRoute><AdminEspecialista /></EspecialistaRoute>} />
            <Route path="/admin/especialista/premios" element={<EspecialistaRoute><AdminEspecialistaPremios /></EspecialistaRoute>} />
            <Route path="/admin/segmentos-vc" element={<EspecialistaRoute><AdminAdvisorSegments /></EspecialistaRoute>} />
            <Route path="/admin/gamification" element={<EspecialistaRoute><AdminGamification /></EspecialistaRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Toaster />
        </SupabaseAuthProvider>
      </TooltipProvider>
    </BrowserRouter>
  );
}

export default App;
