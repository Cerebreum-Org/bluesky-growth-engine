"use client";
import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export const BackgroundBeams = ({ className }: { className?: string }) => {
  const paths = [
    "M-380 -189C-380 -189 -312 216 152 343C616 470 684 875 684 875",
    "M-373 -197C-373 -197 -305 208 159 335C623 462 691 867 691 867",
  ];

  return (
    <div className={cn("absolute inset-0 overflow-hidden pointer-events-none", className)}>
      <svg
        className="absolute w-full h-full opacity-20"
        viewBox="0 0 696 316"
        fill="none"
      >
        {paths.map((path, index) => (
          <motion.path
            key={`path-${index}`}
            d={path}
            stroke={`url(#gradient-${index})`}
            strokeWidth="0.5"
          />
        ))}
        <defs>
          {paths.map((_, index) => (
            <linearGradient key={`gradient-${index}`} id={`gradient-${index}`}>
              <stop stopColor="#3b82f6" stopOpacity="0"></stop>
              <stop offset="50%" stopColor="#3b82f6"></stop>
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0"></stop>
            </linearGradient>
          ))}
        </defs>
      </svg>
    </div>
  );
};