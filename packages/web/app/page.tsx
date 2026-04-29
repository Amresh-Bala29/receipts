import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { ProvesSection } from "@/components/landing/ProvesSection";
import { SeeSample } from "@/components/landing/SeeSample";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { WhyNowSection } from "@/components/landing/WhyNowSection";

export default function LandingPage() {
  return (
    <main className="bg-white text-refined-950">
      <Hero />
      <ProvesSection />
      <HowItWorks />
      <WhyNowSection />
      <SeeSample />
      <SiteFooter />
    </main>
  );
}
