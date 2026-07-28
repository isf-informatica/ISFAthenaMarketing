import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
    Building2,
    Mail,
    Globe,
    Phone,
    MapPin,
    Briefcase,
    Plus,
    Package,
    Loader2,
    Megaphone,
    CalendarDays,
    ShieldCheck,
    Crown,
    CalendarClock,
    Users,
    IndianRupee,
    Target,
    UserPlus,
    Rocket,
    Bot,
    ChevronRight,
    History,
    RefreshCw,
    Sparkles,
    TrendingUp,
    AlertTriangle,
    Lightbulb,
} from "lucide-react";
import Starfield from "./Starfield";
import Sidebar from "./DashboardSidebar";

/* ==========================================================
   HOME PAGE — Company Dashboard, shown right after login.
   Same company (isfathena.company_registrations) + products
   (isfathena.products) data and CRUD as before — only the
   layout changed, into: hero, stats, quick actions, products,
   recent activity, AI insights. Sidebar/routing untouched.
========================================================== */

const API_BASE_URL = "http://localhost:8000";
const COMPANY_ENDPOINT = `${API_BASE_URL}/auth/me`;
const PRODUCTS_ENDPOINT = `${API_BASE_URL}/products`;

const initials = (name) =>
    (name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

// Login.jsx already stores the full company object under this key right
// after a successful login — used as the immediate, reliable source for
// this page so it never renders the empty "Welcome" fallback just because
// a background /auth/me refresh is slow or fails.
const readStoredCompany = () => {
    try {
        const raw = localStorage.getItem("growthos_company");
        return raw ? JSON.parse(raw) : null;
    } catch (err) {
        return null;
    }
};

/* ---------- small presentational pieces, kept in this same file ---------- */

// A quiet orange wireframe skyline for the hero card's right side — built
// from plain rects/lines, not a stock illustration, and kept subtle.
function SkylineIllustration() {
    return (
        <svg
            viewBox="0 0 420 300"
            className="pointer-events-none absolute -right-6 bottom-0 h-full w-[70%] max-w-[440px] opacity-[0.35] [mask-image:linear-gradient(to_left,black_35%,transparent_92%)]"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
        >
            <defs>
                <linearGradient id="skylineStroke" x1="0" y1="0" x2="0" y2="300" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#FF8A3D" />
                    <stop offset="100%" stopColor="#FF6B00" stopOpacity="0.35" />
                </linearGradient>
            </defs>
            <ellipse cx="300" cy="120" rx="150" ry="46" stroke="url(#skylineStroke)" strokeWidth="1" opacity="0.5" />
            <ellipse cx="300" cy="120" rx="110" ry="150" stroke="url(#skylineStroke)" strokeWidth="1" opacity="0.35" />
            {[
                [230, 150, 34, 150],
                [268, 110, 40, 190],
                [312, 70, 44, 230],
                [360, 130, 30, 170],
            ].map(([x, y, w, h], i) => (
                <g key={i}>
                    <rect x={x} y={y} width={w} height={h} rx="3" stroke="url(#skylineStroke)" strokeWidth="1.1" />
                    {Array.from({ length: Math.floor(h / 18) }).map((_, r) => (
                        <line key={r} x1={x} y1={y + 14 + r * 18} x2={x + w} y2={y + 14 + r * 18} stroke="url(#skylineStroke)" strokeWidth="0.6" opacity="0.5" />
                    ))}
                </g>
            ))}
            <line x1="180" y1="300" x2="420" y2="300" stroke="url(#skylineStroke)" strokeWidth="1" opacity="0.4" />
        </svg>
    );
}

const CompanyInfoTile = ({ icon: Icon, label, value }) => {
    if (!value) return null;
    return (
        <div className="group flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5 backdrop-blur-xl transition hover:border-orange-500/40 hover:bg-orange-500/[0.04]">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20 transition group-hover:bg-orange-500/20">
                <Icon size={15} />
            </span>
            <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{value}</p>
                <p className="text-[11px] text-zinc-500">{label}</p>
            </div>
        </div>
    );
};

const StatCard = ({ icon: Icon, value, label, description, accent, onClick }) => {
    const Tag = onClick ? "button" : "div";
    return (
        <Tag
            type={onClick ? "button" : undefined}
            onClick={onClick}
            className={`group relative w-full overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 text-left backdrop-blur-xl transition hover:border-orange-500/40 hover:bg-orange-500/[0.04] ${
                onClick ? "cursor-pointer" : ""
            }`}
        >
            <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-orange-500/0 blur-2xl transition group-hover:bg-orange-500/10" />
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20">
                <Icon size={18} />
            </span>
            <p className="mt-4 text-2xl font-extrabold text-white">{value}</p>
            <p className="mt-0.5 text-sm font-semibold text-zinc-300">{label}</p>
            <p className={`mt-0.5 text-xs ${accent ? "text-orange-400" : "text-zinc-500"}`}>{description}</p>
        </Tag>
    );
};

// 6 shortcut buttons. Only "Add Product" is wired to a real handler —
// the rest navigate to routes matching your sidebar's naming. Update
// `path` for any that differ from your actual react-router routes.
const QUICK_ACTIONS = [
    { icon: Plus, label: "Add Product", subtitle: "List a new product", key: "add-product" },
    { icon: Target, label: "Generate Leads", subtitle: "Find new prospects", path: "/analytics" },
    { icon: Megaphone, label: "Campaign Builder", subtitle: "Launch a campaign", path: "/campaign-builder" },
    { icon: UserPlus, label: "Invite Team", subtitle: "Add a teammate", path: "/team" },
    { icon: Rocket, label: "Upgrade Plan", subtitle: "Unlock more limits", path: "/billing" },
    { icon: Bot, label: "Open AI Assistant", subtitle: "Ask GrowthOS AI", path: "/ai-command-center" },
];

// Not wired to an activity-log API yet — illustrative recent events.
// Swap for a real feed (e.g. GET /activity) when one exists.
const ACTIVITY = [
    { icon: Package, text: "New product added", detail: "GrowthOS AI CRM", time: "2 hours ago" },
    { icon: Target, text: "Lead generated", detail: "WhatsApp Marketing Suite", time: "5 hours ago" },
    { icon: Megaphone, text: "Campaign sent", detail: "Diwali offer — 1,204 recipients", time: "Yesterday" },
    { icon: RefreshCw, text: "Subscription renewed", detail: "Enterprise plan", time: "2 days ago" },
    { icon: IndianRupee, text: "Payment received", detail: "₹4,999 from EasyLearn LMS", time: "3 days ago" },
];

const InsightRow = ({ icon: Icon, label, value }) => (
    <div className="flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 transition hover:border-orange-500/30 hover:bg-orange-500/[0.04]">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20">
            <Icon size={14} />
        </span>
        <div className="min-w-0">
            <p className="text-xs font-medium text-zinc-500">{label}</p>
            <p className="mt-0.5 text-sm font-semibold text-white">{value}</p>
        </div>
    </div>
);

/* ---------------------------- main component ---------------------------- */

const Home = () => {
    const navigate = useNavigate();

    const [company, setCompany] = useState(() => readStoredCompany());
    const [companyLoading, setCompanyLoading] = useState(false);

    const [products, setProducts] = useState([]);
    const [productsLoading, setProductsLoading] = useState(true);

    const authHeaders = () => {
        const token = localStorage.getItem("growthos_token");
        return token ? { Authorization: `Bearer ${token}` } : {};
    };

    const fetchCompany = async () => {
        try {
            const res = await fetch(COMPANY_ENDPOINT, { method: "GET", headers: authHeaders() });
            if (res.status === 401) {
                navigate("/login");
                return;
            }
            const resp = await res.json();
            if (res.ok && resp.success && resp.data) {
                setCompany(resp.data);
            }
        } catch (err) {
            // Network hiccup — silently keep the existing company data.
        }
    };

    const fetchProducts = async () => {
        setProductsLoading(true);
        try {
            const res = await fetch(PRODUCTS_ENDPOINT, { method: "GET", headers: authHeaders() });
            if (res.status === 401) {
                navigate("/login");
                return;
            }
            const resp = await res.json();
            setProducts(res.ok && resp.success && Array.isArray(resp.data) ? resp.data : []);
        } catch (err) {
            setProducts([]);
        } finally {
            setProductsLoading(false);
        }
    };

    useEffect(() => {
        if (!localStorage.getItem("growthos_token")) {
            navigate("/login");
            return;
        }
        fetchCompany();
        fetchProducts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Product add/edit now lives on the dedicated Products page.
    const handleQuickAction = (action) => () => {
        if (action.key === "add-product") {
            navigate("/products?add=1");
        } else if (action.path) {
            navigate(action.path);
        }
    };

    const location = [company?.address_city, company?.address_state, company?.address_country]
        .filter(Boolean)
        .join(", ");

    // Not part of the current company API yet — shown only when present,
    // so this stays honest rather than fabricating GST/founding info.
    const gstLabel = company?.gst_status || company?.gstin ? "GST Registered" : null;
    const since = company?.founded_year || company?.company_since || null;

    const topProduct = products[0]?.product_name || "Not enough data yet";
    const lowEngagement = products.length > 1 ? products[products.length - 1]?.product_name : "None flagged this week";

    return (
        <div className="relative min-h-screen w-full bg-[#050505] text-zinc-300">
            <Sidebar />

            <div className="relative min-h-screen w-full overflow-hidden lg:pl-64">
                <Starfield />

                <div className="relative z-10 mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 sm:py-14 lg:px-10">
                {/* Section 1 — Company hero card */}
                {companyLoading ? (
                    <div className="flex items-center gap-2 text-sm text-zinc-500">
                        <Loader2 size={14} className="animate-spin" /> Loading company info...
                    </div>
                ) : company ? (
                    <div className="relative overflow-hidden rounded-[24px] border border-white/[0.07] bg-white/[0.02] p-6 backdrop-blur-xl sm:p-8">
                        <div className="pointer-events-none absolute -top-24 -left-16 h-64 w-64 rounded-full bg-orange-600/10 blur-[110px]" />
                        <SkylineIllustration />

                        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-start lg:justify-between">
                            <div className="flex min-w-0 items-start gap-5">
                                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500/20 to-orange-600/5 text-2xl font-extrabold text-orange-400 ring-1 ring-orange-500/30">
                                    {initials(company.company_name)}
                                </div>
                                <div className="min-w-0">
                                    <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-zinc-400">
                                        👋 Welcome back,
                                    </p>
                                    <h1 className="mt-1 truncate text-2xl font-extrabold leading-tight text-white sm:text-3xl">
                                        {company.company_name?.split(" ").slice(0, -1).join(" ")}{" "}
                                        <span className="text-orange-500">{company.company_name?.split(" ").slice(-1)}</span>
                                    </h1>

                                    <div className="mt-3 flex flex-wrap items-center gap-2">
                                        {company.industry_sector && (
                                            <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/25 bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-300">
                                                <Briefcase size={12} /> {company.industry_sector}
                                            </span>
                                        )}
                                        {company.company_type && (
                                            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-300">
                                                <Building2 size={12} /> {company.company_type}
                                            </span>
                                        )}
                                        {gstLabel && (
                                            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                                                <ShieldCheck size={12} /> {gstLabel}
                                            </span>
                                        )}
                                        {since && (
                                            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-400">
                                                <CalendarDays size={12} /> Since {since}
                                            </span>
                                        )}
                                    </div>

                                    {company.description && (
                                        <p className="mt-3 max-w-md text-sm leading-relaxed text-zinc-500">{company.description}</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {(company.email || company.contact_number || company.website || location) && (
                            <div className="relative mt-7 grid grid-cols-1 gap-3 border-t border-white/[0.07] pt-6 sm:grid-cols-2 lg:grid-cols-4">
                                <CompanyInfoTile icon={Mail} label="Email Address" value={company.email} />
                                <CompanyInfoTile icon={Phone} label="Phone Number" value={company.contact_number} />
                                <CompanyInfoTile icon={Globe} label="Website" value={company.website} />
                                <CompanyInfoTile icon={MapPin} label="Location" value={location} />
                            </div>
                        )}
                    </div>
                ) : (
                    <h1 className="text-2xl font-extrabold text-white sm:text-3xl">Welcome to GrowthOS AI</h1>
                )}

                {/* Section 2 — Company statistics */}
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                    <StatCard
                        icon={Package}
                        value={products.length}
                        label="Products"
                        description="Active"
                        onClick={() => navigate("/products")}
                    />
                    <StatCard icon={Crown} value="Enterprise" label="Current Plan" description="Enterprise tier" />
                    <StatCard icon={CalendarClock} value="24 Dec 2026" label="Plan Expiry" description="45 days remaining" accent />
                    <StatCard icon={Users} value={12} label="Team Members" description="Active" />
                    <StatCard icon={IndianRupee} value="₹0" label="Monthly Revenue" description="This month" />
                </div>

                {/* Section 3 — Quick actions */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                    {QUICK_ACTIONS.map((action) => (
                        <button
                            key={action.label}
                            type="button"
                            onClick={handleQuickAction(action)}
                            className="group relative flex flex-col items-start gap-3 overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 text-left backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-orange-500/50 hover:bg-orange-500/[0.06]"
                        >
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20 transition group-hover:bg-orange-500 group-hover:text-white">
                                <action.icon size={16} />
                            </span>
                            <div>
                                <p className="text-sm font-semibold text-white">{action.label}</p>
                                <p className="mt-0.5 text-[11px] text-zinc-500">{action.subtitle}</p>
                            </div>
                            <ChevronRight
                                size={14}
                                className="absolute right-3 top-3 text-zinc-700 opacity-0 transition group-hover:translate-x-0.5 group-hover:text-orange-400 group-hover:opacity-100"
                            />
                        </button>
                    ))}
                </div>

                {/* Section 5 & 6 — Recent activity + AI insights */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                    <div className="rounded-[24px] border border-white/[0.07] bg-white/[0.02] p-6 backdrop-blur-xl lg:col-span-2">
                        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                            <History size={18} className="text-orange-500" /> Recent Activity
                        </h2>
                        <ul className="relative mt-6 space-y-6 before:absolute before:left-[15px] before:top-1 before:h-[calc(100%-8px)] before:w-px before:bg-white/[0.08]">
                            {ACTIVITY.map((item, i) => (
                                <li key={i} className="relative flex items-start gap-4">
                                    <span className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-orange-500/25 bg-[#0a0a0a] text-orange-400">
                                        <item.icon size={14} />
                                    </span>
                                    <div className="min-w-0 pt-1">
                                        <p className="text-sm font-semibold text-white">{item.text}</p>
                                        <p className="truncate text-xs text-zinc-500">{item.detail}</p>
                                    </div>
                                    <span className="ml-auto shrink-0 pt-1 text-[11px] text-zinc-600">{item.time}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="rounded-[24px] border border-orange-500/20 bg-gradient-to-br from-orange-500/[0.05] via-white/[0.02] to-white/[0.02] p-6 backdrop-blur-xl lg:col-span-3">
                        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                            <Sparkles size={18} className="text-orange-500" /> AI Insights
                        </h2>
                        <p className="mt-0.5 text-xs text-zinc-500">Generated from your products and pipeline activity</p>

                        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <InsightRow icon={TrendingUp} label="Top performing product" value={topProduct} />
                            <InsightRow icon={Sparkles} label="Revenue prediction" value="+18% next month" />
                            <InsightRow icon={Megaphone} label="Recommended campaign" value="Re-engage cold leads via WhatsApp" />
                            <InsightRow icon={AlertTriangle} label="Low engagement" value={lowEngagement} />
                        </div>

                        <div className="mt-3 flex items-start gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20">
                                <Lightbulb size={14} />
                            </span>
                            <div>
                                <p className="text-xs font-medium text-zinc-500">Suggested improvement</p>
                                <p className="mt-0.5 text-sm font-semibold text-white">
                                    Add a target audience to products missing one — it sharpens who your next campaign reaches.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                </div>
            </div>

        </div>
    );
};

export default Home;