import { ArrowUpRight } from "lucide-react";

const categories = [
    {
        name: "Hoodies",
        description: "Heavyweight fleece built for the streets",
    },
    {
        name: "T-Shirts",
        description: "Everyday essentials, boxy fit",
    },
    {
        name: "Outerwear",
        description: "Jackets made for Cape Town winters",
    },
    {
        name: "Accessories",
        description: "Caps, bags, and the finer details",
    },
];

export default function Categories() {
    return (
        <section className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
            <div className="flex items-end justify-between mb-10">
                <div>
                    <p className="uppercase tracking-[0.3em] text-sm text-neutral-500 mb-4">
                        Shop By Category
                    </p>

                    <h2 className="text-4xl md:text-5xl font-black uppercase leading-none">
                        Find Your Fit
                    </h2>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {categories.map((category) => (
                    <button
                        key={category.name}
                        className="group text-left bg-white rounded-3xl p-6 border border-black/5 shadow-sm hover:shadow-md transition duration-300"
                    >
                        <div className="flex items-start justify-between mb-8">
                            <span className="text-xs uppercase tracking-[0.2em] text-neutral-400">
                                Collection
                            </span>

                            <ArrowUpRight
                                size={18}
                                className="text-neutral-400 group-hover:text-black group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition"
                            />
                        </div>

                        <h3 className="text-xl font-bold mb-2">
                            {category.name}
                        </h3>

                        <p className="text-sm text-neutral-500 leading-relaxed">
                            {category.description}
                        </p>
                    </button>
                ))}
            </div>
        </section>
    );
}
