import { X } from "lucide-react";

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
                    <a href="#" onClick={onClose}>Home</a>
                    <a href="#" onClick={onClose}>Products</a>
                    <a href="#" onClick={onClose}>Contact</a>
                </div>
            </div>
        </div>
    );
}