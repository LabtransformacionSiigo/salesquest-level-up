import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CelebrationOverlayProps {
  show: boolean;
  type: 'level_up' | 'meta_cumplida';
  title?: string;
  subtitle?: string;
  onComplete?: () => void;
}

const CONFETTI_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(var(--orange))',
  '#FFD700',
  '#FF6B6B',
  '#4ECDC4',
  '#A855F7',
];

const ConfettiPiece = ({ index }: { index: number }) => {
  const color = CONFETTI_COLORS[index % CONFETTI_COLORS.length];
  const startX = Math.random() * 100;
  const endX = startX + (Math.random() - 0.5) * 60;
  const size = 6 + Math.random() * 8;
  const shape = index % 3; // 0=circle, 1=square, 2=rect

  return (
    <motion.div
      className="absolute pointer-events-none"
      style={{
        left: `${startX}%`,
        top: '-5%',
        width: shape === 2 ? size * 2 : size,
        height: size,
        backgroundColor: color,
        borderRadius: shape === 0 ? '50%' : shape === 1 ? '2px' : '1px',
      }}
      initial={{ y: 0, x: 0, rotate: 0, opacity: 1 }}
      animate={{
        y: ['0vh', '110vh'],
        x: [0, (endX - startX) * 3],
        rotate: [0, 360 + Math.random() * 720],
        opacity: [1, 1, 0.8, 0],
      }}
      transition={{
        duration: 2.5 + Math.random() * 1.5,
        delay: Math.random() * 0.8,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
    />
  );
};

const CelebrationOverlay = ({ show, type, title, subtitle, onComplete }: CelebrationOverlayProps) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (show) {
      setVisible(true);
      const timer = setTimeout(() => {
        setVisible(false);
        onComplete?.();
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [show, onComplete]);

  const defaultTitle = type === 'level_up' ? '🚀 ¡Subiste de Nivel!' : '🏆 ¡Meta Cumplida!';
  const defaultSubtitle = type === 'level_up' ? '¡Sigue escalando!' : '¡Felicitaciones, lo lograste!';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Backdrop glow */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: type === 'level_up'
                ? 'radial-gradient(ellipse at center, hsl(var(--primary) / 0.15) 0%, transparent 70%)'
                : 'radial-gradient(ellipse at center, hsl(var(--accent) / 0.15) 0%, transparent 70%)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 1, 0] }}
            transition={{ duration: 4, times: [0, 0.1, 0.7, 1] }}
          />

          {/* Confetti */}
          {Array.from({ length: 40 }).map((_, i) => (
            <ConfettiPiece key={i} index={i} />
          ))}

          {/* Center card */}
          <motion.div
            className="relative bg-card border-2 border-primary/30 rounded-3xl px-10 py-8 shadow-2xl text-center max-w-sm pointer-events-auto"
            initial={{ scale: 0, rotate: -10, opacity: 0 }}
            animate={{ scale: [0, 1.1, 1], rotate: [-10, 3, 0], opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0, y: 30 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
          >
            {/* Emoji burst */}
            <motion.div
              className="text-6xl mb-3"
              animate={{
                scale: [1, 1.3, 1, 1.15, 1],
                rotate: [0, -8, 8, -4, 0],
              }}
              transition={{ duration: 1.2, delay: 0.5 }}
            >
              {type === 'level_up' ? '💎' : '🏆'}
            </motion.div>

            <motion.h2
              className="text-2xl font-black font-heading text-foreground mb-2"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              {title || defaultTitle}
            </motion.h2>

            <motion.p
              className="text-sm text-muted-foreground"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
            >
              {subtitle || defaultSubtitle}
            </motion.p>

            {/* Shine effect */}
            <motion.div
              className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12"
                initial={{ x: '-150%' }}
                animate={{ x: '250%' }}
                transition={{ duration: 1.5, delay: 0.8, ease: 'easeInOut' }}
              />
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default CelebrationOverlay;
