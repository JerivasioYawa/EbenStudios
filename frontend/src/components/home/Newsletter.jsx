import { useState } from "react";
import { ArrowRight } from "lucide-react";

export default function Newsletter() {
    const [email, setEmail] = useState("");
    const [submitted, setSubmitted] = useState(false);

    function handleSubmit(e) {
        e.preventDefault();
        if (!email) return;
        setSubmitted(true);
        setEmail("");
    }

    return (
        <section className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
            <div className="bg-black text-white rounded-[35px] px-8 py-16 md:px-16 text-center">
                <p className="uppercase tracking-[0.3em] text-sm text-neutral-400 mb-4">
                    Stay Connected
                </p>

                <h2 className="text-4xl md:text-6xl font-black uppercase leading-none mb-6">
                    Join The Movement
                </h2>

                <p className="max-w-xl mx-auto text-neutral-300 mb-10">
                    Be first to know about new drops, restocks, and
                    exclusive Eben Studios events in Cape Town.
                </p>

                {submitted ? (
                    <p className="font-semibold">
                        You&apos;re on the list. Welcome to Eben Studios.
                    </p>
                ) : (
                    <form
                        onSubmit={handleSubmit}
                        className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto"
                    >
                        <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Enter your email"
                            className="flex-1 rounded-full px-6 py-4 text-black placeholder:text-neutral-400 focus:outline-none"
                        />

                        <button
                            type="submit"
                            className="bg-white text-black px-8 py-4 rounded-full font-semibold hover:bg-neutral-200 transition duration-300 flex items-center justify-center gap-2"
                        >
                            Subscribe
                            <ArrowRight size={18} />
                        </button>
                    </form>
                )}
            </div>
        </section>
    );
}
