'use client';
import React from 'react';
import { motion } from 'framer-motion';

export function NestedSquares({ children, className = "" }) {
  const squares = Array.from({ length: 16 }, (_, i) => i);

  return (
    <div className={`relative w-[450px] h-[450px] flex items-center justify-center bg-transparent overflow-visible ${className}`}>
      {squares.map((index) => {
        const padding = (index + 1) * 12;
        const delay = index * 0.08;
        
        return (
          <motion.div
            key={index}
            className="absolute border border-transparent pointer-events-none"
            style={{
              padding: `${padding}px`,
              borderImage: `linear-gradient(45deg, 
                rgba(147, 51, 234, 0.25), 
                rgba(168, 85, 247, 0.45), 
                rgba(196, 181, 253, 0.35), 
                rgba(139, 92, 246, 0.45), 
                rgba(124, 58, 237, 0.25)
              ) 1`,
            }}
            initial={{
              scale: 0.1,
              rotate: 0,
              opacity: 0
            }}
            animate={{
              scale: 1.8,
              rotate: 180,
              opacity: [0, 0.8, 0.8, 0]
            }}
            transition={{
              duration: 3,
              delay: delay,
              ease: "easeInOut",
              repeat: Infinity,
              repeatType: "loop",
            }}
          />
        );
      })}
      
      {/* Centered element */}
      <div className="z-10 relative">
        {children}
      </div>
    </div>
  );
}

export function Component() {
  return (
    <div className="min-h-screen bg-[#020306] flex items-center justify-center p-8 overflow-hidden">
      <NestedSquares />
    </div>
  );
}
