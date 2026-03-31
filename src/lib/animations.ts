import { Variants } from 'framer-motion';

// ══════════════════════════════════════════════
// STAGGER & ORCHESTRATION
// ══════════════════════════════════════════════

export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.1,
    },
  },
};

export const staggerFast: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.05,
    },
  },
};

export const stadiumWave: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.15,
    },
  },
};

// ══════════════════════════════════════════════
// FADE & SLIDE VARIANTS
// ══════════════════════════════════════════════

export const fadeUpItem: Variants = {
  hidden: { opacity: 0, y: 24, filter: 'blur(4px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.5, ease: 'easeOut' as const },
  },
};

export const fadeDownItem: Variants = {
  hidden: { opacity: 0, y: -16 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: 'easeOut' },
  },
};

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -24 },
  show: { opacity: 1, x: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 30 },
  show: { opacity: 1, x: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

// ══════════════════════════════════════════════
// SCALE & POP
// ══════════════════════════════════════════════

export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.85 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', stiffness: 260, damping: 20 },
  },
};

export const scaleUp: Variants = {
  hidden: { opacity: 0, scale: 0.9 },
  show: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.4, ease: 'backOut' as const },
  },
};

// ══════════════════════════════════════════════
// PAGE TRANSITIONS
// ══════════════════════════════════════════════

export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 16, filter: 'blur(6px)' },
  show: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.4, ease: 'easeOut' as const },
  },
  exit: {
    opacity: 0,
    y: -10,
    filter: 'blur(4px)',
    transition: { duration: 0.2 },
  },
};

// ══════════════════════════════════════════════
// GAMIFICATION SPECIALS
// ══════════════════════════════════════════════

export const podiumBounce: Variants = {
  hidden: { opacity: 0, y: 50, scale: 0.88 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 180, damping: 14, mass: 0.8 },
  },
};

export const trophyWobble: Variants = {
  hidden: { opacity: 0, rotate: -15, scale: 0.7 },
  show: {
    opacity: 1,
    rotate: [0, -6, 6, -3, 3, 0],
    scale: 1,
    transition: { duration: 0.8, ease: 'easeOut' },
  },
};

export const celebratePulse: Variants = {
  hidden: { opacity: 0, scale: 0.5 },
  show: {
    opacity: 1,
    scale: [1, 1.15, 1],
    transition: { duration: 0.5, ease: 'easeOut' },
  },
};

export const scoreboardSlide: Variants = {
  hidden: { opacity: 0, x: -40, scaleX: 0.85 },
  show: {
    opacity: 1,
    x: 0,
    scaleX: 1,
    transition: { type: 'spring', stiffness: 150, damping: 18 },
  },
};

export const goalExplosion: Variants = {
  hidden: { opacity: 0, scale: 0 },
  show: {
    opacity: [0, 1, 1, 0],
    scale: [0.5, 1.5, 1.2, 1.5],
    transition: { duration: 1.2, ease: 'easeOut' },
  },
};

// ══════════════════════════════════════════════
// GLOW & PULSE EFFECTS
// ══════════════════════════════════════════════

export const glowPulse: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: [0.4, 1, 0.4],
    transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
  },
};

export const shimmerLine: Variants = {
  hidden: { x: '-100%' },
  show: {
    x: '200%',
    transition: { duration: 1.5, repeat: Infinity, repeatDelay: 3, ease: 'easeInOut' },
  },
};

// ══════════════════════════════════════════════
// COUNTER & NUMBER SPRINGS
// ══════════════════════════════════════════════

export const counterSpring = {
  type: 'spring' as const,
  stiffness: 100,
  damping: 20,
};

export const numberReveal: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring', stiffness: 200, damping: 20 },
  },
};

// ══════════════════════════════════════════════
// HOVER & TAP INTERACTIONS
// ══════════════════════════════════════════════

export const cardHover = {
  rest: { scale: 1, y: 0 },
  hover: {
    scale: 1.02,
    y: -4,
    transition: { duration: 0.2, ease: 'easeOut' },
  },
  tap: { scale: 0.98 },
};

export const buttonBounce = {
  hover: {
    y: [0, -3, 0],
    transition: { duration: 0.3, ease: 'easeInOut' },
  },
  tap: { scale: 0.95 },
};

export const ballBounce = {
  hover: {
    y: [0, -4, 0, -2, 0],
    transition: { duration: 0.4, ease: 'easeInOut' },
  },
  tap: { scale: 0.95 },
};

// ══════════════════════════════════════════════
// SCROLL-TRIGGERED REVEAL (useInView)
// ══════════════════════════════════════════════

export const scrollReveal: Variants = {
  hidden: { opacity: 0, y: 40, filter: 'blur(8px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.6, ease: 'easeOut' as const },
  },
};

export const scrollRevealLeft: Variants = {
  hidden: { opacity: 0, x: -50 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: 'easeOut' as const },
  },
};

export const scrollRevealRight: Variants = {
  hidden: { opacity: 0, x: 50 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, ease: 'easeOut' as const },
  },
};

export const scrollRevealScale: Variants = {
  hidden: { opacity: 0, scale: 0.85 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { type: 'spring', stiffness: 200, damping: 20 },
  },
};

// ══════════════════════════════════════════════
// CONFETTI / PARTICLES
// ══════════════════════════════════════════════

export const confettiParticle: Variants = {
  hidden: { opacity: 0, y: -20, x: 0 },
  show: {
    opacity: [1, 1, 0],
    y: [0, 80, 120],
    x: [0, 30, -20],
    rotate: [0, 360, 720],
    transition: { duration: 1.5, ease: 'easeOut' },
  },
};

// ══════════════════════════════════════════════
// PROGRESS BAR FILL
// ══════════════════════════════════════════════

export const progressFill = (target: number) => ({
  hidden: { width: '0%' },
  show: {
    width: `${Math.min(100, target)}%`,
    transition: { duration: 1.2, ease: 'easeOut' as const, delay: 0.3 },
  },
});

// ══════════════════════════════════════════════
// TABLE ROW STAGGER
// ══════════════════════════════════════════════

export const tableRowEnter = (index: number): Variants => ({
  hidden: { opacity: 0, x: -12 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.25, delay: index * 0.03 + 0.2, ease: 'easeOut' },
  },
});

// ══════════════════════════════════════════════
// FLOATING / PARALLAX
// ══════════════════════════════════════════════

export const floatingElement = {
  animate: {
    y: [0, -8, 0],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

export const rotateInPlace = {
  animate: {
    rotate: 360,
    transition: {
      duration: 20,
      repeat: Infinity,
      ease: 'linear',
    },
  },
};
