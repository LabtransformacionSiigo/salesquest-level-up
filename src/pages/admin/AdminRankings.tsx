import { useState } from 'react';
import Layout from '@/components/layout/Layout';
import Rankings from '@/pages/Rankings';
import { cn } from '@/lib/utils';
import flagCol from '@/assets/flags/colombia.svg';
import flagMex from '@/assets/flags/mexico.svg';
import flagEcu from '@/assets/flags/ecuador.svg';
import flagUru from '@/assets/flags/uruguay.svg';

type Canal = 'VC' | 'VN_ALIADOS' | 'VN_EMPRESARIOS';
type Vista = 'comerciales' | 'gerentes';

const CANALES: { value: Canal; label: string }[] = [
  { value: 'VC', label: 'Venta Cruzada' },
  { value: 'VN_ALIADOS', label: 'Venta Nueva Aliados' },
  { value: 'VN_EMPRESARIOS', label: 'Venta Nueva Empresarios' },
];

const PAISES_POR_CANAL: Record<Canal, string[]> = {
  VC: ['COL', 'MEX'],
  VN_ALIADOS: ['COL', 'ECU', 'MEX', 'URU'],
  VN_EMPRESARIOS: ['COL', 'ECU', 'MEX'],
};

const PAIS_LABEL: Record<string, string> = { COL: 'Colombia', MEX: 'México', ECU: 'Ecuador', URU: 'Uruguay' };
const PAIS_FLAG: Record<string, string> = { COL: flagCol, MEX: flagMex, ECU: flagEcu, URU: flagUru };

const pill = (active: boolean) =>
  cn(
    'px-4 py-2 rounded-full text-sm font-semibold transition-all border-2 flex items-center gap-2',
    active
      ? 'bg-primary text-primary-foreground border-primary'
      : 'bg-card border-border text-muted-foreground hover:border-primary/40'
  );

const AdminRankings = () => {
  const [canal, setCanal] = useState<Canal>('VC');
  const [pais, setPais] = useState<string>('COL');
  const [vista, setVista] = useState<Vista>('comerciales');

  const paises = PAISES_POR_CANAL[canal];

  const handleCanal = (next: Canal) => {
    setCanal(next);
    if (!PAISES_POR_CANAL[next].includes(pais)) setPais(PAISES_POR_CANAL[next][0]);
  };

  const canalLabel = CANALES.find((c) => c.value === canal)?.label || canal;
  const vistaLabel = vista === 'gerentes' ? 'Gerentes' : canal === 'VC' ? 'Comerciales' : 'Asesores';

  return (
    <Layout title="🏆 Rankings globales">
      <div className="space-y-6">
        <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Canal</p>
            <div className="flex flex-wrap gap-2">
              {CANALES.map((c) => (
                <button key={c.value} onClick={() => handleCanal(c.value)} className={pill(canal === c.value)}>
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">País</p>
            <div className="flex flex-wrap gap-2">
              {paises.map((p) => (
                <button key={p} onClick={() => setPais(p)} className={pill(pais === p)}>
                  <img src={PAIS_FLAG[p]} alt="" className="w-5 h-5 rounded-sm" />
                  {PAIS_LABEL[p] || p}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Vista</p>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setVista('comerciales')} className={pill(vista === 'comerciales')}>
                👤 {canal === 'VC' ? 'Comerciales' : 'Asesores'}
              </button>
              <button onClick={() => setVista('gerentes')} className={pill(vista === 'gerentes')}>
                👥 Gerentes
              </button>
            </div>
          </div>
        </div>

        <p className="text-sm font-semibold text-muted-foreground">
          {canalLabel} · {PAIS_LABEL[pais] || pais} · {vistaLabel}
        </p>

        <Rankings
          key={`${canal}-${pais}-${vista}`}
          canalOverride={canal}
          paisOverride={pais}
          tabOverride={vista}
          embedded
        />
      </div>
    </Layout>
  );
};

export default AdminRankings;
