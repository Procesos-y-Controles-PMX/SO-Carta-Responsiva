"use client";

import { Search, Send, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { FILTER_CONTROL_CLASS } from "@/lib/filterStyles";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  disabled?: boolean;
  leftIcon?: LucideIcon;
  autoFocus?: boolean;
};

export default function AnimatedSearchInput({
  value,
  onChange,
  placeholder = "Buscar...",
  className,
  id,
  disabled = false,
  leftIcon: LeftIcon,
  autoFocus = false,
}: Props) {
  const reduceMotion = useReducedMotion();
  const hasQuery = value.length > 0;

  return (
    <div className="relative w-full">
      {LeftIcon ? (
        <LeftIcon
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-faint"
          size={16}
        />
      ) : null}
      <input
        id={id}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        autoFocus={autoFocus}
        className={
          className ??
          `${FILTER_CONTROL_CLASS} ${LeftIcon ? "pl-9" : "pl-3"} pr-10 placeholder:text-fg-faint`
        }
      />
      <div className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2">
        <AnimatePresence mode="popLayout">
          <motion.span
            key={hasQuery ? "send" : "search"}
            animate={reduceMotion ? undefined : { y: 0, opacity: 1 }}
            exit={reduceMotion ? undefined : { y: 10, opacity: 0 }}
            initial={reduceMotion ? undefined : { y: -10, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="inline-flex"
          >
            {hasQuery ? (
              <Send className="h-4 w-4 text-fg-faint" />
            ) : (
              <Search className="h-4 w-4 text-fg-faint" />
            )}
          </motion.span>
        </AnimatePresence>
      </div>
    </div>
  );
}
