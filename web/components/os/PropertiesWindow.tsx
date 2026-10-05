"use client";

import { useId, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react";
import { OsWindow, type WindowControl } from "./OsWindow";
import { cx } from "./cx";
import styles from "./PropertiesWindow.module.css";

export type PropertiesTab = { id: string; label: string; content: ReactNode };

export type PropertiesWindowProps = {
  title: ReactNode;
  tabs: readonly PropertiesTab[];
  controls?: readonly WindowControl[];
  className?: string;
  style?: CSSProperties;
};

/** Window with tabs over a sunken panel. Tabs follow the ARIA tabs pattern (arrows, Home, End). */
export function PropertiesWindow({ title, tabs, controls = ["help", "close"], className, style }: PropertiesWindowProps) {
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const uid = useId();

  const onKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const last = tabs.length - 1;
    const next =
      e.key === "ArrowRight" ? (i === last ? 0 : i + 1)
      : e.key === "ArrowLeft" ? (i === 0 ? last : i - 1)
      : e.key === "Home" ? 0
      : e.key === "End" ? last
      : null;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
    refs.current[next]?.focus();
  };

  return (
    <OsWindow title={title} controls={controls} className={className} style={style}>
      <div className={styles.tabs} role="tablist">
        {tabs.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`${uid}-tab-${t.id}`}
            aria-selected={i === active}
            aria-controls={`${uid}-panel-${t.id}`}
            tabIndex={i === active ? 0 : -1}
            className={styles.tab}
            onClick={() => setActive(i)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className={styles.pbody}>
        {tabs.map((t, i) => (
          <div
            key={t.id}
            role="tabpanel"
            id={`${uid}-panel-${t.id}`}
            aria-labelledby={`${uid}-tab-${t.id}`}
            tabIndex={i === active ? 0 : -1}
            className={cx(styles.panel, i !== active && styles.inactive)}
          >
            {t.content}
          </div>
        ))}
      </div>
    </OsWindow>
  );
}
