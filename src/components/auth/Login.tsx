import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { lovable } from '@/integrations/lovable/index';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import siigoLogoBlue from '@/assets/siigo-logo-blue.png';
import logoIncentivos from '@/assets/logo-incentivos.png';
import bannerPrincipal from '@/assets/banner-principal.png';

import { Variants } from 'framer-motion';

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.3 } },
};
const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
};
const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  show: { opacity: 1, scale: 1, transition: { type: 'spring' as const, stiffness: 200, damping: 18, delay: 0.5 } },
};
const slideRight: Variants = {
  hidden: { opacity: 0, x: 60 },
  show: { opacity: 1, x: 0, transition: { duration: 0.7, ease: 'easeOut' } },
};

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
      {/* Left panel */}
      <motion.div
        className="hidden lg:flex lg:w-[520px] flex-col items-center justify-center relative"
        style={{ backgroundImage: `url(${bannerPrincipal})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
        initial={{ opacity: 0, x: -60 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <div className="absolute inset-0 bg-secondary/60" />
        <motion.div
          className="text-center px-12 relative z-10"
          variants={stagger}
          initial="hidden"
          animate="show"
        >
          <motion.img src={logoIncentivos} alt="Siigo Arena" className="h-10 mx-auto mb-8" variants={fadeUp} />
          <motion.h1 className="text-4xl font-black font-heading text-white mb-2" variants={fadeUp}>Siigo Arena</motion.h1>
          <motion.p className="text-xl font-bold text-white/90 mb-2" variants={fadeUp}>Plataforma de Gamificación</motion.p>
          <motion.p className="text-sm text-white/70 max-w-xs mx-auto" variants={fadeUp}>Potencia tus resultados comerciales con Siigo Points</motion.p>
          <motion.div className="mt-10 grid grid-cols-3 gap-6 text-white/80 text-xs" variants={stagger}>
            {[
              { emoji: '🏅', label: 'Medallas' },
              { emoji: '🎯', label: 'Retos' },
              { emoji: '📊', label: 'Rankings' },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                className="flex flex-col items-center gap-2"
                variants={scaleIn}
                whileHover={{ scale: 1.1, y: -4, transition: { duration: 0.2 } }}
              >
                <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-2xl">
                  {item.emoji}
                </div>
                <span className="font-semibold">{item.label}</span>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
        <motion.img
          src={logoIncentivos}
          alt="Siigo Arena"
          className="absolute bottom-6 right-6 h-6 opacity-40 z-10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ delay: 1.2, duration: 0.5 }}
        />
      </motion.div>

      {/* Right panel */}
      <motion.div
        className="flex-1 flex items-center justify-center p-8 bg-white"
        variants={slideRight}
        initial="hidden"
        animate="show"
      >
        <div className="w-full max-w-sm">
          <motion.div className="lg:hidden text-center mb-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <img src={siigoLogoBlue} alt="Siigo" className="h-8 mx-auto mb-3" />
            <p className="text-lg font-bold text-primary font-heading">Siigo Arena</p>
          </motion.div>
          <motion.div
            className="bg-white border border-border rounded-3xl p-8 space-y-6 shadow-smooth-md"
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <div>
              <h2 className="text-2xl font-black font-heading text-secondary mb-1">Iniciar Sesión</h2>
              <p className="text-sm text-muted-foreground">Accede con tu cuenta corporativa</p>
            </div>
            {error && (
              <motion.div
                className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" /><span>{error}</span>
              </motion.div>
            )}
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <motion.div className="space-y-1.5" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}>
                <label className="text-xs font-bold text-secondary">Correo electrónico</label>
                <Input type="email" placeholder="nombre@siigo.com" value={email} onChange={e => setEmail(e.target.value)} required className="h-12 rounded-xl bg-muted border-border" />
              </motion.div>
              <motion.div className="space-y-1.5" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }}>
                <label className="text-xs font-bold text-secondary">Contraseña</label>
                <Input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required className="h-12 rounded-xl bg-muted border-border" />
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}>
                <Button type="submit" disabled={isLoading} className="w-full h-12 text-base" size="lg">
                  {isLoading ? 'Ingresando...' : 'Ingresar'}
                </Button>
              </motion.div>
            </form>
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
              <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-3 text-muted-foreground font-semibold">o</span></div>
            </div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 }}>
              <Button type="button" variant="outline" disabled={isLoading}
                onClick={async () => { setError(''); setIsLoading(true); const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin }); if (result?.error) { setError(result.error.message || 'Error'); setIsLoading(false); } }}
                className="w-full h-12 text-base flex items-center justify-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
                Continuar con Google
              </Button>
            </motion.div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
};

export default Login;
