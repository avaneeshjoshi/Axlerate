import Navigation from "./components/navigation";
import HeroSection from "./components/hero";

export default function Home() {
  return (
    <main className="bg-[#050505] min-h-screen overflow-x-hidden">
      <Navigation />
      <HeroSection />
    </main>
    );
  }