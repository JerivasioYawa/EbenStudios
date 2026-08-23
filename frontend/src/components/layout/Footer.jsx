import { Link } from "react-router-dom";
import logo from "../../assets/logo.svg";

function InstagramIcon(props) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20" {...props}>
            <rect x="2" y="2" width="20" height="20" rx="5" />
            <circle cx="12" cy="12" r="4" />
            <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
        </svg>
    );
}

function TwitterIcon(props) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" {...props}>
            <path d="M18.9 2H22l-7.6 8.7L23 22h-6.9l-5.4-6.5L4.5 22H1.3l8.1-9.3L1 2h7.1l4.9 5.9L18.9 2Zm-1.2 18h1.9L7.4 4H5.4l12.3 16Z" />
        </svg>
    );
}

function FacebookIcon(props) {
    return (
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20" {...props}>
            <path d="M13.5 22v-8.4h2.8l.4-3.3h-3.2V8.1c0-.9.3-1.6 1.7-1.6h1.7V3.5C16.4 3.4 15.3 3.3 14 3.3c-2.6 0-4.4 1.6-4.4 4.5v2.5H6.8v3.3h2.8V22h3.9Z" />
        </svg>
    );
}

export default function Footer() {
    return (
        <footer className="bg-black text-neutral-300">
            <div className="max-w-7xl mx-auto px-6 lg:px-10 py-16">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
                    <div>
                        <img
                            src={logo}
                            alt="Eben Studios"
                            className="w-14 h-14 object-contain mb-4"
                        />

                        <p className="text-sm leading-relaxed max-w-xs">
                            Modern streetwear inspired by culture, movement,
                            and self-expression. Based in Woodstock,
                            Cape Town.
                        </p>
                    </div>

                    <div>
                        <h4 className="text-white font-semibold mb-4">Shop</h4>
                        <ul className="space-y-3 text-sm">
                            <li><Link to="/shop" className="hover:text-white transition">Hoodies</Link></li>
                            <li><Link to="/shop" className="hover:text-white transition">T-Shirts</Link></li>
                            <li><Link to="/shop" className="hover:text-white transition">Outerwear</Link></li>
                            <li><Link to="/shop" className="hover:text-white transition">Accessories</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-white font-semibold mb-4">Company</h4>
                        <ul className="space-y-3 text-sm">
                            <li><Link to="/about" className="hover:text-white transition">About</Link></li>
                            <li><Link to="/contact" className="hover:text-white transition">Contact</Link></li>
                            <li><Link to="/orders" className="hover:text-white transition">Orders</Link></li>
                        </ul>
                    </div>

                    <div>
                        <h4 className="text-white font-semibold mb-4">Follow Us</h4>
                        <div className="flex items-center gap-4">
                            <a href="#" className="hover:text-white transition"><InstagramIcon /></a>
                            <a href="#" className="hover:text-white transition"><TwitterIcon /></a>
                            <a href="#" className="hover:text-white transition"><FacebookIcon /></a>
                        </div>
                    </div>
                </div>

                <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-neutral-500">
                    <p>&copy; {new Date().getFullYear()} Eben Studios. All rights reserved.</p>

                    <div className="flex items-center gap-6">
                        <a href="#" className="hover:text-white transition">Privacy Policy</a>
                        <a href="#" className="hover:text-white transition">Terms of Service</a>
                    </div>
                </div>
            </div>
        </footer>
    );
}
