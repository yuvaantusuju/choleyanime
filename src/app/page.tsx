import { About } from "@/components/About";
import Downloader from "@/components/Downloader";
import { Features } from "@/components/Features";
import { Footer } from "@/components/Footer";
import { Hero } from "@/components/Hero";
import { HowItWorks } from "@/components/HowItWorks";
import { NavBar } from "@/components/NavBar";
import { Ready } from "@/components/Ready";

export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <main className="paper min-h-screen">
      <NavBar />
      <Hero />
      <Downloader />
      <HowItWorks />
      <Features />
      <About />
      <Ready />
      <Footer />
    </main>
  );
}
