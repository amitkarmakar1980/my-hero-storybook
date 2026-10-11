import { auth } from "@/lib/auth";
import HeroSection from "@/components/HeroSection";
import ThemesSection from "@/components/ThemesSection";

export default async function Home() {
  const session = await auth();

  return (
    <main>
      <HeroSection />
      {/* Soft gradient bridge between hero and themes */}
      <div
        aria-hidden="true"
        style={{ background: "linear-gradient(to bottom, #FCF7EE, #FBF1E3)", height: "40px" }}
      />
      <ThemesSection isSignedIn={!!session?.user} />
    </main>
  );
}
