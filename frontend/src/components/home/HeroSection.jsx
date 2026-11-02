import heroImage from "../../assets/hero_img.png";

import { ArrowRight } from "lucide-react";

import Button from "../ui/Button";

export default function HeroSection() {
    return (
        <section className="max-w-7xl mx-auto px-6 lg:px-10 py-10">
            {/* TOP TEXT */}
            <div className="text-center mb-10">
                <p className="uppercase tracking-[0.3em] text-sm text-neutral-500 mb-4">
                    Cape Town Streetwear Culture
                </p>

                <h1 className="text-5xl md:text-7xl font-black uppercase leading-none mb-6">
                    Inspired By
                    <br />
                    The Streets
                </h1>

                <p className="max-w-3xl mx-auto text-lg text-neutral-600 leading-relaxed">
                    Nestled in the heart of Woodstock, Eben Studios delivers
                    modern streetwear inspired by culture, movement,
                    and self-expression.
                </p>
            </div>

            {/* HERO CARD */}
            <div className="relative overflow-hidden rounded-[35px] shadow-2xl">
                {/* IMAGE */}
                <img
                    src={heroImage}
                    alt="Eben Studios Hero"
                    className="w-full h-[750px] object-cover"
                />

                {/* OVERLAY */}
                <div className="absolute inset-0 bg-black/30" />

                {/* CONTENT */}
                <div className="absolute inset-0 flex items-end">
                    <div className="p-8 md:p-14 text-white">
                        <div className="max-w-3xl">
                            <p className="uppercase tracking-[0.3em] text-sm mb-5 text-neutral-200">
                                Eben Studios
                            </p>

                            <h2 className="text-5xl md:text-8xl font-black leading-none mb-6">
                                STREETWEAR
                                <br />
                                REDEFINED
                            </h2>

                            <p className="text-lg md:text-xl text-neutral-200 leading-relaxed mb-8 max-w-2xl">
                                Premium garments designed for creators,
                                visionaries, and individuals inspired by
                                urban culture.
                            </p>

                            {/* BUTTONS */}
                            <div className="flex flex-col sm:flex-row gap-4">
                                <Button variant="primary" to="/shop">
                                    <div className="flex items-center gap-3">
                                        View Products
                                        <ArrowRight size={18} />
                                    </div>
                                </Button>

                                <Button variant="secondary" to="/login">
                                    Login
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* INFO CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10">
                <div className="bg-white rounded-3xl p-6 border border-black/5 shadow-sm">
                    <p className="text-sm text-neutral-500 mb-2">
                        Location
                    </p>

                    <h3 className="font-semibold text-lg">
                        Woodstock, Cape Town
                    </h3>
                </div>

                <div className="bg-white rounded-3xl p-6 border border-black/5 shadow-sm">
                    <p className="text-sm text-neutral-500 mb-2">
                        Founded
                    </p>

                    <h3 className="font-semibold text-lg">
                        2023
                    </h3>
                </div>

                <div className="bg-white rounded-3xl p-6 border border-black/5 shadow-sm">
                    <p className="text-sm text-neutral-500 mb-2">
                        Style
                    </p>

                    <h3 className="font-semibold text-lg">
                        Contemporary Streetwear
                    </h3>
                </div>
            </div>
        </section>
    );
}
