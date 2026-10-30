import { Footer } from "@/components/Footer";
import { Nav } from "@/components/Nav";
import { Reveal } from "@/components/Reveal";
import { BoundaryTester } from "@/components/landing/BoundaryTester";
import { Explainer } from "@/components/landing/Explainer";
import { Guardrails } from "@/components/landing/Guardrails";
import { Hero } from "@/components/landing/Hero";
import { Intro } from "@/components/landing/Intro";
import { Letter } from "@/components/landing/Letter";
import { Showcase } from "@/components/landing/Showcase";
import { Stages } from "@/components/landing/Stages";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Intro />
        <Stages />
        <Showcase />
        <Explainer />
        <Guardrails />
        <BoundaryTester />
        <Letter />
      </main>
      <Footer credits={["rbiFront", "ledger", "rbiTower", "pondy"]} />
      <Reveal />
    </>
  );
}
