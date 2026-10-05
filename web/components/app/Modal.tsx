"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./app.module.css";

/** Centred overlay for OS dialogs. Escape and the backdrop close it unless `locked`. */
export function Modal({ onClose, locked, label, children }: { onClose: () => void; locked?: boolean; label: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("button, a, input")?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !locked && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prev?.focus();
    };
  }, [onClose, locked]);
  return (
    <div className={styles.backdrop} onClick={() => !locked && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={label} className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
