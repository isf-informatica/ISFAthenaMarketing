import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
    TrendingUp,
    Home as HomeIcon,
    Package,
    CreditCard,
    Users,
    BarChart3,
    Receipt,
    Settings,
    HelpCircle,
    ChevronDown,
    ShieldCheck,
    ArrowRight,
    Menu,
    X,
} from "lucide-react";

/* ==========================================================
   SIDEBAR — left nav shown on every dashboard page.
   Reads the logged-in company/user from localStorage (same
   keys Home.jsx / Login.jsx already use) so the bottom user
   row is real data, not a placeholder.
========================================================== */

const NAV_ITEMS = [
    { icon: HomeIcon, label: "Home", path: "/home" },
    { icon: Package, label: "Products", path: "/products" },
    { icon: CreditCard, label: "Subscriptions", path: "/pricing" },
    { icon: Users, label: "Team", path: "/team" },
    { icon: BarChart3, label: "Analytics", path: "/analytics" },
    { icon: Receipt, label: "Billing", path: "/pricing" },
    { icon: Settings, label: "Settings", path: "/settings" },
    { icon: HelpCircle, label: "Support", path: "/support" },
];

const readStoredCompany = () => {
    try {
        const raw = localStorage.getItem("growthos_company");
        return raw ? JSON.parse(raw) : null;
    } catch (err) {
        return null;
    }
};

const initials = (name) =>
    (name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

const SidebarContent = ({ pathname, navigate, onNavigate }) => {
    const company = readStoredCompany();
    const adminName = company?.admin_name || company?.contact_name || "Admin User";
    const adminEmail = company?.email || "admin@company.com";
    const planExpiry = company?.plan_expiry || "24 Dec 2025";

    return (
        <div className="flex h-full flex-col bg-[#0a0a0a]">
            {/* Logo */}
            <div className="flex shrink-0 items-center gap-2.5 px-6 py-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20">
                    <TrendingUp size={18} />
                </span>
                <span className="text-base font-extrabold text-white">
                    GrowthOS <span className="text-orange-500">AI</span>
                </span>
            </div>

            {/* Nav */}
            <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3">
                {NAV_ITEMS.map((item) => {
                    const active = pathname === item.path || pathname.startsWith(`${item.path}/`);
                    return (
                        <button
                            key={item.label}
                            type="button"
                            onClick={() => {
                                navigate(item.path);
                                onNavigate?.();
                            }}
                            className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-semibold transition ${
                                active
                                    ? "bg-orange-600 text-white"
                                    : "text-zinc-400 hover:bg-white/5 hover:text-white"
                            }`}
                        >
                            <item.icon size={17} />
                            {item.label}
                        </button>
                    );
                })}
            </nav>

            {/* Bottom: plan card + user */}
            <div className="shrink-0 space-y-3 px-3 pb-5 pt-3">
                <div className="rounded-2xl border border-orange-500/25 bg-orange-500/[0.05] p-4">
                    <div className="flex items-center gap-2">
                        <ShieldCheck size={15} className="text-orange-400" />
                        <p className="text-sm font-bold text-white">Enterprise Plan</p>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">Valid till {planExpiry}</p>
                    <button
                        type="button"
                        onClick={() => {
                            navigate("/pricing");
                            onNavigate?.();
                        }}
                        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 py-2 text-xs font-semibold text-zinc-200 transition hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-orange-300"
                    >
                        View Plan <ArrowRight size={12} />
                    </button>
                </div>

                <button
                    type="button"
                    onClick={() => {
                        navigate("/settings");
                        onNavigate?.();
                    }}
                    className="flex w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5 text-left transition hover:border-orange-500/30 hover:bg-white/[0.04]"
                >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500/30 to-orange-600/10 text-xs font-bold text-orange-300 ring-1 ring-orange-500/30">
                        {initials(adminName)}
                    </span>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-white">{adminName}</p>
                        <p className="truncate text-[11px] text-zinc-500">{adminEmail}</p>
                    </div>
                    <ChevronDown size={14} className="shrink-0 text-zinc-600" />
                </button>
            </div>
        </div>
    );
};

const DashboardSidebar = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <>
            {/* Desktop sidebar */}
            <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 shrink-0 border-r border-white/[0.07] lg:block">
                <SidebarContent pathname={location.pathname} navigate={navigate} />
            </aside>

            {/* Mobile top bar */}
            <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/[0.07] bg-[#0a0a0a] px-4 py-3 lg:hidden">
                <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20">
                        <TrendingUp size={16} />
                    </span>
                    <span className="text-sm font-extrabold text-white">
                        GrowthOS <span className="text-orange-500">AI</span>
                    </span>
                </div>
                <button
                    type="button"
                    onClick={() => setMobileOpen(true)}
                    aria-label="Open menu"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-zinc-300"
                >
                    <Menu size={18} />
                </button>
            </div>

            {/* Mobile overlay sidebar */}
            {mobileOpen && (
                <div className="fixed inset-0 z-40 lg:hidden">
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
                    <aside className="absolute inset-y-0 left-0 w-72 border-r border-white/[0.07]">
                        <button
                            type="button"
                            onClick={() => setMobileOpen(false)}
                            aria-label="Close menu"
                            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-zinc-300"
                        >
                            <X size={16} />
                        </button>
                        <SidebarContent pathname={location.pathname} navigate={navigate} onNavigate={() => setMobileOpen(false)} />
                    </aside>
                </div>
            )}
        </>
    );
};

export default DashboardSidebar;