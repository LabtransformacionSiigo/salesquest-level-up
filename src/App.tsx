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
import NotFound from '@/pages/NotFound';

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
            <Route path="*" element={<NotFound />} />
          </Routes>
          <Toaster />
        </SupabaseAuthProvider>
      </TooltipProvider>
    </BrowserRouter>
  );
}

export default App;
