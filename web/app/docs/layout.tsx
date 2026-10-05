import type { ReactNode } from "react";
import { TopLine } from "@/components/landing/TopLine";
import styles from "./docs.module.css";

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <header className={styles.head}>
        <div className="wrap">
          <TopLine />
        </div>
      </header>
      <main className={styles.page}>
        <div className="wrap">{children}</div>
      </main>
    </>
  );
}
