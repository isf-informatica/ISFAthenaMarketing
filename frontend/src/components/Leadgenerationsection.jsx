import React, { useState, useEffect, useMemo } from "react";
import {
    Radar,
    Loader2,
    MapPin,
    Phone,
    Globe,
    Sparkles,
    Check,
    AlertCircle,
    Package,
    ChevronDown,
    Info,
    Lock,
    Store,
    Network,
    Rocket,
    Mail,
    FileUp,
    Link2,
    Bot,
    Map as MapIcon,
    Search,
    ExternalLink,
    Bookmark,
    Compass,
    ArrowLeft,
    ArrowUpRight,
    RefreshCw,
    Users,
} from "lucide-react";
import { useCustomerData } from "./CustomerDataContext";

/* ==========================================================
   LEAD GENERATION
   Opened from the sidebar, scoped to whichever product the user
   clicked into from Home (Home.jsx / PricingPage.jsx / Growthosdashboard.jsx
   all persist that product's id under localStorage key
   "growthos_active_product_id" as the user moves through the flow).

   Two sources are live right now, and they return two DIFFERENT
   kinds of results — shown in two separate sections below:

   - OpenStreetMap: queries the free OSM Overpass API for REAL,
     currently-mapped businesses matching the product's Category
     near its Target Location. Verified to exist; contact info is
     often sparse (crowd-sourced map data).

   - AI Search: sends the product's own details (name, description,
     category, target audience/location) to Groq's free LLM and asks
     it to research and propose likely prospect organizations, with
     richer fields (decision maker, designation, company size,
     pain points, lead score, reasoning). This is AI-INFERRED from
     general knowledge, NOT verified real-time data — shown with
     a clear disclaimer.

   Everything else (Google Maps, Google Business, LinkedIn,
   Apollo.io, Hunter.io, CSV Upload, Website URL, Custom Search)
   needs a paid API key or separate build that isn't connected
   yet, so those render as locked "Coming soon" cards.
========================================================== */

const API_BASE_URL = "http://localhost:8000";
const PRODUCTS_ENDPOINT = `${API_BASE_URL}/products`;
const DISCOVER_ENDPOINT = `${API_BASE_URL}/leads/discover`;
const AI_PROSPECTS_ENDPOINT = `${API_BASE_URL}/leads/ai-prospects`;
const CREATE_LEAD_ENDPOINT = `${API_BASE_URL}/leads`;
const LEADS_LIST_ENDPOINT = `${API_BASE_URL}/leads`;
const VERIFY_URL_ENDPOINT = `${API_BASE_URL}/verify-url`;

// Leads shown under the "Saved Leads" card are the ones that originated
// from THIS page (Lead Generation) and were already added to the CRM —
// identified by their lead_source, same values set in addOsmLeadToCrm /
// addProspectToCrm below.
const GENERATED_LEAD_SOURCES = ["OpenStreetMap", "AI Search"];

const ACTIVE_PRODUCT_KEY = "growthos_active_product_id";

// Every request here is company-scoped via this JWT — same pattern as
// Home.jsx and every other module that talks to growthos_backend.
const authHeaders = () => {
    const token = localStorage.getItem("growthos_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
};

// Only these two actually fetch data right now — everything else in this
// list needs a paid API key / separate integration that isn't wired up
// yet, so they render as locked "Coming soon" cards.
const LEAD_SOURCES = [
    { id: "google_maps", label: "Google Maps", icon: MapPin, enabled: false },
    { id: "google_business", label: "Google Business", icon: Store, enabled: false },
    { id: "linkedin", label: "LinkedIn Companies", icon: Network, enabled: false },
    { id: "apollo", label: "Apollo.io", icon: Rocket, enabled: false },
    { id: "hunter", label: "Hunter.io", icon: Mail, enabled: false },
    { id: "csv_upload", label: "CSV Upload", icon: FileUp, enabled: false },
    { id: "website_url", label: "Website URL", icon: Link2, enabled: false },
    { id: "ai_search", label: "AI Search", icon: Bot, enabled: true },
    { id: "openstreetmap", label: "OpenStreetMap", icon: MapIcon, enabled: true },
    { id: "custom_search", label: "Custom Search", icon: Search, enabled: false },
];

const PROSPECT_FIELDS = [
    { key: "company_name", label: "Company" },
    { key: "website", label: "Website" },
    { key: "decision_maker", label: "Decision Maker" },
    { key: "designation", label: "Designation" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Phone" },
    { key: "linkedin", label: "LinkedIn" },
    { key: "location", label: "Location" },
    { key: "industry", label: "Industry" },
    { key: "company_size", label: "Company Size" },
    { key: "estimated_scale", label: "Estimated Scale" },
    { key: "technology_used", label: "Technology Used" },
    { key: "pain_points", label: "Pain Points" },
    { key: "lead_score", label: "Lead Score" },
    { key: "reason", label: "Reason" },
];

// AI Search prospects' websites are AI-inferred, not real, live-verified
// data — the domain frequently doesn't exist. This checks it for real,
// right when clicked, instead of opening a dead tab.
const VerifiedWebsiteLink = ({ url, className }) => {
    const [checking, setChecking] = useState(false);
    const [unreachable, setUnreachable] = useState(false);

    const handleClick = async (e) => {
        e.preventDefault();
        if (checking) return;
        setChecking(true);
        setUnreachable(false);
        try {
            const res = await fetch(`${VERIFY_URL_ENDPOINT}?url=${encodeURIComponent(url)}`);
            const data = await res.json();
            if (data.reachable) {
                window.open(data.checked_url, "_blank", "noopener,noreferrer");
            } else {
                setUnreachable(true);
                setTimeout(() => setUnreachable(false), 3500);
            }
        } catch (err) {
            setUnreachable(true);
            setTimeout(() => setUnreachable(false), 3500);
        } finally {
            setChecking(false);
        }
    };

    return (
        <span className="inline-flex flex-col">
            <button type="button" onClick={handleClick} disabled={checking} className={className}>
                <span className="truncate max-w-[150px]">{url}</span>
                {checking ? (
                    <Loader2 size={10} className="shrink-0 animate-spin" />
                ) : (
                    <ExternalLink size={10} className="shrink-0" />
                )}
            </button>
            {unreachable && <span className="text-red-400 text-[10px] mt-0.5">Site unreachable — not opened</span>}
        </span>
    );
};

// ---------- Module picker card (sleek / premium) ----------
// Designed to look finished at rest, not just on hover: a two-layer
// shadow (a soft dark drop shadow for lift + a warm orange glow under
// it) gives the glass real elevation, the icon chip carries its own
// gentle glow, and the footer control reads as a real pill button
// rather than bare text. Hover simply turns all of that up.
const PremiumModuleCard = ({ icon: Icon, eyebrow, title, description, status, onOpen }) => (
    <div
        onClick={onOpen}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onOpen();
        }}
        className="group relative cursor-pointer overflow-hidden rounded-[20px] border border-white/[0.1] bg-gradient-to-br from-orange-500/[0.07] via-white/[0.035] to-transparent p-6 backdrop-blur-2xl transition-all duration-300 hover:-translate-y-1 hover:border-orange-400/45 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08),0_24px_48px_-24px_rgba(0,0,0,0.65),0_12px_28px_-14px_rgba(255,107,0,0.22)] hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_32px_64px_-20px_rgba(255,107,0,0.42)]"
    >
        {/* ambient color glow — soft at rest, blooms to full strength on hover */}
        <div className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full bg-orange-500/25 blur-[70px] opacity-60 transition-opacity duration-500 group-hover:opacity-100" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-32 w-32 rounded-full bg-orange-500/20 blur-[60px] opacity-35 transition-opacity duration-500 group-hover:opacity-100" />

        {/* glass sheen — hairline highlight along the top edge, catching the light */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent" />

        {/* corner mark — the card's one recurring signature detail */}
        <div className="pointer-events-none absolute right-5 top-5 h-3 w-3 border-r border-t border-orange-300/30 transition-colors duration-300 group-hover:border-orange-300/60" />

        <div className="relative flex items-center justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-orange-400/25 bg-orange-500/[0.12] shadow-[0_0_24px_-6px_rgba(255,107,0,0.45)] backdrop-blur-md transition-all duration-300 group-hover:border-orange-400/50 group-hover:bg-orange-500/[0.22] group-hover:shadow-[0_0_32px_-4px_rgba(255,107,0,0.6)]">
                <Icon size={19} className="text-orange-300 transition-colors duration-300 group-hover:text-orange-200" />
            </div>
            {eyebrow && (
                <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-orange-200/50">{eyebrow}</span>
            )}
        </div>

        <h3 className="relative mt-5 text-[18px] font-semibold tracking-tight text-white">{title}</h3>
        <p className="relative mt-2 text-[13.5px] leading-relaxed text-zinc-400">{description}</p>

        <div className="relative mt-6 flex items-center justify-between border-t border-white/[0.08] pt-4">
            {status ? (
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/80" />
                    {status}
                </span>
            ) : (
                <span />
            )}
            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    onOpen();
                }}
                className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-[12px] font-medium text-zinc-200 transition-all duration-300 group-hover:border-orange-400/40 group-hover:bg-orange-500/[0.14] group-hover:text-orange-300"
            >
                Open
                <ArrowUpRight size={13} className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
        </div>
    </div>
);

const LeadGenerationSection = () => {
    const { fetchLeads } = useCustomerData();

    // null = show the two entry cards, "saved" = Saved Leads list,
    // "unsaved" = the lead discovery flow (everything that used to be
    // the whole page).
    const [activeView, setActiveView] = useState(null);

    const [savedLeads, setSavedLeads] = useState([]);
    const [savedLoading, setSavedLoading] = useState(false);
    const [savedError, setSavedError] = useState("");
    const [savedFetched, setSavedFetched] = useState(false);
    // "" = All Products. Otherwise a product id — same dropdown pattern
    // as the main "Product" selector used in the discovery flow below.
    const [savedProductId, setSavedProductId] = useState("");

    const [products, setProducts] = useState([]);
    const [productsLoading, setProductsLoading] = useState(true);
    const [selectedProductId, setSelectedProductId] = useState(
        () => localStorage.getItem(ACTIVE_PRODUCT_KEY) || ""
    );

    const [selectedSources, setSelectedSources] = useState(() => new Set());

    // OpenStreetMap results (real, verified-to-exist places).
    const [discovered, setDiscovered] = useState([]);
    // AI Search results (AI-inferred prospect research, richer fields).
    const [prospects, setProspects] = useState([]);

    const [searchLoading, setSearchLoading] = useState(false);
    const [searchError, setSearchError] = useState("");
    const [hasSearched, setHasSearched] = useState(false);

    // Per-lead state so each "Add to CRM" button can show its own
    // in-flight/added status independent of the others. Keyed across both
    // result types since the keys themselves don't collide.
    const [addingKey, setAddingKey] = useState(null);
    const [addedKeys, setAddedKeys] = useState(() => new Set());

    useEffect(() => {
        (async () => {
            setProductsLoading(true);
            try {
                const res = await fetch(PRODUCTS_ENDPOINT, { method: "GET", headers: authHeaders() });
                const resp = await res.json().catch(() => null);
                const list = res.ok && resp?.success && Array.isArray(resp.data) ? resp.data : [];
                setProducts(list);
                setSelectedProductId((prev) => {
                    const stillExists = list.some((p) => String(p.id) === String(prev));
                    if (stillExists) return prev;
                    return list.length ? String(list[0].id) : "";
                });
            } catch (err) {
                setProducts([]);
            } finally {
                setProductsLoading(false);
            }
        })();
    }, []);

    const selectedProduct = useMemo(
        () => products.find((p) => String(p.id) === String(selectedProductId)) || null,
        [products, selectedProductId]
    );

    // Saved Leads list narrowed down to whichever product is chosen in
    // that view's own dropdown ("" = All Products = no filtering).
    const filteredSavedLeads = useMemo(() => {
        if (!savedProductId) return savedLeads;
        return savedLeads.filter((l) => String(l.product_id ?? "") === String(savedProductId));
    }, [savedLeads, savedProductId]);

    // Switching products clears previous results/sources instead of
    // showing stale leads under a different product's targeting info.
    const handleSelectProduct = (id) => {
        setSelectedProductId(id);
        localStorage.setItem(ACTIVE_PRODUCT_KEY, id);
        resetResults();
    };

    const resetResults = () => {
        setDiscovered([]);
        setProspects([]);
        setHasSearched(false);
        setSearchError("");
        setAddedKeys(new Set());
    };

    // Pulls every lead already saved to the CRM, then narrows it down to
    // just the ones this Lead Generation page created (OpenStreetMap /
    // AI Search sourced) — that's what the "Saved Leads" card shows.
    const fetchSavedLeads = async () => {
        setSavedLoading(true);
        setSavedError("");
        try {
            const res = await fetch(LEADS_LIST_ENDPOINT, { method: "GET", headers: authHeaders() });
            const resp = await res.json().catch(() => null);
            const list = res.ok && resp?.success && Array.isArray(resp.data) ? resp.data : [];
            setSavedLeads(list.filter((l) => GENERATED_LEAD_SOURCES.includes(l.lead_source)));
        } catch (err) {
            setSavedError("Couldn't load saved leads. Please try again.");
        } finally {
            setSavedLoading(false);
            setSavedFetched(true);
        }
    };

    const openSavedLeads = () => {
        setActiveView("saved");
        if (!savedFetched) fetchSavedLeads();
    };

    const toggleSource = (source) => {
        if (!source.enabled) return; // locked/"Coming soon" — not selectable yet
        setSelectedSources((prev) => {
            const next = new Set(prev);
            if (next.has(source.id)) next.delete(source.id);
            else next.add(source.id);
            return next;
        });
    };

    // Sends the product's own details to Groq (free) and asks it to
    // research likely prospects — NOT real-time verified data, just what
    // a knowledgeable researcher could put together as a starting point.
    // Goes through OUR backend so the API key stays server-side instead
    // of in the JS bundle, same pattern as the OpenStreetMap source.
    const fetchAiProspects = async (product) => {
        const res = await fetch(`${AI_PROSPECTS_ENDPOINT}?product_id=${product.id}`, {
            method: "GET",
            headers: authHeaders(),
        });
        const resp = await res.json().catch(() => null);
        if (!res.ok || !resp?.success) {
            throw new Error(resp?.message || "Couldn't reach AI Search.");
        }
        return Array.isArray(resp.data) ? resp.data : [];
    };

    const findLeads = async () => {
        if (!selectedProduct || selectedSources.size === 0) return;
        setSearchLoading(true);
        setSearchError("");
        setHasSearched(true);
        setAddedKeys(new Set());
        setDiscovered([]);
        setProspects([]);

        if (selectedSources.has("openstreetmap")) {
            try {
                const params = new URLSearchParams({ product_id: selectedProduct.id });
                const res = await fetch(`${DISCOVER_ENDPOINT}?${params.toString()}`, {
                    method: "GET",
                    headers: authHeaders(),
                });
                const resp = await res.json().catch(() => null);
                if (res.ok && resp?.success && Array.isArray(resp.data)) {
                    setDiscovered(resp.data);
                }
            } catch (err) {
                // Leaves discovered empty — the "no matches" state below covers it.
            }
        }

        if (selectedSources.has("ai_search")) {
            try {
                const results = await fetchAiProspects(selectedProduct);
                setProspects(results);
            } catch (err) {
                setSearchError(err.message || "Couldn't reach AI Search. Please try again.");
            }
        }

        setSearchLoading(false);
    };

    const addOsmLeadToCrm = async (lead) => {
        const key = String(lead.osm_id ?? lead.user_name);
        setAddingKey(key);
        try {
            const res = await fetch(CREATE_LEAD_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeaders() },
                body: JSON.stringify({
                    user_name: lead.user_name,
                    user_address: lead.user_address,
                    user_email: lead.user_email,
                    user_mobile_number: lead.user_mobile_number,
                    web_url: lead.web_url,
                    country: lead.country,
                    gmb_status: lead.gmb_status || "Uncategorized",
                    lead_source: lead.lead_source || "OpenStreetMap",
                    current_status: "New",
                    prospect_comment: selectedProduct
                        ? `Discovered for product: ${selectedProduct.product_name}`
                        : "",
                    product_id: selectedProduct?.id ?? null,
                }),
            });
            const resp = await res.json().catch(() => null);
            if (res.ok && resp?.success) {
                setAddedKeys((prev) => new Set(prev).add(key));
                setSavedFetched(false); // Saved Leads list is now stale — refetch next time it opens.
                fetchLeads();
            }
        } catch (err) {
            // Leave the button in its non-added state — the user can retry.
        } finally {
            setAddingKey(null);
        }
    };

    const addProspectToCrm = async (prospect, index) => {
        const key = `gpt-${index}-${prospect.company_name}`;
        setAddingKey(key);
        try {
            const res = await fetch(CREATE_LEAD_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeaders() },
                body: JSON.stringify({
                    user_name: prospect.company_name,
                    user_address: prospect.location || "",
                    user_email: prospect.email || "",
                    user_mobile_number: prospect.phone || "",
                    web_url: prospect.website || "",
                    country: "",
                    gmb_status: "Uncategorized",
                    lead_source: "AI Search",
                    current_status: "New",
                    prospect_comment: selectedProduct
                        ? `Discovered by AI Search for product: ${selectedProduct.product_name}`
                        : "AI-generated prospect — verify details before outreach.",
                    product_id: selectedProduct?.id ?? null,
                    // Carries this exact score into Lead Management's "AI
                    // Score" column instead of it being recomputed there.
                    ai_score: Number.isFinite(Number(prospect.lead_score))
                        ? Math.round(Number(prospect.lead_score))
                        : null,
                    // Rich AI Search fields have their own dedicated columns
                    // in Lead Management — sent here directly instead of
                    // being packed into prospect_comment (which is what
                    // was silently dropping all of this before).
                    decision_maker: prospect.decision_maker || "",
                    designation: prospect.designation || "",
                    linkedin_url: prospect.linkedin || "",
                    industry: prospect.industry || "",
                    company_size: prospect.company_size || "",
                    estimated_scale: prospect.estimated_scale || "",
                    technology_used: prospect.technology_used || "",
                    pain_points: prospect.pain_points || "",
                    reason: prospect.reason || "",
                }),
            });
            const resp = await res.json().catch(() => null);
            if (res.ok && resp?.success) {
                setAddedKeys((prev) => new Set(prev).add(key));
                setSavedFetched(false); // Saved Leads list is now stale — refetch next time it opens.
                fetchLeads();
            }
        } catch (err) {
            // Leave the button in its non-added state — the user can retry.
        } finally {
            setAddingKey(null);
        }
    };

    const canSearch = Boolean(selectedProduct) && selectedSources.size > 0;

    return (
        <div id="sec-lead-generation" className="h-full flex flex-col py-6 overflow-y-auto overflow-x-hidden pr-1">
            {/* Header */}
            <div className="shrink-0">
                <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
                    <Radar className="text-orange-500" size={26} />
                    Lead Generation
                </h1>
                <p className="text-gray-400 mt-1.5 text-sm">
                    Choose a lead source, then discover businesses matching a product's target audience.
                </p>
            </div>

            {/* Entry point: two cards — Saved Leads / Unsaved Leads.
                Sleek/glass treatment: bordered icon mark, hairline rules,
                a corner mark as the one signature detail, minimal text
                link instead of a boxed button. */}
            {activeView === null && (
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl shrink-0">
                    <PremiumModuleCard
                        icon={Bookmark}
                        eyebrow="In your CRM"
                        title="Saved Leads"
                        description="Leads you've already discovered here and added to your CRM."
                        onOpen={openSavedLeads}
                    />
                    <PremiumModuleCard
                        icon={Compass}
                        eyebrow="Discover"
                        title="Unsaved Leads"
                        description="Discover new businesses via AI Search or OpenStreetMap and add them to your CRM."
                        onOpen={() => setActiveView("unsaved")}
                    />
                </div>
            )}

            {/* Saved Leads view */}
            {activeView === "saved" && (
                <div className="mt-6 flex-1 min-h-0 flex flex-col">
                    <button
                        type="button"
                        onClick={() => setActiveView(null)}
                        className="shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-orange-400 transition w-fit"
                    >
                        <ArrowLeft size={14} /> Back
                    </button>

                    <div className="flex items-center justify-between mt-4 shrink-0 gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                            <Bookmark size={16} className="text-orange-500" />
                            <h2 className="text-sm font-semibold text-white">
                                Saved Leads {savedFetched && !savedLoading ? `(${filteredSavedLeads.length})` : ""}
                            </h2>
                        </div>
                        <button
                            type="button"
                            onClick={fetchSavedLeads}
                            disabled={savedLoading}
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-orange-400 disabled:opacity-50 transition"
                        >
                            <RefreshCw size={13} className={savedLoading ? "animate-spin" : ""} /> Refresh
                        </button>
                    </div>

                    {/* Product filter — same dropdown pattern as the main Product
                        selector in the discovery flow, scoped to this view. */}
                    <div className="mt-3 shrink-0 max-w-md">
                        <label className="text-xs font-semibold text-gray-400 tracking-wide uppercase">Product</label>
                        {productsLoading ? (
                            <div className="flex items-center gap-2 text-gray-500 text-sm mt-2">
                                <Loader2 size={14} className="animate-spin" /> Loading your products...
                            </div>
                        ) : products.length === 0 ? (
                            <div className="mt-2 flex items-center gap-2 text-gray-500 text-sm border border-dashed border-orange-600/30 rounded-xl px-4 py-3">
                                <Package size={15} />
                                No products yet — add one from the Home page first.
                            </div>
                        ) : (
                            <div className="relative mt-2">
                                <select
                                    value={savedProductId}
                                    onChange={(e) => setSavedProductId(e.target.value)}
                                    className="w-full appearance-none bg-black border border-orange-600/30 text-white text-sm rounded-xl pl-4 pr-10 py-2.5 outline-none focus:border-orange-500/60"
                                >
                                    <option value="">All Products</option>
                                    {products.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            {p.product_name}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                            </div>
                        )}
                    </div>

                    <div className="mt-4 flex-1 min-h-0 overflow-y-auto">
                        {savedLoading && (
                            <div className="flex items-center gap-2 text-gray-500 text-sm py-10 justify-center">
                                <Loader2 size={14} className="animate-spin" /> Loading saved leads...
                            </div>
                        )}

                        {!savedLoading && savedError && (
                            <div className="flex items-center gap-2 text-sm text-red-400 border border-red-500/30 bg-red-500/10 rounded-xl px-4 py-3">
                                <AlertCircle size={15} /> {savedError}
                            </div>
                        )}

                        {!savedLoading && !savedError && savedFetched && filteredSavedLeads.length === 0 && (
                            <div className="border border-dashed border-orange-600/30 rounded-2xl py-14 flex flex-col items-center gap-2 text-center px-4">
                                <Users size={28} className="text-gray-600" />
                                <p className="text-gray-500 text-sm max-w-sm">
                                    {savedProductId
                                        ? "No saved leads yet for this product."
                                        : "No saved leads yet. Head to \"Unsaved Leads\" to discover businesses and add them here."}
                                </p>
                            </div>
                        )}

                        {!savedLoading && !savedError && filteredSavedLeads.length > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
                                {filteredSavedLeads.map((lead) => (
                                    <div
                                        key={lead.id ?? `${lead.user_name}-${lead.lead_source}`}
                                        className="bg-black border border-orange-600/20 rounded-2xl p-4 flex flex-col gap-2.5"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <h3 className="text-white font-semibold text-sm leading-snug">{lead.user_name}</h3>
                                            <span className="shrink-0 text-[10px] bg-white/5 border border-white/10 text-gray-400 rounded-full px-2 py-0.5">
                                                {lead.lead_source}
                                            </span>
                                        </div>

                                        {lead.user_address && (
                                            <div className="flex items-start gap-1.5 text-xs text-gray-400">
                                                <MapPin size={13} className="text-orange-500 shrink-0 mt-0.5" />
                                                <span className="leading-snug">{lead.user_address}</span>
                                            </div>
                                        )}
                                        {lead.user_mobile_number && (
                                            <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                                <Phone size={13} className="text-orange-500 shrink-0" />
                                                {lead.user_mobile_number}
                                            </div>
                                        )}
                                        {lead.web_url && (
                                            <div className="flex items-center gap-1.5 text-xs text-gray-400 min-w-0">
                                                <Globe size={13} className="text-orange-500 shrink-0" />
                                                <span className="truncate">{lead.web_url}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between mt-1 pt-2 border-t border-white/5">
                                            <span className="text-[10px] text-gray-500">{lead.current_status || "New"}</span>
                                            {Number.isFinite(Number(lead.ai_score)) && (
                                                <span className="text-[11px] text-orange-400 font-semibold">
                                                    Score: {Math.round(Number(lead.ai_score))}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeView === "unsaved" && (
              <>
                <button
                    type="button"
                    onClick={() => setActiveView(null)}
                    className="mt-6 shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-orange-400 transition w-fit"
                >
                    <ArrowLeft size={14} /> Back
                </button>

            {/* Product selector */}
            <div className="mt-6 shrink-0">
                <label className="text-xs font-semibold text-gray-400 tracking-wide uppercase">Product</label>
                {productsLoading ? (
                    <div className="flex items-center gap-2 text-gray-500 text-sm mt-2">
                        <Loader2 size={14} className="animate-spin" /> Loading your products...
                    </div>
                ) : products.length === 0 ? (
                    <div className="mt-2 flex items-center gap-2 text-gray-500 text-sm border border-dashed border-orange-600/30 rounded-xl px-4 py-3">
                        <Package size={15} />
                        No products yet — add one from the Home page first.
                    </div>
                ) : (
                    <div className="relative mt-2 max-w-md">
                        <select
                            value={selectedProductId}
                            onChange={(e) => handleSelectProduct(e.target.value)}
                            className="w-full appearance-none bg-black border border-orange-600/30 text-white text-sm rounded-xl pl-4 pr-10 py-2.5 outline-none focus:border-orange-500/60"
                        >
                            {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.product_name}
                                </option>
                            ))}
                        </select>
                        <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    </div>
                )}
            </div>

            {selectedProduct && (
                <>
                    {/* Step 1: Choose Lead Source(s) */}
                    <div className="mt-6 shrink-0">
                        <h2 className="text-sm font-semibold text-white">Choose Lead Source</h2>
                        <p className="text-xs text-gray-500 mt-1">
                            Select one or more. Only AI Search and OpenStreetMap are live right now — the rest are on the roadmap.
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-3">
                            {LEAD_SOURCES.map((source) => {
                                const Icon = source.icon;
                                const checked = selectedSources.has(source.id);
                                return (
                                    <button
                                        key={source.id}
                                        type="button"
                                        onClick={() => toggleSource(source)}
                                        disabled={!source.enabled}
                                        className={`relative flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-left transition ${
                                            !source.enabled
                                                ? "border-white/5 bg-white/[0.02] opacity-50 cursor-not-allowed"
                                                : checked
                                                ? "border-orange-500 bg-orange-500/10"
                                                : "border-orange-600/20 bg-black hover:border-orange-500/50"
                                        }`}
                                    >
                                        <span
                                            className={`h-4 w-4 rounded border shrink-0 flex items-center justify-center ${
                                                checked ? "bg-orange-500 border-orange-500" : "border-gray-600"
                                            }`}
                                        >
                                            {checked && <Check size={11} className="text-white" />}
                                        </span>
                                        <Icon size={15} className={checked ? "text-orange-400 shrink-0" : "text-gray-500 shrink-0"} />
                                        <span className={`text-xs font-medium truncate ${checked ? "text-white" : "text-gray-400"}`}>
                                            {source.label}
                                        </span>
                                        {!source.enabled && (
                                            <span className="absolute -top-2 -right-2 flex items-center gap-0.5 text-[9px] font-semibold bg-[#1a1a1a] border border-white/10 text-gray-500 rounded-full px-1.5 py-0.5">
                                                <Lock size={8} /> Soon
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Product summary + Find Leads action */}
                    <div className="rounded-2xl border border-orange-600/20 bg-black p-5 mt-5 shrink-0">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Product</p>
                                <p className="text-sm text-white font-medium mt-0.5 truncate">{selectedProduct.product_name}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Industry</p>
                                <p className="text-sm text-white font-medium mt-0.5 truncate">{selectedProduct.category || "—"}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Target</p>
                                <p className="text-sm text-white font-medium mt-0.5 truncate">{selectedProduct.target_audience || "—"}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Location</p>
                                <p className="text-sm text-white font-medium mt-0.5 truncate">{selectedProduct.target_location || "—"}</p>
                            </div>
                        </div>

                        <button
                            onClick={findLeads}
                            disabled={!canSearch || searchLoading}
                            className="w-full mt-5 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-3 rounded-xl transition"
                        >
                            {searchLoading ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" /> Searching...
                                </>
                            ) : (
                                <>
                                    <Sparkles size={16} /> Find Leads
                                </>
                            )}
                        </button>
                        {!canSearch && (
                            <p className="text-[11px] text-gray-600 text-center mt-2">Select at least one lead source above.</p>
                        )}
                    </div>
                </>
            )}

            {/* Results */}
            <div className="mt-6 flex-1 min-h-0">
                {searchError && (
                    <div className="flex items-center gap-2 text-sm text-red-400 border border-red-500/30 bg-red-500/10 rounded-xl px-4 py-3 mb-4">
                        <AlertCircle size={15} /> {searchError}
                    </div>
                )}

                {!selectedProduct && !productsLoading && products.length > 0 && (
                    <div className="border border-dashed border-orange-600/30 rounded-2xl py-14 flex flex-col items-center gap-2 text-center px-4">
                        <Package size={28} className="text-gray-600" />
                        <p className="text-gray-500 text-sm">Pick a product above to get started.</p>
                    </div>
                )}

                {selectedProduct && !hasSearched && !searchError && (
                    <div className="border border-dashed border-orange-600/30 rounded-2xl py-14 flex flex-col items-center gap-2 text-center px-4">
                        <Radar size={28} className="text-gray-600" />
                        <p className="text-gray-500 text-sm">
                            Choose a lead source and click "Find Leads" to discover businesses matching {selectedProduct.product_name}.
                        </p>
                    </div>
                )}

                {hasSearched && !searchLoading && !searchError && discovered.length === 0 && prospects.length === 0 && (
                    <div className="border border-dashed border-orange-600/30 rounded-2xl py-14 flex flex-col items-center gap-2 text-center px-4">
                        <Package size={28} className="text-gray-600" />
                        <p className="text-gray-500 text-sm max-w-sm">
                            No matches found yet for this search. Try a broader target location on the product, or check back later.
                        </p>
                    </div>
                )}

                {/* AI Search prospects — AI-inferred, richer fields, clearly disclaimed */}
                {prospects.length > 0 && (
                    <div className="mb-8">
                        <div className="flex items-center gap-2 mb-2">
                            <Bot size={15} className="text-orange-500" />
                            <h3 className="text-sm font-semibold text-white">AI Search Prospects ({prospects.length})</h3>
                        </div>
                        <p className="text-[11px] text-amber-500/80 flex items-start gap-1.5 mb-3">
                            <Info size={12} className="shrink-0 mt-0.5" />
                            AI-generated from the model's general knowledge — not verified real-time data. Treat as research starting points; confirm contact details before outreach. This Lead Score carries through unchanged when you add a lead to the CRM.
                        </p>
                        <div className="border border-orange-600/20 rounded-2xl max-h-[520px] overflow-auto">
                            <table className="w-full text-xs min-w-[1100px]">
                                <thead className="sticky top-0 z-20 bg-black">
                                    <tr className="text-left text-gray-500 border-b border-orange-600/20">
                                        {PROSPECT_FIELDS.map((f) => (
                                            <th
                                                key={f.key}
                                                className={`px-3 py-2.5 font-medium whitespace-nowrap ${
                                                    f.key === "company_name" ? "sticky left-0 z-10 bg-black" : ""
                                                }`}
                                            >
                                                {f.label}
                                            </th>
                                        ))}
                                        <th className="px-3 py-2.5"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {prospects.map((p, index) => {
                                        const key = `gpt-${index}-${p.company_name}`;
                                        const isAdded = addedKeys.has(key);
                                        const isAdding = addingKey === key;
                                        return (
                                            <tr key={key} className="border-b border-white/5 last:border-0 align-top">
                                                {PROSPECT_FIELDS.map((f) => (
                                                    <td
                                                        key={f.key}
                                                        className={`px-3 py-2.5 text-gray-300 max-w-[220px] ${
                                                            f.key === "company_name" ? "sticky left-0 z-10 bg-black" : ""
                                                        }`}
                                                    >
                                                        {f.key === "website" && p.website ? (
                                                            <VerifiedWebsiteLink
                                                                url={p.website.startsWith("http") ? p.website : `https://${p.website}`}
                                                                className="text-orange-400 hover:underline flex items-center gap-1"
                                                            />
                                                        ) : f.key === "company_name" ? (
                                                            <span className="text-white font-medium">{p[f.key] || "—"}</span>
                                                        ) : f.key === "lead_score" ? (
                                                            <span className="text-orange-400 font-semibold">{p[f.key] ?? "—"}</span>
                                                        ) : (
                                                            <span className="line-clamp-3">{p[f.key] || "—"}</span>
                                                        )}
                                                    </td>
                                                ))}
                                                <td className="px-3 py-2.5">
                                                    <button
                                                        onClick={() => addProspectToCrm(p, index)}
                                                        disabled={isAdding || isAdded}
                                                        className={`flex items-center justify-center gap-1.5 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition whitespace-nowrap ${
                                                            isAdded
                                                                ? "bg-green-500/15 border border-green-500/30 text-green-400 cursor-default"
                                                                : "border border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white disabled:opacity-60"
                                                        }`}
                                                    >
                                                        {isAdded ? (
                                                            <>
                                                                <Check size={12} /> Added
                                                            </>
                                                        ) : isAdding ? (
                                                            <Loader2 size={12} className="animate-spin" />
                                                        ) : (
                                                            "Add to CRM"
                                                        )}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* OpenStreetMap results — real, verified-to-exist places */}
                {discovered.length > 0 && (
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <MapIcon size={15} className="text-orange-500" />
                            <h3 className="text-sm font-semibold text-white">OpenStreetMap Results ({discovered.length})</h3>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5">
                            {discovered.map((lead) => {
                                const key = String(lead.osm_id ?? lead.user_name);
                                const isAdded = addedKeys.has(key);
                                const isAdding = addingKey === key;
                                return (
                                    <div
                                        key={key}
                                        className="bg-black border border-orange-600/20 rounded-2xl p-4 flex flex-col gap-2.5"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <h3 className="text-white font-semibold text-sm leading-snug">{lead.user_name}</h3>
                                            <span className="shrink-0 text-[10px] bg-white/5 border border-white/10 text-gray-400 rounded-full px-2 py-0.5">
                                                OpenStreetMap
                                            </span>
                                        </div>

                                        {lead.user_address && (
                                            <div className="flex items-start gap-1.5 text-xs text-gray-400">
                                                <MapPin size={13} className="text-orange-500 shrink-0 mt-0.5" />
                                                <span className="leading-snug">{lead.user_address}</span>
                                            </div>
                                        )}
                                        {lead.user_mobile_number && (
                                            <div className="flex items-center gap-1.5 text-xs text-gray-400">
                                                <Phone size={13} className="text-orange-500 shrink-0" />
                                                {lead.user_mobile_number}
                                            </div>
                                        )}
                                        {lead.web_url && (
                                            <div className="flex items-center gap-1.5 text-xs text-gray-400 min-w-0">
                                                <Globe size={13} className="text-orange-500 shrink-0" />
                                                <span className="truncate">{lead.web_url}</span>
                                            </div>
                                        )}
                                        {!lead.user_mobile_number && !lead.web_url && (
                                            <p className="text-[11px] text-gray-600 italic">No contact details mapped for this listing.</p>
                                        )}

                                        <button
                                            onClick={() => addOsmLeadToCrm(lead)}
                                            disabled={isAdding || isAdded}
                                            className={`mt-1.5 flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg transition ${
                                                isAdded
                                                    ? "bg-green-500/15 border border-green-500/30 text-green-400 cursor-default"
                                                    : "border border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white disabled:opacity-60"
                                            }`}
                                        >
                                            {isAdded ? (
                                                <>
                                                    <Check size={13} /> Added to CRM
                                                </>
                                            ) : isAdding ? (
                                                <>
                                                    <Loader2 size={13} className="animate-spin" /> Adding...
                                                </>
                                            ) : (
                                                "Add to CRM"
                                            )}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
              </>
            )}
        </div>
    );
};

export default LeadGenerationSection;