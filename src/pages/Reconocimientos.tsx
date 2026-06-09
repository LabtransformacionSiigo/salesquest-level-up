import { useSupabaseAuthContext } from '@/context/SupabaseAuthContext';
import { Navigate } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import { staggerContainer, fadeUpItem, popIn } from '@/lib/animations';
import reconocimientoImg from '@/assets/reconocimiento.png';

const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn("material-icons-outlined", className)}>{icon}</span>
);

const TIPOS_RECONOCIMIENTO = [
  { id: 'NOS_APASIONA_AYUDAR', nombre: 'Nos apasiona ayudar', sp_para: 10, sp_de: 0, desc: 'Destaca la pasión por servir y ayudar a los demás', emoji: '❤️' },
  { id: 'MENTALIDAD_GANADORA', nombre: 'Tenemos mentalidad ganadora', sp_para: 10, sp_de: 0, desc: 'Reconoce la actitud competitiva y orientada a resultados', emoji: '🏆' },
  { id: 'ACTITUD_ALEGRIA', nombre: '100% Actitud y Alegría', sp_para: 10, sp_de: 0, desc: 'Celebra la energía positiva y el entusiasmo contagioso', emoji: '🎉' },
  { id: 'HUMILDES_AMOROSOS', nombre: 'Somos Humildes y Amorosos', sp_para: 10, sp_de: 0, desc: 'Valora la humildad y el trato amoroso con el equipo', emoji: '🤗' },
  { id: 'INNOVAMOS', nombre: 'Innovamos y no paramos de aprender', sp_para: 10, sp_de: 0, desc: 'Reconoce la curiosidad, innovación y aprendizaje continuo', emoji: '💡' },
  { id: 'NOS_DECIMOS_TODO', nombre: 'Nos Decimos todo', sp_para: 10, sp_de: 0, desc: 'Celebra la transparencia y comunicación abierta', emoji: '🗣️' },
];


const Reconocimientos = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  const { toast } = useToast();
  const [asesores, setAsesores] = useState<any[]>([]);
  const [feed, setFeed] = useState<any[]>([]);
  const [sentCount, setSentCount] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedGerente, setSelectedGerente] = useState('');
  const [selectedTipo, setSelectedTipo] = useState('');
  const [mensaje, setMensaje] = useState('');

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const mesStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
  const mesEnd = currentMonth === 12
    ? `${currentYear + 1}-01-01`
    : `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;

  useEffect(() => {
    if (!profile?.id) return;

    const fetchData = async () => {
      const isVC = profile.canal === 'VC';
      let colaboradoresPromise;
      if (isVC) {
        colaboradoresPromise = supabase.from('comerciales_por_gerente' as any).select('nombre, gerente_id').eq('gerente_id', profile.id);
      } else {
        colaboradoresPromise = supabase.from('asesores').select('id, nombre, avatar_url').eq('gerente_id', profile.id).eq('activo', true);
      }
      const [colaboradoresRes, feedRes, countRes] = await Promise.all([
        colaboradoresPromise,
        supabase.from('feed_reconocimientos').select('*').limit(20),
        supabase.from('reconocimientos').select('id', { count: 'exact' }).eq('de_gerente_id', profile.id).gte('created_at', mesStart).lt('created_at', mesEnd),
      ]);
      let colabs = (colaboradoresRes.data || []).map((c: any) => ({ id: c.id || null, nombre: c.nombre }));

      // Fallback VN: si no hay asesores asignados, traer desde metas_asesores por célula del mes actual
      if (!isVC && colabs.length === 0 && profile?.celula) {
        const periodo = `${currentYear}${String(currentMonth).padStart(2, '0')}`;
        let { data: metas } = await supabase
          .from('metas_asesores')
          .select('nombre_asesor, documento_asesor')
          .eq('celula', profile.celula)
          .eq('anio_mes', periodo);
        // Si no hay del mes actual, intentar el mes anterior
        if (!metas || metas.length === 0) {
          const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
          const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
          const prevPeriodo = `${prevYear}${String(prevMonth).padStart(2, '0')}`;
          const res = await supabase
            .from('metas_asesores')
            .select('nombre_asesor, documento_asesor')
            .eq('celula', profile.celula)
            .eq('anio_mes', prevPeriodo);
          metas = res.data;
        }
        const seen = new Set<string>();
        colabs = (metas || [])
          .map((m: any) => String(m.nombre_asesor || '').trim())
          .filter((n: string) => n && !n.startsWith('CEL_') && !seen.has(n.toLowerCase()) && seen.add(n.toLowerCase()))
          .map((n: string) => ({ id: null, nombre: n }));
      }

      setAsesores(colabs);
      setFeed(feedRes.data || []);
      setSentCount(countRes.count || 0);
      setDataLoading(false);
    };

    fetchData();
    const channel = supabase.channel('reconocimientos-feed').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reconocimientos' }, () => {
      supabase.from('feed_reconocimientos').select('*').limit(20).then(({ data }) => setFeed(data || []));
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id]);

  const handleSend = async () => {
    if (!profile?.id || !selectedGerente || !selectedTipo) return;
    if (sentCount >= 6) { toast({ title: 'Límite alcanzado', description: 'Solo puedes enviar 6 reconocimientos al mes', variant: 'destructive' }); return; }
    const tipo = TIPOS_RECONOCIMIENTO.find(t => t.id === selectedTipo);
    if (!tipo) return;
    setSending(true);
    const isNameOnly = selectedGerente.startsWith('name::');
    const paraName = isNameOnly ? selectedGerente.replace('name::', '') : null;
    const paraId = isNameOnly ? null : selectedGerente;
    const periodoMes = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
    const { error } = await supabase.from('reconocimientos').insert({
      de_gerente_id: profile.id, para_gerente_id: paraId, para_nombre: paraName,
      tipo: selectedTipo, sp_para: tipo.sp_para, sp_de: tipo.sp_de,
      semana_iso: null, anio: currentYear, mensaje: mensaje || null,
    } as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); }
    else {
      // Only award SP Canje to the receiver (10 SP Regulares)
      if (paraId) {
        await Promise.all([
          supabase.from('sp_acumulados').insert({ gerente_id: paraId, fuente: 'RECONOCIMIENTO_RECIBIDO', sp: tipo.sp_para, periodo: periodoMes, detalle: `${tipo.nombre} de ${profile.nombre}`, tipo_sp: 'canje' } as any),
          supabase.rpc('increment_sp_canje' as any, { p_gerente_id: paraId, p_amount: tipo.sp_para }),
        ]);
      }
      toast({ title: '✅ ¡Reconocimiento enviado!', description: `+${tipo.sp_para} SP Canje para tu colaborador` });
      setSentCount(prev => prev + 1);
      setSelectedGerente(''); setSelectedTipo(''); setMensaje('');
    }
    setSending(false);
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const isGerente = profile?.role === 'gerente' || profile?.role === 'admin';

  return (
    <Layout title="🎖️ Reconocimientos">
      <motion.div
        className="max-w-2xl mx-auto"

        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        <motion.div className="space-y-4" variants={fadeUpItem}>
          {!isGerente ? (
            <motion.div className="bg-card border border-border border-t-[3px] border-t-primary rounded-2xl p-6 text-center shadow-smooth-sm" variants={popIn}>
              <motion.span className="text-4xl mb-2 block" animate={{ rotate: [0, -5, 5, 0] }} transition={{ duration: 2, repeat: Infinity }}>🔒</motion.span>
              <p className="text-sm font-semibold text-foreground">Solo para Gerentes</p>
              <p className="text-xs text-muted-foreground mt-1">Los reconocimientos solo pueden ser entregados por gerentes.</p>
            </motion.div>
          ) : (
            <>
              <motion.div className="bg-card border border-border border-t-[3px] border-t-primary rounded-2xl p-5 text-center shadow-smooth-sm" variants={popIn}>
                <p className="text-sm text-muted-foreground">Reconocimientos este mes</p>
                <motion.p
                  className="text-3xl font-bold font-scoreboard text-primary mt-1"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.3 }}
                >
                  {6 - sentCount}<span className="text-lg text-muted-foreground">/6</span>
                </motion.p>
                <p className="text-[10px] text-muted-foreground">disponibles</p>
              </motion.div>

              <motion.div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-smooth-sm" variants={fadeUpItem}>
                <h3 className="text-sm font-semibold font-heading text-secondary flex items-center gap-2">
                  <span>🎖️</span> Enviar Reconocimiento
                </h3>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">¿A quién reconoces?</label>
                  <select value={selectedGerente} onChange={e => setSelectedGerente(e.target.value)}
                    className="w-full h-10 rounded-lg border border-border bg-muted px-3 text-sm text-foreground">
                    <option value="">Seleccionar colaborador...</option>
                    {asesores.map(a => (<option key={a.id || a.nombre} value={a.id || `name::${a.nombre}`}>{a.nombre}</option>))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Tipo</label>
                  <motion.div className="grid grid-cols-3 gap-2" variants={staggerContainer} initial="hidden" animate="show">
                    {TIPOS_RECONOCIMIENTO.map(tipo => (
                        <motion.button
                          key={tipo.id}
                          onClick={() => setSelectedTipo(tipo.id)}
                          variants={popIn}
                          whileHover={{ scale: 1.05, y: -2 }}
                          whileTap={{ scale: 0.95 }}
                          className={cn("p-3 rounded-xl border text-center transition-all text-xs",
                            selectedTipo === tipo.id ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-white text-muted-foreground hover:border-primary/50")}
                        >
                          <span className="text-lg block mb-1">{tipo.emoji}</span>
                          <span className="font-medium text-[10px] block leading-tight">{tipo.nombre}</span>
                          <span className="text-[9px] text-muted-foreground block font-scoreboard">🎁 +{tipo.sp_para} SP Canje</span>
                        </motion.button>
                    ))}
                  </motion.div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Mensaje (opcional)</label>
                  <textarea value={mensaje} onChange={e => setMensaje(e.target.value)} placeholder="Escribe un mensaje..."
                    className="w-full h-20 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground resize-none" />
                </div>
                <Button onClick={handleSend} disabled={sending || !selectedGerente || !selectedTipo || sentCount >= 6} className="w-full">
                  {sending ? 'Enviando...' : '✅ Enviar Reconocimiento'}
                </Button>
              </motion.div>
            </>
          )}
        </motion.div>

        {/* Feed en Vivo eliminado por solicitud */}

      </motion.div>
    </Layout>
  );
};

export default Reconocimientos;
