import { Variants } from 'framer-motion';

// Stagger container for child animations
export const staggerContainer: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

// Fade up for cards and sections
export const fadeUpItem: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

// Scale pop for KPI values, badges, medals
export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.8 },
  show: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 20 } },
};

// Slide from left (sidebar items)
export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -20 },
  show: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

// Slide from right
export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 30 },
  show: { opacity: 1, x: 0, transition: { duration: 0.4, ease: 'easeOut' } },
};

// Page transition
export const pageTransition: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

// Podium bounce for ranking top 3
export const podiumBounce: Variants = {
  hidden: { opacity: 0, y: 40, scale: 0.9 },
  show: { 
    opacity: 1, y: 0, scale: 1, 
    transition: { type: 'spring', stiffness: 200, damping: 15 } 
  },
};

// Celebratory pulse for completed items
export const celebratePulse: Variants = {
  hidden: { opacity: 0, scale: 0.5 },
  show: { 
    opacity: 1, scale: [1, 1.15, 1], 
    transition: { duration: 0.5, ease: 'easeOut' } 
  },
};

// Counter animation helper
export const counterSpring = {
  type: 'spring' as const,
  stiffness: 100,
  damping: 20,
};

// Hover interactions
export const cardHover = {
  rest: { scale: 1, boxShadow: '0 0 0 rgba(0,0,0,0)' },
  hover: { 
    scale: 1.02, 
    boxShadow: '0 8px 30px -10px rgba(0, 170, 255, 0.15)',
    transition: { duration: 0.2 } 
  },
  tap: { scale: 0.98 },
};

export const glowPulse: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: [0.4, 1, 0.4],
    transition: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
  },
};
