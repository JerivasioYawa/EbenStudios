import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import logo from "../../assets/logo.svg";

import {
    ShoppingCart,

    User,

    Menu,
} from "lucide-react";

import SearchBar from "../ui/SearchBar";
import MobileMenu from "./MobileMenu";
import { useCart } from "../../hooks/useCart";

function navLinkClass({ isActive }) {
    return isActive ? "text-black" : "text-neutral-600 hover:text-black transition";
}

export default function Navbar() {
    const [open, setOpen] = useState(false);
    const { itemCount } = useCart();

    return (
        <>
            <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-black/10">
                <div className="max-w-7xl mx-auto px-6 lg:px-10">
                    <div className="flex items-center justify-between h-24">

                        {/* LEFT */}
                        <div className="flex items-center gap-10">
                            <Link to="/">
                                <img
                                    src={logo}
                                    alt="Eben Studios"
                                    className="w-14 h-14 object-contain"
                                />
                            </Link>

                            {/* DESKTOP LINKS */}
                            <nav className="hidden md:flex items-center gap-8 font-medium">
                                <NavLink to="/" end className={navLinkClass}>Home</NavLink>
                                <NavLink to="/shop" className={navLinkClass}>Products</NavLink>
                                <NavLink to="/contact" className={navLinkClass}>Contact</NavLink>
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
                                <Link to="/cart" aria-label="Cart" className="relative">
                                    <ShoppingCart size={20} />
                                    {itemCount > 0 && (
                                        <span className="absolute -top-2 -right-2 bg-black text-white text-[10px] font-semibold w-4 h-4 rounded-full flex items-center justify-center">
                                            {itemCount}
                                        </span>
                                    )}
                                </Link>

                                <Link to="/profile" aria-label="Profile"><User size={20} /></Link>

                            </div>

                            {/* HAMBURGER (mobile only) */}
                            <button className="md:hidden" aria-label="Open navigation" aria-expanded={open} onClick={() => setOpen(true)}><Menu /></button>
                        </div>
                    </div>
                </div>
            </header>

            {/* MOBILE MENU */}
            <MobileMenu isOpen={open} onClose={() => setOpen(false)} />
        </>
    );
}
