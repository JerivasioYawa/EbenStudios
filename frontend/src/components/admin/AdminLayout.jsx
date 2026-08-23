import { NavLink, Outlet, Link } from "react-router-dom";
import { LayoutDashboard, Package, ClipboardList, LogOut, Store } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";

const links = [
    { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
    { to: "/admin/products", label: "Products", icon: Package },
    { to: "/admin/orders", label: "Orders", icon: ClipboardList },
];

function linkClass({ isActive }) {
    return `flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition ${
        isActive
            ? "bg-white text-black"
            : "text-neutral-400 hover:bg-white/10 hover:text-white"
    }`;
}

export default function AdminLayout() {
    const { user, logout } = useAuth();

    return (
        <div className="min-h-screen flex bg-[#f5f5f3] text-black">
            {/* SIDEBAR */}
            <aside className="w-64 shrink-0 bg-black text-white flex flex-col p-6">
                <Link to="/admin" className="text-xl font-black uppercase tracking-tight mb-10">
                    Eben Admin
                </Link>

                <nav className="flex-1 flex flex-col gap-2">
                    {links.map(({ to, label, icon: Icon, end }) => (
                        <NavLink key={to} to={to} end={end} className={linkClass}>
                            <Icon size={18} />
                            {label}
                        </NavLink>
                    ))}
                </nav>

                <div className="border-t border-white/10 pt-4 flex flex-col gap-2">
                    <Link
                        to="/"
                        className="flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-neutral-400 hover:bg-white/10 hover:text-white transition"
                    >
                        <Store size={18} />
                        View Store
                    </Link>

                    <button
                        onClick={logout}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-neutral-400 hover:bg-white/10 hover:text-white transition text-left"
                    >
                        <LogOut size={18} />
                        Log Out
                    </button>
                </div>
            </aside>

            {/* MAIN */}
            <div className="flex-1 flex flex-col">
                <header className="h-20 flex items-center justify-end px-8 border-b border-black/10 bg-white">
                    <p className="text-sm text-neutral-500">
                        Signed in as <span className="font-semibold text-black">{user?.email}</span>
                    </p>
                </header>

                <main className="flex-1 p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
