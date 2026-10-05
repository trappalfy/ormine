"use client";

import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { BevelButton } from "./BevelButton";
import { OsWindow } from "./OsWindow";
import { PixelIcon } from "./PixelIcon";
import { cx } from "./cx";
import type { PixelIconName } from "./pixelMaps";
import styles from "./Wizard.module.css";

export type WizardStep = { icon: PixelIconName; title: string; desc: ReactNode };

export type WizardProps = {
  steps: readonly WizardStep[];
  /** Window name, shown as "{name} · Step n of N". */
  name?: string;
  /** Left picture panel (e.g. a next/image with `fill`). */
  side: ReactNode;
  /** Text alternative for the picture panel. */
  sideLabel: string;
  /** Extra buttons after Back / Next, e.g. "Mint". */
  actions?: ReactNode;
  className?: string;
};

/** Setup wizard: click a step or use Back / Next. Finish returns to the first step. */
export function Wizard({ steps, name = "Setup", side, sideLabel, actions, className }: WizardProps) {
  const [current, setCurrent] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const last = steps.length - 1;
  const step = steps[current];

  const go = (i: number) => setCurrent(Math.max(0, Math.min(last, i)));

  const onStepKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const target =
      e.key === "ArrowDown" || e.key === "ArrowRight"
        ? Math.min(last, i + 1)
        : e.key === "ArrowUp" || e.key === "ArrowLeft"
          ? Math.max(0, i - 1)
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : null;
    if (target === null) return;
    e.preventDefault();
    go(target);
    buttons.current[target]?.focus();
  };

  return (
    <OsWindow
      className={cx(styles.wizard, className)}
      title={
        <>
          {name} · <span className={styles.nowrap}>{`Step ${current + 1} of ${steps.length}`}</span>
        </>
      }
    >
      <div className={styles.wbody}>
        <div className={styles.side} role="img" aria-label={sideLabel}>
          {side}
        </div>
        <div className={styles.main}>
          <h3 className={styles.head}>{step.title}</h3>
          <p className={styles.desc} aria-live="polite">
            {step.desc}
          </p>
          <ol className={styles.steps} aria-label={`${name} steps`}>
            {steps.map((s, i) => (
              <li key={s.title}>
                <button
                  ref={(el) => {
                    buttons.current[i] = el;
                  }}
                  type="button"
                  className={styles.step}
                  aria-current={i === current ? "step" : undefined}
                  onClick={() => go(i)}
                  onKeyDown={(e) => onStepKey(e, i)}
                >
                  <PixelIcon name={s.icon} size={32} />
                  <span>
                    {i + 1}. {s.title}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      </div>
      <div className={styles.foot}>
        <BevelButton face="sans" onClick={() => go(current - 1)} disabled={current === 0}>
          &lt; Back
        </BevelButton>
        <BevelButton face="sans" onClick={() => go(current === last ? 0 : current + 1)}>
          {current === last ? "Finish" : "Next >"}
        </BevelButton>
        {actions}
      </div>
    </OsWindow>
  );
}
