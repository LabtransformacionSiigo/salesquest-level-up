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
    <div className="min-h-screen flex bg-background">
      {/* Left panel — Siigo navy */}
      <div className="hidden lg:flex lg:w-[480px] bg-sidebar flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent" />
        <div className="relative z-10 text-center px-12">
          <img src={siigoLogoWhite} alt="Siigo" className="h-12 mx-auto mb-10" />
          <h1 className="text-3xl font-black text-white mb-2 tracking-tight">Siigo Arena</h1>
          <p className="text-base text-white/50 max-w-xs mx-auto leading-relaxed">
            Plataforma de Gamificación Comercial
          </p>
          <div className="mt-12 grid grid-cols-3 gap-4 text-white/40 text-xs">
            <div className="flex flex-col items-center gap-2">
              <span className="material-icons-round text-2xl text-primary">leaderboard</span>
              <span className="font-semibold">Rankings</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="material-icons-round text-2xl text-accent">emoji_events</span>
              <span className="font-semibold">Medallas</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="material-icons-round text-2xl text-destructive">favorite</span>
              <span className="font-semibold">Reconocer</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden text-center mb-10">
            <img src={siigoLogoBlue} alt="Siigo" className="h-9 mx-auto mb-3" />
            <p className="text-sm font-bold text-primary">Siigo Arena</p>
          </div>

          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-black text-foreground mb-1">Iniciar Sesión</h2>
              <p className="text-sm text-muted-foreground">Accede con tu cuenta corporativa</p>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-destructive/8 border border-destructive/15 rounded-xl text-destructive text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Correo electrónico</label>
                <Input type="email" placeholder="nombre@siigo.com" value={email} onChange={e => setEmail(e.target.value)} required className="h-12 rounded-xl bg-muted/50 border-border" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Contraseña</label>
                <Input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required className="h-12 rounded-xl bg-muted/50 border-border" />
              </div>
              <Button type="submit" disabled={isLoading} className="w-full h-12 text-base" size="lg">
                {isLoading ? 'Ingresando...' : 'Ingresar'}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-3 text-muted-foreground font-semibold">o</span></div>
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
              className="w-full h-12 text-base flex items-center justify-center gap-3"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 48 48">
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
