import { cn } from '@/lib/utils';

const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn("material-icons-outlined", className)}>{icon}</span>
);

const badges = [
  { icon: 'track_changes', name: 'Francotirador', category: 'EFECTIVIDAD', categoryColor: 'text-primary', desc: 'Conversión superior al 30% en un mes.' },
  { icon: 'catching_pokemon', name: 'Alpha Wolf', category: 'VOLUMEN', categoryColor: 'text-secondary', desc: 'Cerrar el mayor número de tratos trimestrales.' },
  { icon: 'handshake', name: 'El Padrino', category: 'COLABORACIÓN', categoryColor: 'text-accent', desc: 'Recibir 5 reconocimientos de ayuda/mentoring.' },
  { icon: 'diamond', name: 'Caza Ballenas', category: 'VALOR', categoryColor: 'text-destructive', desc: 'Cerrar negocio que represente >15% de la cuota.' },
];

const HeroJourneyBadges = () => (
  <div className="rounded-xl border border-border bg-card p-6 space-y-5">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <MI icon="military_tech" className="text-accent text-2xl" />
        <div>
          <h2 className="text-lg font-bold text-foreground">Insignias y Medallas</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Coleccionables visibles en tu perfil público.</p>
        </div>
      </div>
      <div className="flex gap-2">
        <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 px-2.5 py-1 rounded-full">Achiever</span>
        <span className="text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-600 px-2.5 py-1 rounded-full">Killer</span>
      </div>
    </div>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {badges.map((badge) => (
        <div key={badge.name} className="flex flex-col items-center text-center gap-2 p-4 rounded-xl border border-border bg-muted/30">
          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
            <MI icon={badge.icon} className="text-primary text-2xl" />
          </div>
          <h4 className="text-sm font-bold text-foreground">{badge.name}</h4>
          <span className={cn("text-[10px] font-bold uppercase tracking-wider", badge.categoryColor)}>{badge.category}</span>
          <p className="text-[10px] text-muted-foreground leading-relaxed">{badge.desc}</p>
        </div>
      ))}
    </div>
  </div>
);

export default HeroJourneyBadges;
