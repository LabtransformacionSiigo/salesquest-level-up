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
  { id: 'IMPULSO_PAR', nombre: 'Impulso', sp_para: 80, sp_de: 20, desc: 'Destacar cualquier logro de un colega', emoji: '👏' },
  { id: 'PALABRA_LIDERAZGO', nombre: 'Liderazgo', sp_para: 120, sp_de: 30, desc: 'Reconocer liderazgo en momentos clave', emoji: '🌟' },
  { id: 'SELLO_EXCELENCIA', nombre: 'Excelencia', sp_para: 200, sp_de: 50, desc: 'El mejor resultado del mes (1 vez/mes)', emoji: '💎' },
  { id: 'RECONOCIMIENTO_CUMBRE', nombre: 'Cumbre', sp_para: 300, sp_de: 60, desc: 'Para momentos extraordinarios (1 vez/trimestre)', emoji: '🏆' },
];

const getISOWeek = (d: Date) => {
  const date = new Date(d.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
};

const Reconocimientos = () => {
  const { profile, isAuthenticated, loading } = useSupabaseAuthContext();
  const { toast } = useToast();
  const [asesores, setAsesores] = useState<any[]>([]);
  const [feed, setFeed] = useState<any[]>([]);
  const [sentCount, setSentCount] = useState(0);
  const [cumbresTrimestre, setCumbresTrimestre] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedGerente, setSelectedGerente] = useState('');
  const [selectedTipo, setSelectedTipo] = useState('');
  const [mensaje, setMensaje] = useState('');

  const currentWeek = getISOWeek(new Date());
  const currentYear = new Date().getFullYear();
  const trimestre = Math.ceil((new Date().getMonth() + 1) / 3);
  const trimestreStart = `${currentYear}-${String((trimestre - 1) * 3 + 1).padStart(2, '0')}-01`;
  const trimestreEnd = trimestre === 4
    ? `${currentYear + 1}-01-01`
    : `${currentYear}-${String(trimestre * 3 + 1).padStart(2, '0')}-01`;

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
      const [colaboradoresRes, feedRes, countRes, cumbreRes] = await Promise.all([
        colaboradoresPromise,
        supabase.from('feed_reconocimientos').select('*').limit(20),
        supabase.from('reconocimientos').select('id', { count: 'exact' }).eq('de_gerente_id', profile.id).eq('semana_iso', currentWeek).eq('anio', currentYear),
        supabase.from('reconocimientos').select('id', { count: 'exact' }).eq('de_gerente_id', profile.id).eq('tipo', 'RECONOCIMIENTO_CUMBRE').gte('created_at', trimestreStart).lt('created_at', trimestreEnd),
      ]);
      const colabs = (colaboradoresRes.data || []).map((c: any) => ({ id: c.id || null, nombre: c.nombre }));
      setAsesores(colabs);
      setFeed(feedRes.data || []);
      setSentCount(countRes.count || 0);
      setCumbresTrimestre(cumbreRes.count || 0);
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
    if (sentCount >= 6) { toast({ title: 'Límite alcanzado', description: 'Solo puedes enviar 6 reconocimientos por semana', variant: 'destructive' }); return; }
    if (selectedTipo === 'RECONOCIMIENTO_CUMBRE' && cumbresTrimestre >= 1) { toast({ title: 'No disponible', description: `Ya usaste tu reconocimiento Cumbre este trimestre.`, variant: 'destructive' }); return; }
    const tipo = TIPOS_RECONOCIMIENTO.find(t => t.id === selectedTipo);
    if (!tipo) return;
    setSending(true);
    const isNameOnly = selectedGerente.startsWith('name::');
    const paraName = isNameOnly ? selectedGerente.replace('name::', '') : null;
    const paraId = isNameOnly ? null : selectedGerente;
    const { error } = await supabase.from('reconocimientos').insert({
      de_gerente_id: profile.id, para_gerente_id: paraId, para_nombre: paraName,
      tipo: selectedTipo, sp_para: tipo.sp_para, sp_de: tipo.sp_de,
      semana_iso: currentWeek, anio: currentYear, mensaje: mensaje || null,
    } as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); }
    else {
      const spInserts = [supabase.from('sp_acumulados').insert({ gerente_id: profile.id, fuente: 'RECONOCIMIENTO_ENVIADO', sp: tipo.sp_de, periodo: `${currentYear}-W${String(currentWeek).padStart(2, '0')}`, detalle: `${tipo.nombre} enviado` })];
      if (paraId) { spInserts.push(supabase.from('sp_acumulados').insert({ gerente_id: paraId, fuente: 'RECONOCIMIENTO_RECIBIDO', sp: tipo.sp_para, periodo: `${currentYear}-W${String(currentWeek).padStart(2, '0')}`, detalle: `${tipo.nombre} de ${profile.nombre}` })); }
      await Promise.all(spInserts);
      toast({ title: '✅ ¡Reconocimiento enviado!', description: `+${tipo.sp_de} SP para ti, +${tipo.sp_para} SP para tu colaborador` });
      setSentCount(prev => prev + 1);
      if (selectedTipo === 'RECONOCIMIENTO_CUMBRE') setCumbresTrimestre(prev => prev + 1);
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
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        <motion.div className="lg:col-span-1 space-y-4" variants={fadeUpItem}>
          {!isGerente ? (
            <motion.div className="bg-card border border-border border-t-[3px] border-t-primary rounded-2xl p-6 text-center shadow-smooth-sm" variants={popIn}>
              <motion.span className="text-4xl mb-2 block" animate={{ rotate: [0, -5, 5, 0] }} transition={{ duration: 2, repeat: Infinity }}>🔒</motion.span>
              <p className="text-sm font-semibold text-foreground">Solo para Gerentes</p>
              <p className="text-xs text-muted-foreground mt-1">Los reconocimientos solo pueden ser entregados por gerentes.</p>
            </motion.div>
          ) : (
            <>
              <motion.div className="bg-card border border-border border-t-[3px] border-t-primary rounded-2xl p-5 text-center shadow-smooth-sm" variants={popIn}>
                <p className="text-sm text-muted-foreground">Reconocimientos esta semana</p>
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
                  <motion.div className="grid grid-cols-2 gap-2" variants={staggerContainer} initial="hidden" animate="show">
                    {TIPOS_RECONOCIMIENTO.map(tipo => {
                      const isCumbreUsed = tipo.id === 'RECONOCIMIENTO_CUMBRE' && cumbresTrimestre >= 1;
                      return (
                        <motion.button
                          key={tipo.id}
                          onClick={() => !isCumbreUsed && setSelectedTipo(tipo.id)}
                          disabled={isCumbreUsed}
                          variants={popIn}
                          whileHover={!isCumbreUsed ? { scale: 1.05, y: -2 } : {}}
                          whileTap={!isCumbreUsed ? { scale: 0.95 } : {}}
                          className={cn("p-3 rounded-xl border text-center transition-all text-xs relative",
                            isCumbreUsed ? "border-border bg-muted/30 text-muted-foreground opacity-50 cursor-not-allowed"
                              : selectedTipo === tipo.id ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-white text-muted-foreground hover:border-primary/50")}
                        >
                          <span className="text-lg block mb-1">{tipo.emoji}</span>
                          <span className="font-medium text-[10px] block">{tipo.nombre}</span>
                          <span className="text-[9px] text-muted-foreground block font-scoreboard">+{tipo.sp_para} SP</span>
                          {isCumbreUsed && <span className="absolute top-1 right-1 text-[8px] bg-destructive text-white px-1.5 py-0.5 rounded-full font-bold">Usado Q{trimestre}</span>}
                        </motion.button>
                      );
                    })}
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

        <motion.div className="lg:col-span-2" variants={fadeUpItem}>
          <div className="bg-card border border-border rounded-2xl p-5 shadow-smooth-sm">
            <h3 className="text-sm font-semibold font-heading text-secondary mb-4 flex items-center gap-2">
              <span>📢</span> Feed en Vivo
              <span className="text-[10px] text-white bg-primary px-2 py-0.5 rounded-full ml-auto flex items-center gap-1">
                <motion.span
                  className="w-1.5 h-1.5 rounded-full bg-white"
                  animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                /> EN VIVO
              </span>
            </h3>

            {dataLoading ? (
              <div className="space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16" />)}</div>
            ) : feed.length > 0 ? (
              <motion.div className="space-y-3" variants={staggerContainer} initial="hidden" animate="show">
                {feed.map((r, idx) => {
                  const tipo = TIPOS_RECONOCIMIENTO.find(t => t.id === r.tipo);
                  return (
                    <motion.div
                      key={r.id}
                      className="flex items-start gap-3 p-3 bg-muted/50 rounded-xl border border-border"
                      variants={fadeUpItem}
                      whileHover={{ x: 4, backgroundColor: 'hsl(var(--muted) / 0.8)', transition: { duration: 0.15 } }}
                    >
                      <motion.span
                        className="text-2xl mt-0.5"
                        initial={{ scale: 0, rotate: -30 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: idx * 0.05 + 0.3 }}
                      >{tipo?.emoji || '🎖️'}</motion.span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">
                          <span className="font-semibold">{r.de_nombre}</span>
                          <span className="text-muted-foreground"> reconoció a </span>
                          <span className="font-semibold">{r.para_nombre}</span>
                        </p>
                        <p className="text-xs text-primary font-medium">{tipo?.nombre || r.tipo}</p>
                        {r.mensaje && <p className="text-xs text-muted-foreground italic mt-1">"{r.mensaje}"</p>}
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-[10px] text-accent font-semibold font-scoreboard">+{r.sp_para} SP</span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(r.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>
            ) : (
              <motion.div className="text-center py-12 text-muted-foreground" variants={fadeUpItem}>
                <motion.img
                  src={reconocimientoImg}
                  alt="Reconocimientos"
                  className="w-20 h-20 mx-auto mb-3 opacity-40"
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                />
                <p>Sé el primero en reconocer a un colaborador</p>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </Layout>
  );
};

export default Reconocimientos;
