import { About } from "@/components/landing/About";
import { Crew } from "@/components/landing/Crew";
import { Footer } from "@/components/landing/Footer";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { OreSources } from "@/components/landing/OreSources";
import { Veins } from "@/components/landing/Veins";

export default function Home() {
  return (
    <>
      <Hero />
      <main>
        <About />
        <HowItWorks />
        <Crew />
        <Veins />
        <OreSources />
      </main>
      <Footer />
    </>
  );
}
