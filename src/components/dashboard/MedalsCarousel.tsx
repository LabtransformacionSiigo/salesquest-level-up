import { useState, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

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
        <Star className="w-5 h-5 text-accent" />
      </div>

      <div className="relative">
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 bg-card/80 backdrop-blur-sm shadow-smooth-sm"
          onClick={() => scroll('left')}
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>

        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide px-8 py-1"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {medals.map((medal, i) => (
            <div
              key={i}
              className={cn(
                "flex-shrink-0 w-20 flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all",
                medal.earned
                  ? "bg-primary/5 border border-primary/20"
                  : "bg-muted/50 border border-border opacity-50"
              )}
            >
              <span className="text-2xl">{medal.icon}</span>
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
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
};

export default MedalsCarousel;
