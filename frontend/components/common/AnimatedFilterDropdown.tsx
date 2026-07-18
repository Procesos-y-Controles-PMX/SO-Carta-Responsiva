"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { FILTER_DROPDOWN_VARIANTS } from "@/lib/filterAnimations";

const PANEL_CLASS =
  "absolute z-50 mt-1 w-full overflow-hidden rounded-sm border border-slate-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.05),0_8px_24px_-8px_rgba(16,24,40,0.18)]";

export function AnimatedFilterDropdown({
  open,
  children,
  className = "",
  maxHeightClass = "max-h-60",
}: {
  open: boolean;
  children: React.ReactNode;
  className?: string;
  maxHeightClass?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          animate={reduceMotion ? undefined : "show"}
          className={`${PANEL_CLASS} ${maxHeightClass} overflow-y-auto ${className}`}
          exit={reduceMotion ? undefined : "exit"}
          initial={reduceMotion ? undefined : "hidden"}
          variants={FILTER_DROPDOWN_VARIANTS.container}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function AnimatedFilterDropdownItem({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      layout={!reduceMotion}
      variants={FILTER_DROPDOWN_VARIANTS.item}
    >
      {children}
    </motion.div>
  );
}
