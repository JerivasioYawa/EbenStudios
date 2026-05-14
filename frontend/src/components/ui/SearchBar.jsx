import { Search } from "lucide-react";

export default function SearchBar() {
    return (
        <div className="hidden lg:flex items-center bg-[#f7f7f7] border border-cyan-400 rounded-full px-4 py-3 w-[320px]">
            <Search size={18} className="text-neutral-400" />

            <input
                type="text"
                placeholder="Search products..."
                className="bg-transparent outline-none px-3 w-full text-sm placeholder:text-neutral-400"
            />
        </div>
    );
}