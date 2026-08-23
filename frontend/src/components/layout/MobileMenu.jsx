import { X } from "lucide-react";
import { Link } from "react-router-dom";

export default function MobileMenu({ isOpen, onClose }) {
    return (
        <div
            className={`fixed inset-0 z-50 transition ${
                isOpen ? "visible opacity-100" : "invisible opacity-0"
            }`}
        >
            {/* Overlay */}
            <div
                onClick={onClose}
                className="absolute inset-0 bg-black/40"
            />

            {/* Menu Panel */}
            <div
                className={`absolute right-0 top-0 h-full w-[80%] bg-white shadow-xl transform transition duration-300 ${
                    isOpen ? "translate-x-0" : "translate-x-full"
                }`}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <h2 className="font-bold text-lg">Menu</h2>

                    <X
                        className="cursor-pointer"
                        onClick={onClose}
                    />
                </div>

                {/* Links */}
                <div className="flex flex-col gap-6 p-6 text-lg font-medium">
                    <Link to="/" onClick={onClose}>Home</Link>
                    <Link to="/shop" onClick={onClose}>Products</Link>
                    <Link to="/contact" onClick={onClose}>Contact</Link>
                </div>
            </div>
        </div>
    );
}