import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trophy, Mail, Lock, AlertCircle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Por favor completa todos los campos');
      return;
    }

    const success = login(email, password);
    if (success) {
      toast({
        title: "¡Bienvenido! 🎉",
        description: "Iniciando sesión...",
      });
      navigate('/dashboard');
    } else {
      setError('Credenciales incorrectas. Intenta de nuevo.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo y título */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-primary rounded-3xl mb-4 shadow-smooth-lg hover:scale-110 transition-transform duration-300">
            <Trophy className="w-10 h-10 text-primary-foreground" />
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-2">SalesQuest</h1>
          <p className="text-lg text-muted-foreground font-medium">
            ¡Prepárate para alcanzar tus metas! 🚀
          </p>
        </div>

        {/* Card de login */}
        <div className="bg-card rounded-2xl shadow-smooth-xl p-8 border border-border">
          <form onSubmit={handleSubmit} className="space-y-6">
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
              className="w-full h-12 text-lg font-bold bg-gradient-primary hover:opacity-90 shadow-smooth-lg hover:shadow-smooth-xl transition-all hover:scale-[1.02] rounded-xl"
            >
              Iniciar Sesión
            </Button>
          </form>

          {/* Usuarios de prueba */}
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-xs text-muted-foreground text-center mb-3 font-semibold">
              USUARIOS DE PRUEBA
            </p>
            <div className="space-y-2 text-xs">
              <div className="p-2 bg-muted rounded-lg">
                <p className="font-semibold text-foreground">Ejecutivo:</p>
                <p className="text-muted-foreground">ejecutivo@salesquest.com / ejecutivo123</p>
              </div>
              <div className="p-2 bg-muted rounded-lg">
                <p className="font-semibold text-foreground">Gerente:</p>
                <p className="text-muted-foreground">gerente@salesquest.com / gerente123</p>
              </div>
              <div className="p-2 bg-muted rounded-lg">
                <p className="font-semibold text-foreground">Admin:</p>
                <p className="text-muted-foreground">admin@salesquest.com / admin123</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
