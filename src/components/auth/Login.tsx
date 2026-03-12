import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { lovable } from '@/integrations/lovable/index';
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
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-sidebar flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-20 w-72 h-72 rounded-full bg-primary blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-secondary blur-3xl" />
        </div>
        <div className="relative z-10 text-center px-12">
          <img src={siigoLogoWhite} alt="Siigo" className="h-14 mx-auto mb-8" />
          <h1 className="text-4xl font-bold text-white mb-3">Siigo Arena</h1>
          <p className="text-lg text-sidebar-foreground/70 max-w-sm mx-auto">
            Plataforma de Gamificación Comercial 🏟️
          </p>
          <div className="mt-10 flex items-center justify-center gap-6 text-sidebar-foreground/50 text-sm">
            <span className="flex items-center gap-1.5"><span className="material-icons-outlined text-base">emoji_events</span> Rankings</span>
            <span className="flex items-center gap-1.5"><span className="material-icons-outlined text-base">military_tech</span> Medallas</span>
            <span className="flex items-center gap-1.5"><span className="material-icons-outlined text-base">diversity_3</span> Reconocimientos</span>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <img src={siigoLogoBlue} alt="Siigo" className="h-10 mx-auto mb-3" />
            <p className="text-sm font-semibold text-primary">Siigo Arena</p>
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

            <form onSubmit={handleEmailLogin} className="space-y-4">
              <Input type="email" placeholder="Correo electrónico" value={email} onChange={e => setEmail(e.target.value)} required className="h-12 rounded-xl" />
              <Input type="password" placeholder="Contraseña" value={password} onChange={e => setPassword(e.target.value)} required className="h-12 rounded-xl" />
              <Button type="submit" disabled={isLoading} className="w-full h-12 text-base font-semibold rounded-xl">
                {isLoading ? 'Ingresando...' : 'Ingresar'}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-card px-2 text-muted-foreground">o</span></div>
            </div>

            <Button type="button" variant="outline" disabled={isLoading}
              onClick={async () => {
                setError('');
                setIsLoading(true);
                const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
                if (result?.error) {
                  setError(result.error.message || 'Error al iniciar sesión con Google');
                  setIsLoading(false);
                }
              }}
              className="w-full h-12 text-base font-semibold rounded-xl flex items-center justify-center gap-3"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              Continuar con Google
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
