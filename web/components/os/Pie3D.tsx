import { cx } from "./cx";
import styles from "./Pie3D.module.css";

export type PieSlice = {
  /** Share in percent; slices are laid out counter-clockwise from 12 o'clock. */
  value: number;
  /** Top colour. */
  color: string;
  /** Side-wall colour (darker). */
  side: string;
};

// Geometry from the mockup: ellipse 160×62, 26px side wall, viewBox 400×210.
const CX = 200;
const CY = 92;
const RX = 160;
const RY = 62;
const DEPTH = 26;

const rad = (deg: number) => (deg * Math.PI) / 180;
const fx = (n: number) => Math.round(n * 100) / 100;
/** Point on the top ellipse, `deg` counter-clockwise from the top. */
const pt = (deg: number, dy = 0) => `${fx(CX - RX * Math.sin(rad(deg)))} ${fx(CY - RY * Math.cos(rad(deg)) + dy)}`;

function wedge(a: number, b: number) {
  const large = b - a > 180 ? 1 : 0;
  return `M${CX} ${CY} L${pt(a)} A${RX} ${RY} 0 ${large} 0 ${pt(b)} Z`;
}

/** Side wall between angles a..b, which must lie on the front half (90°..270°). */
function wall(a: number, b: number) {
  return `M${pt(a)} L${pt(a, DEPTH)} A${RX} ${RY} 0 0 0 ${pt(b, DEPTH)} L${pt(b)} A${RX} ${RY} 0 0 1 ${pt(a)} Z`;
}

/** Volumetric pie chart in the OS-chart style. Pass the text alternative in `label`. */
export function Pie3D({ slices, label, className }: { slices: readonly PieSlice[]; label: string; className?: string }) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  const parts = slices.map((s, i) => {
    const before = slices.slice(0, i).reduce((sum, x) => sum + x.value, 0);
    return { ...s, a: (before / total) * 360, b: ((before + s.value) / total) * 360 };
  });

  return (
    <svg viewBox="0 0 400 210" role="img" aria-label={label} className={cx(styles.pie, className)}>
      {parts.map((p, i) => {
        const a = Math.max(p.a, 90);
        const b = Math.min(p.b, 270);
        return b > a ? <path key={`w${i}`} d={wall(a, b)} fill={p.side} /> : null;
      })}
      {parts.map((p, i) =>
        p.b - p.a >= 360 ? (
          <ellipse key={`t${i}`} cx={CX} cy={CY} rx={RX} ry={RY} fill={p.color} />
        ) : p.b > p.a ? (
          <path key={`t${i}`} d={wedge(p.a, p.b)} fill={p.color} />
        ) : null,
      )}
      <ellipse cx={CX} cy={CY} rx={RX} ry={RY} fill="none" stroke="#0a0a0a" strokeWidth="2" />
    </svg>
  );
}

export type LegendItem = { color: string; label: string; value: string };

/** "colour · label · value" rows under a chart. */
export function PieLegend({ items, className }: { items: readonly LegendItem[]; className?: string }) {
  return (
    <div className={cx(styles.legend, className)}>
      {items.map((it) => (
        <div key={it.label} className={styles.row}>
          <i className={styles.chip} style={{ background: it.color }} aria-hidden="true" />
          <span>{it.label}</span>
          <b className={styles.value}>{it.value}</b>
        </div>
      ))}
    </div>
  );
}
