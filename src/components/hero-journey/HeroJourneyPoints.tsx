import { cn } from '@/lib/utils';

const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn("material-icons-outlined", className)}>{icon}</span>
);

const pointRows = [
  { action: 'Registrar prospecto', pts: '1 pt' },
  { action: 'Llamada / Contacto', pts: '2 pts' },
  { action: 'Completar Reunión / Demo', pts: '5 pts' },
  { action: 'Enviar Propuesta Formal', pts: '5 pts' },
  { action: 'Cerrar Venta (Contrato)', pts: '10 pts' },
  { action: 'Venta de Alto Valor', pts: '15–20 pts' },
  { action: 'Reconocimiento a compañero', pts: '1–2 pts' },
  { action: 'Alcanzar Meta Mensual', pts: '+10 pts' },
  { action: 'Obtener Medalla / Insignia', pts: '+5 pts' },
];

const HeroJourneyPoints = () => (
  <div className="rounded-xl border border-border bg-card p-6 space-y-4">
    <div className="flex items-center gap-2">
      <MI icon="scoreboard" className="text-primary text-xl" />
      <h3 className="text-base font-bold text-foreground">Tabla de Puntos</h3>
    </div>
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border">
          <th className="text-left py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Acción</th>
          <th className="text-right py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Puntos</th>
        </tr>
      </thead>
      <tbody>
        {pointRows.map((row, i) => (
          <tr key={i} className="border-b border-border/50 last:border-0">
            <td className="py-2.5 text-foreground">{row.action}</td>
            <td className="py-2.5 text-right font-bold text-primary">{row.pts}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

export default HeroJourneyPoints;
