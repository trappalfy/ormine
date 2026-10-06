import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Departure Mono (SIL OFL 1.1, assets/fonts/DepartureMono-LICENSE.txt): one pixel face for the whole site.
const departure = localFont({
  src: "../assets/fonts/DepartureMono-Regular.woff2",
  variable: "--font-departure",
  display: "swap",
});

// Link previews point here. Fixed rather than taken from Vercel's production domain, which also lists other domains.
const SITE_URL = "https://www.ormine.fun";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Ormine · Mine the market",
    template: "%s · Ormine",
  },
  description:
    "Ormine is a collection of NFT miners on Robinhood Chain. Every stock has its own vein: send your miner into one and it brings up its share, paid in that stock.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-scroll-behavior="smooth" className={departure.variable}>
      <body>{children}</body>
    </html>
  );
}
