import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cx } from "./cx";
import styles from "./BevelButton.module.css";

type Common = {
  variant?: "default" | "large";
  /** Mono 700 by default (design 3.2); "sans" for dialog buttons such as Cancel, Back, Next. */
  face?: "mono" | "sans";
  /** Gold for the one bright call to action on dark screens. */
  tone?: "grey" | "gold";
  className?: string;
  children: ReactNode;
};

type AsLink = { href: string } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className" | "children">;
type AsButton = { href?: undefined } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">;

export type BevelButtonProps = Common & (AsLink | AsButton);

const isInternal = (href: string) => href.startsWith("/") && !href.startsWith("//");

/** Raised OS button. Renders a link when `href` is set (next/link for app routes), a <button> otherwise. */
export function BevelButton({ variant = "default", face = "mono", tone = "grey", className, children, ...rest }: BevelButtonProps) {
  const cls = cx(styles.btn, variant === "large" && styles.large, face === "sans" && styles.sans, tone === "gold" && styles.gold, className);

  if (rest.href !== undefined) {
    const { href, ...anchor } = rest as AsLink;
    return isInternal(href) ? (
      <Link href={href} className={cls} {...anchor}>
        {children}
      </Link>
    ) : (
      <a href={href} className={cls} {...anchor}>
        {children}
      </a>
    );
  }

  const { type = "button", ...button } = rest as AsButton;
  return (
    <button type={type} className={cls} {...button}>
      {children}
    </button>
  );
}
