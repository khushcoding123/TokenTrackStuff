"use client";

import { motion } from "framer-motion";

// Scroll-triggered reveal wrapper (adapted from the 21st.dev "scroll reveal"
// pattern, hand-rolled in plain JS). Fades + rises once when the element
// enters the viewport. Used by every landing section below the fold.
export default function Reveal({ children, delay = 0, y = 28, className }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
