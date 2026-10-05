import Image from "next/image";
import { LAUNCH_VEINS } from "@ormine/shared";
import { BevelButton } from "@/components/os/BevelButton";
import { PaintWindow } from "@/components/os/PaintWindow";
import { PicWindow } from "@/components/os/PicWindow";
import { cx } from "@/components/os/cx";
import { SectionHead } from "./SectionHead";
import styles from "./About.module.css";
import sec from "./Section.module.css";

/** About the mine [1]: what Ormine is, next to a paint window with the mine and two crew pictures. */
export function About() {
  const veins = LAUNCH_VEINS.join(", ");
  return (
    <section id="about" className={sec.sec} aria-labelledby="about-title">
      <div className="wrap">
        <SectionHead id="about-title" title="About the mine" n={1} caption="What Ormine is and how it digs" />
        <div className={styles.about}>
          <div className={styles.text}>
            <p>
              <b>Ormine</b> is a collection of NFT miners on Robinhood Chain.
            </p>
            <p>
              Under the market there&apos;s a mine. Every stock has its own vein: {veins}. Send your miner into the vein you
              believe in, and every day it brings up its share of what that vein releases, paid in that stock.
            </p>
            <p>Better gear digs faster. Start with a Digger and upgrade it all the way to a Rig.</p>
            <p className={styles.cta}>
              <BevelButton href="/mint" variant="large">
                Mint a Digger
              </BevelButton>
            </p>
          </div>
          <div className={styles.stage}>
            <PaintWindow title={`vein_${LAUNCH_VEINS[0].toLowerCase()}.bmp - Mine`} className={styles.paint}>
              <Image
                src="/img/mine-scene.jpg"
                alt={`Pixel mine cut in two levels: miners at work under the ${veins} tags, gold ore in the walls`}
                width={1920}
                height={1080}
                sizes="(max-width: 1100px) 100vw, 45vw"
                className={styles.shot}
              />
            </PaintWindow>
            <PicWindow
              className={cx(styles.digger)}
              label="Pic.1"
              file="digger.png"
              src="/img/tiers/digger.png"
              alt="Tier I Digger: brown hat, mustache, pickaxe"
              sizes="(max-width: 1100px) 50vw, 270px"
            />
            <PicWindow
              className={styles.rig}
              label="Pic.4"
              file="rig.png"
              src="/img/tiers/rig.png"
              alt="Tier IV Rig: grey and yellow robot with glowing eyes"
              sizes="(max-width: 1100px) 50vw, 240px"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
