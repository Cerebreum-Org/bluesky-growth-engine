"use client";
import { motion } from "framer-motion";

export const AnimatedCard = ({
  children,
  className = "",
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.4,
        delay: delay,
        ease: [0.4, 0.0, 0.2, 1],
      }}
      whileHover={{ y: -5, transition: { duration: 0.2 } }}
      className={className}
    >
      {children}
    </motion.div>
  );
};