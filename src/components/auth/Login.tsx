import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { lovable } from '@/integrations/lovable/index';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle } from 'lucide-react';
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
    if (error) setError(error.message);
    else navigate('/dashboard');
    setIsLoading(false);
  };

  if (isAuthenticated) { navigate('/dashboard'); return null; }

  return (
    <div className="min-h-screen flex relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background/95 to-card" />
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 left-1/4 w-[600px] h-[600px] rounded-full bg-primary/[0.06] blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-primary/[0.04] blur-[100px]" />
      </div>
      <div className="hidden lg:flex lg:w-[520px] flex-col items-center justify-center relative z-10">
        <div className="text-center px-12">
          <img src={siigoLogoWhite} alt="Siigo" className="h-10 mx-auto mb-8" />
          <h1 className="text-4xl font-black text-foreground mb-2">Siigo Arena</h1>
          <p className="text-xl font-bold text-primary mb-2">Plataforma de Gamificación</p>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">Potencia tus resultados comerciales con Siigo Points</p>
          <div className="mt-10 grid grid-cols-3 gap-6 text-muted-foreground text-xs">
            <div className="flex flex-col items-center gap-2"><div className="w-14 h-14 rounded-2xl glass-card flex items-center justify-center text-2xl">🏅</div><span className="font-semibold">Medallas</span></div>
            <div className="flex flex-col items-center gap-2"><div className="w-14 h-14 rounded-2xl glass-card flex items-center justify-center text-2xl">🎯</div><span className="font-semibold">Retos</span></div>
            <div className="flex flex-col items-center gap-2"><div className="w-14 h-14 rounded-2xl glass-card flex items-center justify-center text-2xl">📊</div><span className="font-semibold">Rankings</span></div>
          </div>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center p-8 relative z-10">
        <div className="w-full max-w-sm">
          <div className="lg:hidden text-center mb-10">
            <img src={siigoLogoWhite} alt="Siigo" className="h-8 mx-auto mb-3" />
            <p className="text-lg font-bold text-primary">Siigo Arena</p>
          </div>
          <div className="glass-card rounded-3xl p-8 space-y-6">
            <div>
              <h2 className="text-2xl font-black text-foreground mb-1">Iniciar Sesión</h2>
              <p className="text-sm text-muted-foreground">Accede con tu cuenta corporativa</p>
            </div>
            {error && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /><span>{error}</span>
              </div>
            )}
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Correo electrónico</label>
                <Input type="email" placeholder="nombre@siigo.com" value={email} onChange={e => setEmail(e.target.value)} required className="h-12 rounded-xl bg-muted/50 border-border/50 backdrop-blur" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Contraseña</label>
                <Input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required className="h-12 rounded-xl bg-muted/50 border-border/50 backdrop-blur" />
              </div>
              <Button type="submit" disabled={isLoading} className="w-full h-12 text-base" size="lg">
                {isLoading ? 'Ingresando...' : 'Ingresar'}
              </Button>
            </form>
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/30" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-card/50 backdrop-blur px-3 text-muted-foreground font-semibold">o</span></div>
            </div>
            <Button type="button" variant="outline" disabled={isLoading}
              onClick={async () => { setError(''); setIsLoading(true); const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin }); if (result?.error) { setError(result.error.message || 'Error'); setIsLoading(false); } }}
              className="w-full h-12 text-base flex items-center justify-center gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              Continuar con Google
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
