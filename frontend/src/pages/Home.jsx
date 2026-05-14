import Navbar from "../components/layout/Navbar";
import HeroSection from "../components/home/HeroSection";

export default function Home() {
    return (
        <main className="min-h-screen bg-[#f5f5f3] text-black">
            <Navbar />
            <HeroSection />
        </main>
    );
}