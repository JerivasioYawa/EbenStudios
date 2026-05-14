import { useState } from "react";
import logo from "../../assets/logo.svg";

import {
    ShoppingCart,
    Bell,
    User,
    Settings,
    Menu,
} from "lucide-react";

import SearchBar from "../ui/SearchBar";
import MobileMenu from "./MobileMenu";

export default function Navbar() {
    const [open, setOpen] = useState(false);

    return (
        <>
            <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-black/10">
                <div className="max-w-7xl mx-auto px-6 lg:px-10">
                    <div className="flex items-center justify-between h-24">

                        {/* LEFT */}
                        <div className="flex items-center gap-10">
                            <img
                                src={logo}
                                alt="Eben Studios"
                                className="w-14 h-14 object-contain"
                            />

                            {/* DESKTOP LINKS */}
                            <nav className="hidden md:flex items-center gap-8 font-medium">
                                <a href="#">Home</a>
                                <a href="#">Products</a>
                                <a href="#">Contact</a>
                            </nav>
                        </div>

                        {/* RIGHT */}
                        <div className="flex items-center gap-5">

                            {/* SEARCH (hidden on mobile) */}
                            <div className="hidden lg:block">
                                <SearchBar />
                            </div>

                            {/* ICONS */}
                            <div className="hidden md:flex items-center gap-4 text-neutral-600">
                                <ShoppingCart size={20} />
                                <Bell size={20} />
                                <User size={20} />
                                <Settings size={20} />
                            </div>

                            {/* HAMBURGER (mobile only) */}
                            <Menu
                                className="md:hidden cursor-pointer"
                                onClick={() => setOpen(true)}
                            />
                        </div>
                    </div>
                </div>
            </header>

            {/* MOBILE MENU */}
            <MobileMenu isOpen={open} onClose={() => setOpen(false)} />
        </>
    );
}