import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn("material-icons-round", className)}>{icon}</span>
);

interface ConventionSeatProps {
  currentXP: number;
  /** XP thresholds for each category */
  economyMin?: number;
  premiumMin?: number;
  businessMin?: number;
  conventionDate?: Date;
}

type SeatStatus = 'available' | 'yours' | 'reserved' | 'occupied';

const ConventionSeat = ({
  currentXP,
  economyMin = 3000,
  premiumMin = 5000,
  businessMin = 7000,
  conventionDate = new Date('2025-11-15'),
}: ConventionSeatProps) => {
  const now = new Date();
  const daysLeft = Math.max(0, Math.ceil((conventionDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  const qualified = currentXP >= economyMin;
  const currentCategory =
    currentXP >= businessMin ? 'Business' :
    currentXP >= premiumMin ? 'Premium Economy' :
    currentXP >= economyMin ? 'Economy' : null;

  const nextCategory =
    currentCategory === 'Economy' ? 'Premium Economy' :
    currentCategory === 'Premium Economy' ? 'Business' :
    currentCategory === 'Business' ? null : 'Economy';

  const nextThreshold =
    nextCategory === 'Economy' ? economyMin :
    nextCategory === 'Premium Economy' ? premiumMin :
    nextCategory === 'Business' ? businessMin : 0;

  const ptsRemaining = Math.max(0, nextThreshold - currentXP);

  // Generate seat statuses
  const generateSeats = () => {
    const sections: { name: string; seats: { number: number; status: SeatStatus }[] }[] = [
      {
        name: 'Business',
        seats: [
          { number: 1, status: currentCategory === 'Business' ? 'yours' : 'available' },
          { number: 2, status: 'reserved' },
          { number: 3, status: 'occupied' },
        ],
      },
      {
        name: 'Premium',
        seats: [
          { number: 4, status: currentCategory === 'Premium Economy' ? 'yours' : 'occupied' },
          { number: 5, status: 'reserved' },
          { number: 6, status: 'available' },
          { number: 7, status: 'occupied' },
        ],
      },
      {
        name: 'Economy',
        seats: [
          { number: 8, status: 'occupied' },
          { number: 9, status: 'available' },
          { number: 10, status: currentCategory === 'Economy' ? 'yours' : 'reserved' },
          { number: 11, status: 'occupied' },
          { number: 12, status: 'available' },
          { number: 13, status: 'reserved' },
          { number: 14, status: 'occupied' },
        ],
      },
    ];
    return sections;
  };

  const seatColor: Record<SeatStatus, string> = {
    available: 'bg-secondary/20 border-secondary text-secondary',
    yours: 'bg-primary/20 border-primary text-primary ring-2 ring-primary/30',
    reserved: 'bg-muted border-border text-muted-foreground',
    occupied: 'bg-destructive/15 border-destructive/30 text-destructive/60',
  };

  const legendItems: { status: SeatStatus; label: string; dotClass: string }[] = [
    { status: 'available', label: 'Disponible', dotClass: 'bg-secondary' },
    { status: 'yours', label: 'Tu Categoría', dotClass: 'bg-primary' },
    { status: 'reserved', label: 'Reservado', dotClass: 'bg-muted-foreground/40' },
    { status: 'occupied', label: 'Ocupado', dotClass: 'bg-destructive/60' },
  ];

  if (!qualified) {
    // Airport waiting view
    return (
      <Card className="p-5 flex flex-col items-center text-center">
        <h3 className="text-base font-bold text-foreground mb-1 flex items-center gap-2">
          <MI icon="flight_takeoff" className="text-primary text-xl" />
          Convención 2025
        </h3>
        <p className="text-xs text-muted-foreground mb-6">
          Faltan <span className="font-bold text-foreground">{daysLeft} días</span> para la convención
        </p>

        {/* Airport illustration */}
        <div className="relative w-full max-w-[280px] mb-6">
          {/* Terminal background */}
          <div className="bg-muted/50 rounded-2xl p-6 border border-border">
            {/* Window */}
            <div className="flex justify-center gap-3 mb-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="w-12 h-8 rounded-t-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <MI icon="cloud" className="text-primary/30 text-sm" />
                </div>
              ))}
            </div>
            {/* Person waiting */}
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center mb-2 animate-bounce-slow">
                <MI icon="person" className="text-primary text-3xl" />
              </div>
              <div className="flex items-center gap-1 mb-2">
                <MI icon="luggage" className="text-muted-foreground text-lg" />
                <MI icon="work" className="text-muted-foreground text-lg" />
              </div>
              {/* Bench */}
              <div className="w-24 h-2 bg-muted-foreground/20 rounded-full" />
            </div>
            {/* Plane in distance */}
            <div className="flex justify-end mt-3">
              <MI icon="flight" className="text-muted-foreground/30 text-2xl" />
            </div>
          </div>
        </div>

        <p className="text-sm text-muted-foreground">
          Necesitas <span className="text-primary font-bold">{ptsRemaining.toLocaleString()} pts</span> más para abordar
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          ¡Sigue vendiendo para asegurar tu asiento! ✈️
        </p>
      </Card>
    );
  }

  // Qualified - show airplane seats
  const sections = generateSeats();

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
          <MI icon="flight_takeoff" className="text-primary text-xl" />
          Convención 2025
        </h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Faltan <span className="font-bold text-foreground">{daysLeft} días</span> para la convención... ¿Ya tienes tu silla?
      </p>

      {/* Next upgrade info */}
      {nextCategory && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Próximo Upgrade</p>
            <p className="text-sm font-bold text-foreground">{nextCategory}</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-primary">{ptsRemaining.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">pts restantes</p>
          </div>
        </div>
      )}

      {!nextCategory && (
        <div className="bg-secondary/10 border border-secondary/20 rounded-xl p-3 mb-4 text-center">
          <p className="text-sm font-bold text-secondary">🎉 ¡Categoría máxima alcanzada!</p>
        </div>
      )}

      {/* Airplane body */}
      <div className="relative bg-muted/30 rounded-[2rem] border border-border p-4 pt-8 overflow-hidden">
        {/* Nose of plane */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1 w-16 h-4 bg-muted/60 rounded-t-full border-x border-t border-border" />

        {sections.map((section) => (
          <div key={section.name} className="mb-3 last:mb-0">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1.5 text-center">
              {section.name}
            </p>
            <div className="flex justify-center gap-1.5 flex-wrap">
              {section.seats.map((seat) => (
                <div
                  key={seat.number}
                  className={cn(
                    "w-9 h-9 rounded-lg border flex items-center justify-center text-xs font-bold transition-all",
                    seatColor[seat.status],
                    seat.status === 'yours' && "animate-pulse-glow"
                  )}
                >
                  {seat.status === 'yours' ? (
                    <MI icon="airline_seat_recline_extra" className="text-sm" />
                  ) : (
                    seat.number
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Aisle line */}
        <div className="absolute top-8 bottom-4 left-1/2 -translate-x-1/2 w-px bg-border/50" />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-3 mt-3">
        {legendItems.map((item) => (
          <div key={item.status} className="flex items-center gap-1">
            <div className={cn("w-2.5 h-2.5 rounded-full", item.dotClass)} />
            <span className="text-[10px] text-muted-foreground">{item.label}</span>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default ConventionSeat;
