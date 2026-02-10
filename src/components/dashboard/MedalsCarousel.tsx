import { useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const MI = ({ icon, className }: { icon: string; className?: string }) => (
  <span className={cn("material-icons-outlined", className)}>{icon}</span>
);

interface MedalItem {
  icon: string;
  name: string;
  earned: boolean;
}

interface MedalsCarouselProps {
  earnedCount: number;
  totalCount: number;
  medals: MedalItem[];
}

const MedalsCarousel = ({ earnedCount, totalCount, medals }: MedalsCarouselProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: 'left' | 'right') => {
    if (scrollRef.current) {
      const amount = dir === 'left' ? -200 : 200;
      scrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-foreground">Medallas</h3>
          <span className="text-sm text-muted-foreground">{earnedCount} / {totalCount}</span>
        </div>
        <MI icon="stars" className="text-accent text-xl" />
      </div>

      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-card/80 backdrop-blur-sm shadow-smooth-sm"
          onClick={() => scroll('left')}
        >
          <MI icon="chevron_left" className="text-lg" />
        </Button>

        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto px-8 py-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {medals.map((medal, i) => (
            <div
              key={i}
              className={cn(
                "flex-shrink-0 w-20 flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all border",
                medal.earned
                  ? "bg-primary/5 border-primary/20"
                  : "bg-muted/50 border-border opacity-50"
              )}
            >
              <MI icon={medal.icon} className={cn(
                "text-2xl",
                medal.earned ? "text-primary" : "text-muted-foreground"
              )} />
              <span className="text-[10px] font-medium text-center text-foreground leading-tight line-clamp-2">
                {medal.name}
              </span>
            </div>
          ))}
        </div>

        <Button
          variant="ghost"
          size="icon"
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-card/80 backdrop-blur-sm shadow-smooth-sm"
          onClick={() => scroll('right')}
        >
          <MI icon="chevron_right" className="text-lg" />
        </Button>
      </div>
    </Card>
  );
};

export default MedalsCarousel;
