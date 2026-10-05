import type { TIERS } from "@ormine/shared";
import { PicWindow } from "./PicWindow";
import { cx } from "./cx";
import styles from "./TierCard.module.css";

export type TierInfo = (typeof TIERS)[number];

export type TierCardProps = {
  tier: TierInfo;
  /** Heading level for the tier name. */
  as?: "h3" | "h4";
  sizes?: string;
  className?: string;
};

/** A tier: sprite in a picture window, name, pixel "TIER n" label, n of 4 bars lit, one-line description. */
export function TierCard({ tier, as: Heading = "h3", sizes, className }: TierCardProps) {
  return (
    <div className={className}>
      <PicWindow
        label={`Tier ${tier.roman}`}
        file={`${tier.slug}.png`}
        src={`/img/tiers/${tier.slug}.png`}
        alt={`Tier ${tier.roman} ${tier.name}`}
        sizes={sizes}
      />
      <div className={styles.meta}>
        <Heading className={styles.name}>
          {tier.name}
          <small className={styles.tier}>TIER {tier.tier}</small>
        </Heading>
        <div className={styles.bars} role="img" aria-label={`Gear level ${tier.tier} of 4`}>
          {[1, 2, 3, 4].map((n) => (
            <i key={n} className={cx(n <= tier.tier && styles.on)} />
          ))}
        </div>
        <p className={styles.desc}>{tier.desc}</p>
      </div>
    </div>
  );
}
