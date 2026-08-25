"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  onClose: () => void;
};

export default function Modal({ open, title, children, actions, onClose }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button type="button" className="absolute inset-0 bg-black/65" aria-label="Cerrar" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="relative z-10 max-h-[min(90dvh,calc(100dvh-env(safe-area-inset-bottom)))] w-full max-w-lg overflow-hidden rounded-t-sm bg-card shadow-2xl sm:rounded-sm"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h3 id="modal-title" className="font-display text-lg font-semibold tracking-tight text-fg">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-fg-faint hover:bg-muted-strong hover:text-fg-muted"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {actions ? (
          <div className="flex flex-col gap-2 border-t border-line px-5 py-4 sm:flex-row sm:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
