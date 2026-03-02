import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle } from 'lucide-react';
import siigoLogoBlue from '@/assets/siigo-logo-blue.png';
import siigoLogoWhite from '@/assets/siigo-logo-white.png';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { isAuthenticated, signIn } = useSupabaseAuthContext();
  const navigate = useNavigate();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      setError(error.message);
    } else {
      navigate('/dashboard');
    }
    setIsLoading(false);
  };


  if (isAuthenticated) {
    navigate('/dashboard');
    return null;
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-sidebar flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-20 w-72 h-72 rounded-full bg-primary blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-secondary blur-3xl" />
        </div>
        <div className="relative z-10 text-center px-12">
          <img src={siigoLogoWhite} alt="Siigo" className="h-14 mx-auto mb-8" />
          <h1 className="text-4xl font-bold text-white mb-3">Gamificación</h1>
          <p className="text-lg text-sidebar-foreground/70 max-w-sm mx-auto">
            La Ruta del Héroe Comercial 🚀
          </p>
          <div className="mt-10 flex items-center justify-center gap-6 text-sidebar-foreground/50 text-sm">
            <span className="flex items-center gap-1.5"><span className="material-icons-outlined text-base">emoji_events</span> Rankings</span>
            <span className="flex items-center gap-1.5"><span className="material-icons-outlined text-base">military_tech</span> Medallas</span>
            <span className="flex items-center gap-1.5"><span className="material-icons-outlined text-base">flight_takeoff</span> Convención</span>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <img src={siigoLogoBlue} alt="Siigo" className="h-10 mx-auto mb-3" />
            <p className="text-sm font-semibold text-primary">Gamificación</p>
          </div>

          <div className="bg-card rounded-2xl shadow-smooth-xl p-8 border border-border space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-foreground mb-2">Iniciar Sesión</h2>
              <p className="text-sm text-muted-foreground">Accede con tu cuenta</p>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm text-left">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Email/Password form */}
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <Input
                type="email"
                placeholder="Correo electrónico"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-12 rounded-xl"
              />
              <Input
                type="password"
                placeholder="Contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-12 rounded-xl"
              />
              <Button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 text-base font-semibold rounded-xl"
              >
                {isLoading ? 'Ingresando...' : 'Ingresar'}
              </Button>
            </form>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
