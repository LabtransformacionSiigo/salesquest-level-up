import { cn } from '@/lib/utils';

const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn("material-icons-outlined", className)}>{icon}</span>
);

const objectives = [
  { icon: 'visibility', title: 'Visibilidad en Tiempo Real', desc: 'Feedback inmediato de cada acción comercial.' },
  { icon: 'bolt', title: 'Productividad Sostenible', desc: 'Esfuerzo constante sin desgaste por sprints de fin de mes.' },
  { icon: 'psychology', title: 'Maestría Comercial', desc: 'Upskilling continuo vía desafíos y reconocimientos.' },
];

const HeroJourneyObjectives = () => (
  <div className="rounded-xl bg-gradient-to-br from-primary to-[hsl(210,100%,45%)] p-6 space-y-5 text-primary-foreground">
    <div className="flex items-center gap-2">
      <MI icon="flag" className="text-xl" />
      <h3 className="text-base font-bold">Objetivos Estratégicos</h3>
    </div>
    <div className="space-y-4">
      {objectives.map((obj) => (
        <div key={obj.title} className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
            <MI icon={obj.icon} className="text-lg" />
          </div>
          <div>
            <p className="text-sm font-bold">{obj.title}</p>
            <p className="text-xs opacity-80 leading-relaxed">{obj.desc}</p>
          </div>
        </div>
      ))}
    </div>
    <div className="mt-4 pt-4 border-t border-white/20">
      <p className="text-[10px] font-bold uppercase tracking-wider opacity-60 mb-2">Impacto Proyectado</p>
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Productividad', value: '+35%' },
          { label: 'Retención', value: '+20%' },
          { label: 'Revenue', value: '+28%' },
        ].map((s) => (
          <div key={s.label} className="text-center">
            <p className="text-lg font-extrabold">{s.value}</p>
            <p className="text-[10px] opacity-70">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default HeroJourneyObjectives;
