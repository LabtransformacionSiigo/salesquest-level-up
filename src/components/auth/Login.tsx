import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mail, Lock, AlertCircle, UserPlus, Shield } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import siigoLogoBlue from '@/assets/siigo-logo-blue.png';
import siigoLogoWhite from '@/assets/siigo-logo-white.png';

type AppRole = 'ADMINISTRADOR' | 'GERENTE' | 'EJECUTIVO';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<AppRole>('EJECUTIVO');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signUp, isAuthenticated } = useSupabaseAuthContext();
  const navigate = useNavigate();

  // Redirect if already authenticated
  if (isAuthenticated) {
    navigate('/dashboard');
    return null;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!email || !password) {
      setError('Por favor completa todos los campos');
      setIsLoading(false);
      return;
    }

    const { error } = await signIn(email, password);
    
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setError('Credenciales incorrectas. Intenta de nuevo.');
      } else if (error.message.includes('Email not confirmed')) {
        setError('Por favor confirma tu email antes de iniciar sesión.');
      } else {
        setError(error.message);
      }
      setIsLoading(false);
    } else {
      toast({
        title: "¡Bienvenido! 🎉",
        description: "Iniciando sesión...",
      });
      navigate('/dashboard');
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    if (!email || !password || !name) {
      setError('Por favor completa todos los campos');
      setIsLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      setIsLoading(false);
      return;
    }

    const { error } = await signUp(email, password, { name, role });
    
    if (error) {
      if (error.message.includes('already registered')) {
        setError('Este email ya está registrado.');
      } else {
        setError(error.message);
      }
      setIsLoading(false);
    } else {
      toast({
        title: "¡Cuenta creada! 🎉",
        description: "Tu cuenta ha sido creada exitosamente.",
      });
      const { error: loginError } = await signIn(email, password);
      if (!loginError) {
        navigate('/dashboard');
      }
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel - branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-sidebar flex-col items-center justify-center relative overflow-hidden">
        {/* Subtle background pattern */}
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

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <img src={siigoLogoBlue} alt="Siigo" className="h-10 mx-auto mb-3" />
            <p className="text-sm font-semibold text-primary">Gamificación</p>
          </div>

        {/* Card de login */}
        <div className="bg-card rounded-2xl shadow-smooth-xl p-8 border border-border">
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">Iniciar Sesión</TabsTrigger>
              <TabsTrigger value="signup">Registrarse</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-6">
                {/* Email */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Correo electrónico
                  </label>
                  <Input
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 rounded-xl border-2 focus:border-primary transition-all"
                    disabled={isLoading}
                  />
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Contraseña
                  </label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 rounded-xl border-2 focus:border-primary transition-all"
                    disabled={isLoading}
                  />
                </div>

                {/* Error message */}
                {error && (
                  <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Submit button */}
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 text-lg font-bold bg-gradient-primary hover:opacity-90 shadow-smooth-lg hover:shadow-smooth-xl transition-all hover:scale-[1.02] rounded-xl"
                >
                  {isLoading ? 'Iniciando...' : 'Iniciar Sesión'}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-6">
                {/* Dev mode warning */}
                <div className="text-xs text-amber-700 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-300 p-2 rounded-lg text-center border border-amber-200 dark:border-amber-700">
                  ⚠️ Modo desarrollo: Selector de rol habilitado
                </div>

                {/* Name */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    Nombre completo
                  </label>
                  <Input
                    type="text"
                    placeholder="Tu nombre"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-12 rounded-xl border-2 focus:border-primary transition-all"
                    disabled={isLoading}
                  />
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Correo electrónico
                  </label>
                  <Input
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-12 rounded-xl border-2 focus:border-primary transition-all"
                    disabled={isLoading}
                  />
                </div>

                {/* Password */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Contraseña
                  </label>
                  <Input
                    type="password"
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-12 rounded-xl border-2 focus:border-primary transition-all"
                    disabled={isLoading}
                  />
                </div>

                {/* Role selector (dev only) */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Rol (Solo para pruebas)
                  </label>
                  <Select value={role} onValueChange={(value) => setRole(value as AppRole)} disabled={isLoading}>
                    <SelectTrigger className="h-12 rounded-xl border-2 focus:border-primary transition-all bg-background">
                      <SelectValue placeholder="Selecciona un rol" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border border-border">
                      <SelectItem value="ADMINISTRADOR">🔴 Administrador</SelectItem>
                      <SelectItem value="GERENTE">🟡 Gerente</SelectItem>
                      <SelectItem value="EJECUTIVO">🟢 Ejecutivo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Error message */}
                {error && (
                  <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Submit button */}
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 text-lg font-bold bg-gradient-primary hover:opacity-90 shadow-smooth-lg hover:shadow-smooth-xl transition-all hover:scale-[1.02] rounded-xl"
                >
                  {isLoading ? 'Creando cuenta...' : 'Crear Cuenta'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
