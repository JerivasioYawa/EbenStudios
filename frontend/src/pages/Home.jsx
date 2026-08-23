import HeroSection from "../components/home/HeroSection";
import Categories from "../components/home/Categories";
import FeaturedProducts from "../components/home/FeaturedProducts";
import Newsletter from "../components/home/Newsletter";

export default function Home() {
    return (
        <>
            <HeroSection />
            <Categories />
            <FeaturedProducts />
            <Newsletter />
        </>
    );
}
