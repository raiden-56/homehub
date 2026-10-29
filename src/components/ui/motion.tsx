import type { ReactNode } from 'react';
import { motion, useReducedMotion, type Transition } from 'framer-motion';

/** Shared motion tokens: short, restrained, consistent. */
export const motionTokens = {
  fast: { duration: 0.14, ease: [0.2, 0, 0, 1] } satisfies Transition,
  base: { duration: 0.22, ease: [0.2, 0, 0, 1] } satisfies Transition,
  spring: { type: 'spring', stiffness: 420, damping: 36, mass: 0.8 } satisfies Transition,
};

/** Subtle fade + rise used for page entrances. */
export function PageTransition({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={motionTokens.base}
    >
      {children}
    </motion.div>
  );
}

/** Animates list items in/out; wrap rows inside `<AnimatePresence initial={false}>`. */
export function MotionItem({ children, layout = true }: { children: ReactNode; layout?: boolean }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      layout={layout && !reduce ? 'position' : false}
      initial={{ opacity: 0, height: 'auto' }}
      animate={{ opacity: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, x: -8 }}
      transition={motionTokens.fast}
    >
      {children}
    </motion.div>
  );
}
