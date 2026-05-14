import logo from "../../assets/logo.svg";

import {
    ShoppingCart,
    Bell,
    User,
    Settings,
} from "lucide-react";

import SearchBar from "../ui/SearchBar";

export default function Navbar() {
    return (
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-black/10">
            <div className="max-w-7xl mx-auto px-6 lg:px-10">
                <div className="flex items-center justify-between h-24">
                    {/* LEFT SIDE */}
                    <div className="flex items-center gap-16">
                        {/* LOGO */}
                        <img
                            src={logo}
                            alt="Eben Studios Logo"
                            className="w-16 h-16 object-contain rounded-full border border-black/10"
                        />

                        {/* NAVIGATION */}
                        <nav className="hidden md:flex items-center gap-10">
                            <a
                                href="#"
                                className="font-medium hover:text-neutral-500 transition"
                            >
                                Home
                            </a>

                            <a
                                href="#"
                                className="font-medium hover:text-neutral-500 transition"
                            >
                                Products
                            </a>

                            <a
                                href="#"
                                className="font-medium hover:text-neutral-500 transition"
                            >
                                Contact
                            </a>
                        </nav>
                    </div>

                    {/* RIGHT SIDE */}
                    <div className="flex items-center gap-6">
                        <SearchBar />

                        <div className="flex items-center gap-5 text-neutral-500">
                            <ShoppingCart
                                size={22}
                                className="cursor-pointer hover:text-black transition"
                            />

                            <Bell
                                size={22}
                                className="cursor-pointer hover:text-black transition"
                            />

                            <User
                                size={22}
                                className="cursor-pointer hover:text-black transition"
                            />

                            <Settings
                                size={22}
                                className="cursor-pointer hover:text-black transition"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
}