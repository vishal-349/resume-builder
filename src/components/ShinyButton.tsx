/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';

interface ShinyButtonProps {
  onClick?: () => void;
  label: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

/**
 * Signature primary CTA for the Midnight Glass theme.
 * Violet→indigo→cyan gradient with an animated diagonal sheen sweep,
 * a soft glowing aura, hover-lift and press-scale micro-interactions.
 */
export default function ShinyButton({ onClick, label, icon, className = '' }: ShinyButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -1.5 }}
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
      className={`group relative inline-flex items-center gap-2 overflow-hidden rounded-xl px-3.5 sm:px-5 py-2.5 text-sm font-bold text-white cursor-pointer ${className}`}
      style={{
        background: 'linear-gradient(100deg, #3b82f6 0%, #6366f1 48%, #8b5cf6 105%)',
        boxShadow:
          '0 0 0 1px rgba(255,255,255,0.25) inset, 0 8px 26px -6px rgba(59,130,246,0.6)',
      }}
    >
      {/* Soft glowing aura behind the button */}
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-1 rounded-2xl opacity-60 blur-md transition-opacity duration-300 group-hover:opacity-90"
        style={{ background: 'linear-gradient(100deg, #3b82f6, #6366f1, #8b5cf6)' }}
      />

      {/* Animated diagonal sheen sweep */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(110deg, transparent 25%, rgba(255,255,255,0.55) 50%, transparent 75%)',
          width: '60%',
        }}
        initial={{ x: '-160%' }}
        animate={{ x: '320%' }}
        transition={{ duration: 2.6, repeat: Infinity, repeatDelay: 1.4, ease: 'easeInOut' }}
      />

      {/* Content */}
      <span className="relative z-10 flex items-center gap-2">
        {icon ?? <Sparkles size={15} className="text-yellow-200 drop-shadow" />}
        <span className="relative z-10 tracking-tight">{label}</span>
      </span>
    </motion.button>
  );
}
