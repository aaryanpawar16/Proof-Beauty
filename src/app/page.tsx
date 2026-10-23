import { Cheat } from "@/components/landing/Cheat";
import { CtaFooter } from "@/components/landing/CtaFooter";
import { Hero } from "@/components/landing/Hero";
import { Honesty } from "@/components/landing/Honesty";
import { Loop } from "@/components/landing/Loop";
import { Navbar } from "@/components/landing/Navbar";
import { Privacy } from "@/components/landing/Privacy";
import { Problem } from "@/components/landing/Problem";
import { ScoringPlayground } from "@/components/landing/ScoringPlayground";
import { Stage2 } from "@/components/landing/Stage2";

export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <Problem />
      <Loop />
      <ScoringPlayground />
      <Cheat />
      <Honesty />
      <Stage2 />
      <Privacy />
      <CtaFooter />
    </main>
  );
}
