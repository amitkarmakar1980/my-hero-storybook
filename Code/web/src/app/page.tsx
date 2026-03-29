import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import ThemesSection from "@/components/ThemesSection";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <HeroSection />
        {/* Soft gradient bridge between hero and themes */}
        <div
          aria-hidden="true"
          style={{ background: "linear-gradient(to bottom, #FCF7EE, #FBF1E3)", height: "40px" }}
        />
        <ThemesSection />
      </main>
    </>
  );
}
