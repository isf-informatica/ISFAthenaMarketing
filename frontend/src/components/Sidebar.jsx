import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    LayoutDashboard,
    Megaphone,
    Contact,
    MessagesSquare,
    TrendingUp,
    ArrowRight,
    Users,
    ChevronDown,
    KanbanSquare,
    Workflow,
    BarChart3,
    MessageCircle,
    Bot,
    LogOut,
    Radar,
} from "lucide-react";

/* ==========================================================
   CONTENT SOURCE
   Sidebar module names are pulled from the PRD "Core Modules"
   list and the 5-screen UI/UX wireframe chapter of the
   GrowthOS AI deck, not invented labels:
   Lead Management, CRM (Customer 360), Marketing Automation,
   Sales Pipeline, Communication Hub, AI Agents, AI Assistant,
   Analytics & BI, Admin & White-label.
========================================================== */

export const navGroups = [

    {
        group: "PRODUCT SCREENS",
        items: [
            { id: "sec-dashboard-preview", label: "Dashboard", icon: LayoutDashboard },
            { id: "sec-ai-command-center", label: "AI Command Center", icon: Bot },
            { id: "sec-campaign-builder", label: "Lead Management", icon: Megaphone },
            { id: "sec-lead-generation", label: "Lead Generation", icon: Radar },
            { id: "sec-campaign-automation", label: "Campaign Automation", icon: Workflow },
            { id: "sec-sales-pipeline", label: "Sales Pipeline", icon: KanbanSquare },
            { id: "sec-customer-360", label: "Customer 360 View", icon: Contact },
            { id: "sec-communication-hub", label: "Communication Hub", icon: MessageCircle },
            { id: "sec-ai-assistant", label: "AI Assistant", icon: MessagesSquare },
            { id: "sec-analytics-bi", label: "Analytics & BI", icon: BarChart3 },
        ],
    },
];

export const allNavItems = navGroups.flatMap((g) => g.items);

const initials = (name) =>
    (name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

// Login.jsx already stores the full company object under this key right
// after a successful login — reading it here is simpler and more
// reliable than a second network round-trip to /auth/me.
const readStoredCompany = () => {
    try {
        const raw = localStorage.getItem("growthos_company");
        return raw ? JSON.parse(raw) : null;
    } catch (err) {
        return null;
    }
};

const NavItem = ({ item, active, onClick }) => {
    const Icon = item.icon;
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-[13px] transition duration-200 group ${
                active
                    ? "bg-orange-500 text-white font-semibold"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`}
        >
            <Icon size={16} className={`shrink-0 ${active ? "text-white" : "text-gray-500 group-hover:text-orange-500"}`} />
            <span className="flex-1 text-left truncate">{item.label}</span>
        </button>
    );
};

// activeItem: id of the currently active section
// goToSection: (id) => void — scrolls to the section and marks it active
// sidebarOpen: boolean — controls collapse/expand animation
const Sidebar = ({ activeItem, goToSection, sidebarOpen }) => {
    const navigate = useNavigate();
    const [account] = useState(() => readStoredCompany());
    const [menuOpen, setMenuOpen] = useState(false);

    const handleLogout = () => {
        localStorage.removeItem("growthos_token");
        localStorage.removeItem("growthos_company");
        navigate("/login");
    };

    return (
        <aside
            className={`shrink-0 border-orange-600/20 flex flex-col h-screen sticky top-0 overflow-hidden transition-all duration-300 ease-in-out ${
                sidebarOpen ? "w-72 border-r" : "w-0 border-r-0"
            }`}
        >
            <div className="w-72 flex flex-col h-full">
                <div className="px-6 py-6 border-b border-orange-600/10">
                    <h1 className="text-2xl font-extrabold text-white leading-none">
                        GrowthOS <span className="text-orange-500">AI</span>
                    </h1>
                    <p className="text-xs text-gray-500 mt-1.5 tracking-wide">
                        Autonomous Revenue Platform
                    </p>
                </div>

                <nav className="flex-1 overflow-y-auto px-4 mt-5 space-y-5 pb-4">
                    {navGroups.map((group) => (
                        <div key={group.group}>
                            <p className="text-[11px] font-bold text-orange-500 tracking-widest px-4 mb-2">
                                {group.group}
                            </p>
                            <div className="space-y-1">
                                {group.items.map((item) => (
                                    <NavItem
                                        key={item.id}
                                        item={item}
                                        active={activeItem === item.id}
                                        onClick={() => goToSection(item.id)}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </nav>

                <div className="p-4 border-t border-orange-600/10 relative">
                    {menuOpen && (
                        <>
                            {/* Click-outside catcher */}
                            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                            <div className="absolute z-20 left-4 right-4 bottom-[4.25rem] bg-[#111111] border border-orange-600/20 rounded-xl shadow-lg overflow-hidden">
                                <button
                                    onClick={handleLogout}
                                    className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-gray-300 hover:bg-white/5 hover:text-red-400 transition"
                                >
                                    <LogOut size={15} />
                                    Logout
                                </button>
                            </div>
                        </>
                    )}

                    <button
                        onClick={() => setMenuOpen((o) => !o)}
                        className="relative z-20 w-full flex items-center gap-3 bg-white/5 hover:bg-white/10 transition rounded-xl px-3 py-2.5"
                    >
                        <div className="h-9 w-9 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-sm shrink-0">
                            {initials(account?.company_name)}
                        </div>
                        <div className="text-left flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white leading-none truncate">
                                {account?.company_name || "Account"}
                            </p>
                            <p className="text-xs text-gray-500 mt-1 truncate">
                                {account?.email || "User"}
                            </p>
                        </div>
                        <ChevronDown
                            size={16}
                            className={`text-gray-500 shrink-0 transition-transform ${menuOpen ? "rotate-180" : ""}`}
                        />
                    </button>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;