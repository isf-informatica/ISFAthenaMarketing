import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Image as ImageIcon,
    Sparkles,
    FileText,
    ArrowLeft,
    Upload,
    X,
    Download,
    Loader2,
    AlertCircle,
    Phone,
    Mail,
    Globe,
    MapPin,
    ChevronDown,
    Palette,
    Check,
    ArrowUpRight,
    Wand2,
    History,
    Save,
    RotateCcw,
    Plus,
    Trash2,
    LayoutGrid,
    Columns,
    BookOpen,
    Building2,
    DollarSign,
    Quote,
    ImagePlus,
    Rocket,
    Layers,
    Hash,
} from "lucide-react";

// Standalone backend from feature_card_generator.py (see that file's
// docstring) — separate from the main growthos_backend used elsewhere
// in this dashboard (that one runs on :8000; this one on :5000).
const FEATURE_CARD_API_BASE = "http://localhost:5000";
const AI_THEME_ENDPOINT = `${FEATURE_CARD_API_BASE}/api/generate-theme`;
// Flyer Generation lives in the same backend file (feature_card_generator.py)
// as the Feature Card module — see that file's "FLYER GENERATION MODULE"
// section — so it shares the same base URL and the same AI_THEME_ENDPOINT
// above (the AI Theme Generator is generic visual styling, reused as-is).
const FLYER_GENERATE_ENDPOINT = `${FEATURE_CARD_API_BASE}/generate-flyer`;
const FLYER_AI_CONTENT_ENDPOINT = `${FEATURE_CARD_API_BASE}/api/generate-flyer-content`;

// Saved themes live in growthos_backend (main.py, :8000) — NOT the
// feature-card backend — because that's the app that already knows
// which company is logged in (JWT + company_id, see get_current_company
// in main.py) and already has the DB connection. This is what makes
// "Save Theme" per-company: every request below is scoped to whichever
// company's token is sent, so one company's saved themes are never
// saved into, or visible in, another company's login.
const GROWTHOS_API_BASE = "http://localhost:8000";

// ── Font Style picker — shared by Feature Card and Flyer Generation ──
// `stack` is the actual CSS font-family value (with sane fallbacks);
// `google` is the Google Fonts family name to load, or null for fonts
// that are effectively already available everywhere (system/Inter).
const FONT_OPTIONS = [
    { id: "inter", label: "Inter", stack: "'Inter', sans-serif", google: "Inter:wght@400;600;700;900" },
    { id: "poppins", label: "Poppins", stack: "'Poppins', sans-serif", google: "Poppins:wght@400;600;700;900" },
    { id: "montserrat", label: "Montserrat", stack: "'Montserrat', sans-serif", google: "Montserrat:wght@400;600;700;900" },
    { id: "dmsans", label: "DM Sans", stack: "'DM Sans', sans-serif", google: "DM+Sans:wght@400;600;700;900" },
    { id: "spacegrotesk", label: "Space Grotesk", stack: "'Space Grotesk', sans-serif", google: "Space+Grotesk:wght@400;600;700" },
    { id: "playfair", label: "Playfair Display", stack: "'Playfair Display', serif", google: "Playfair+Display:wght@400;600;700;900" },
    { id: "lora", label: "Lora", stack: "'Lora', serif", google: "Lora:wght@400;600;700" },
    { id: "merriweather", label: "Merriweather", stack: "'Merriweather', serif", google: "Merriweather:wght@400;700;900" },
    { id: "timesnewroman", label: "Times New Roman", stack: "'Times New Roman', Times, serif", google: null },
    // "Other" has no fixed stack — picking it reveals a text input where
    // the person types any font name they want (system font or a Google
    // Font name); whatever they type becomes the font-family directly.
    { id: "other", label: "Other", stack: null, google: null },
];

// Injects a single <link> that loads every requested Google Font family
// once (deduped by href), so the preview — and anything captured from
// it for PNG/PDF download — actually has the glyphs available before
// it's asked to render them.
const useGoogleFonts = (families) => {
    useEffect(() => {
        const wanted = families.filter(Boolean);
        if (!wanted.length) return;
        const href = `https://fonts.googleapis.com/css2?${wanted.map((f) => `family=${f}`).join("&")}&display=swap`;
        if (document.querySelector(`link[href="${href}"]`)) return;
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        document.head.appendChild(link);
    }, [families.join("|")]);
};

const SAVED_THEMES_ENDPOINT = `${GROWTHOS_API_BASE}/saved-themes`;
// Used to prefill the Flyer Generation "AI Content Generator" fields with
// the logged-in company's own info (company name, website, industry, and
// its first saved product) — the person can still edit any of it before
// generating, this just saves retyping what's already in their profile.
const ME_ENDPOINT = `${GROWTHOS_API_BASE}/auth/me`;
const PRODUCTS_ENDPOINT = `${GROWTHOS_API_BASE}/products`;
// Whatever key the login flow stores the JWT under elsewhere in the
// dashboard — adjust this if that key is named differently there.
const AUTH_TOKEN_KEY = "growthos_token";
const authHeaders = () => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    return {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
};

/* ==========================================================
   Media — module page.
   Mounted at "/app/media" via Growthosdashboard.jsx and linked
   from the sidebar ("sec-media"). Opens into two cards; each
   one is its own "page" (same null/"view" pattern used for
   Saved/Unsaved Leads in LeadGenerationSection) so it fits the
   existing theme without needing a separate route per card.
========================================================== */

// Small labeled input, matching the form style already used elsewhere
// in the dashboard (e.g. the Product dropdown in Lead Generation).
const Field = ({ label, required, children }) => (
    <div>
        <label className="text-xs font-semibold text-gray-400 tracking-wide uppercase">
            {label} {required && <span className="text-orange-500">*</span>}
        </label>
        <div className="mt-2">{children}</div>
    </div>
);

const inputClass =
    "w-full bg-white/[0.04] border border-white/10 text-white text-sm rounded-xl px-4 py-2.5 outline-none transition focus:border-orange-500/50 focus:bg-white/[0.06] focus:ring-2 focus:ring-orange-500/10 placeholder:text-gray-600";

// Input with a leading icon — used for the contact fields so they read
// less like a plain form and more like the finished card's rows.
const IconInput = ({ icon: Icon, className = "", ...props }) => (
    <div className="relative">
        <Icon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        <input {...props} className={`${inputClass} pl-10 ${className}`} />
    </div>
);

// Groups related fields into a soft glass card with an icon-chip header,
// instead of a flat stack of bordered boxes.
const SectionCard = ({ icon: Icon, title, subtitle, action, children }) => (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-5">
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                    <Icon size={15} className="text-orange-500" />
                </div>
                <div>
                    <h4 className="text-white text-sm font-semibold leading-tight">{title}</h4>
                    {subtitle && <p className="text-gray-500 text-xs mt-0.5">{subtitle}</p>}
                </div>
            </div>
            {action}
        </div>
        <div className="space-y-4">{children}</div>
    </div>
);

const MAX_FEATURES = 8;
const emptyFeature = () => ({ title: "", description: "" });

// ---------- Card design themes ----------
// Each theme renders the SAME data (logo, form fields, features, closing
// statement) with a different layout/color treatment. Choosing a theme
// only changes presentation — it never touches what the user typed in
// the form.

const CardLogo = ({ src, size = 56, tone = "light" }) => {
    const toneClasses =
        tone === "light"
            ? "bg-gray-50 border-gray-200"
            : tone === "dark"
            ? "bg-white/5 border-white/15"
            : "bg-white/90 border-white/40"; // "onColor" — used over orange/gradient backgrounds
    const iconColor =
        tone === "light" ? "text-gray-300" : tone === "dark" ? "text-white/30" : "text-orange-500/50";
    return (
        <div
            className={`rounded-xl border flex items-center justify-center overflow-hidden shrink-0 ${toneClasses}`}
            style={{ height: size, width: size }}
        >
            {src ? (
                <img src={src} alt="Logo" className="h-full w-full object-cover object-center" />
            ) : (
                <ImageIcon size={Math.round(size * 0.36)} className={iconColor} />
            )}
        </div>
    );
};

// 1) Split Classic — white identity panel + dark feature-quadrant panel.
const ClassicSplitTheme = ({ logoPreview, productName, tagline, contactRows, features, bottomStatement }) => (
    <div className="flex flex-col sm:flex-row">
        <div className="w-full sm:w-[38%] bg-white p-6 flex flex-col gap-5">
            <CardLogo src={logoPreview} tone="light" />
            <div>
                <h3 className="text-gray-900 font-extrabold text-2xl leading-tight break-words">
                    {productName || "Your Product Name"}
                </h3>
                <div className="h-1 w-10 bg-orange-500 rounded-full mt-2.5" />
            </div>
            <div className="flex flex-col gap-3.5 mt-1">
                {contactRows.map(({ Icon, value, placeholder }, i) => (
                    <div key={i} className="flex items-center gap-3">
                        <div className="h-7 w-7 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
                            <Icon size={12} className="text-white" />
                        </div>
                        <span className="text-gray-800 text-xs font-medium leading-snug break-words">
                            {value || placeholder}
                        </span>
                    </div>
                ))}
            </div>
        </div>

        <div className="relative w-full sm:w-[62%] bg-[#0a0a0a] p-6 flex flex-col justify-between overflow-hidden">
            <div
                className="absolute -top-20 -right-20 h-64 w-64 rounded-full pointer-events-none"
                style={{ background: "rgba(255,107,0,0.10)" }}
            />
            <div className="relative z-10">
                <p className="text-white text-[13px] font-extrabold tracking-[0.15em] uppercase">
                    {tagline || "Smart. Simple. AI-Powered."}
                </p>
                <div className="h-[3px] w-16 bg-orange-500 rounded-full mt-3 mb-6" />

                <div className="relative">
                    {features.length === 4 && (
                        <div className="absolute inset-0 pointer-events-none hidden sm:block">
                            <div className="absolute left-1/2 top-2 bottom-2 w-px bg-white/10 -translate-x-1/2" />
                            <div className="absolute top-1/2 left-2 right-2 h-px bg-white/10 -translate-y-1/2" />
                            <div className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-orange-500 -translate-x-1/2 -translate-y-1/2" />
                        </div>
                    )}
                    <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6">
                        {features.length > 0 ? (
                            features.map((f, i) => (
                                <div key={i} className="flex items-start gap-2.5">
                                    <div className="h-9 w-9 rounded-full bg-orange-500/10 border-2 border-orange-500 flex items-center justify-center shrink-0">
                                        <Sparkles size={14} className="text-orange-500" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-white text-[13px] font-bold leading-snug">{f.title}</p>
                                        {f.description && (
                                            <p className="text-gray-400 text-[11px] leading-snug mt-0.5">
                                                {f.description}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-600 text-xs col-span-2">
                                Add 3–4 feature highlights to see them here.
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {bottomStatement && (
                <div className="relative z-10 mt-6 bg-white rounded-xl px-5 py-3.5 text-center">
                    <p className="text-gray-900 text-[13px] font-bold">{bottomStatement}</p>
                </div>
            )}
        </div>
    </div>
);

// 2) Blue Gradient — white identity panel + rich blue gradient feature panel.
const BlueSplitTheme = ({ logoPreview, productName, tagline, contactRows, features, bottomStatement }) => (
    <div className="flex flex-col sm:flex-row">
        <div className="w-full sm:w-[36%] bg-white p-6 flex flex-col gap-5">
            <CardLogo src={logoPreview} tone="light" />
            <div>
                <h3 className="text-gray-900 font-extrabold text-2xl leading-tight break-words">
                    {productName || "Your Product Name"}
                </h3>
                {tagline && <p className="text-gray-500 text-[11px] mt-1 break-words">{tagline}</p>}
                <div className="h-1 w-10 bg-blue-600 rounded-full mt-2.5" />
            </div>
            <div className="flex flex-col gap-3.5 mt-1">
                {contactRows.map(({ Icon, value, placeholder }, i) => (
                    <div key={i} className="flex items-center gap-3">
                        <div className="h-7 w-7 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
                            <Icon size={12} className="text-white" />
                        </div>
                        <span className="text-gray-700 text-xs font-medium leading-snug break-words">
                            {value || placeholder}
                        </span>
                    </div>
                ))}
            </div>
        </div>

        <div
            className="relative w-full sm:w-[64%] p-6 flex flex-col justify-between overflow-hidden"
            style={{ background: "linear-gradient(155deg, #3b82f6 0%, #1d4ed8 55%, #1e3a8a 100%)" }}
        >
            <div>
                <p className="text-white text-[13px] font-extrabold tracking-[0.15em] uppercase">Our Key Features</p>
                <div className="h-[3px] w-16 bg-white/60 rounded-full mt-3 mb-5" />
                <div className="flex flex-col gap-3.5">
                    {features.length > 0 ? (
                        features.map((f, i) => (
                            <div key={i} className="flex items-start gap-3">
                                <div className="h-10 w-10 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
                                    <Sparkles size={16} className="text-white" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-white text-[13px] font-bold leading-snug">{f.title}</p>
                                    {f.description && (
                                        <p className="text-blue-100/80 text-[11px] leading-snug mt-0.5">{f.description}</p>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-blue-100/70 text-xs">Add 3–4 feature highlights to see them here.</p>
                    )}
                </div>
            </div>
            {bottomStatement && (
                <div className="mt-6 bg-white rounded-xl px-5 py-3.5 text-center">
                    <p className="text-blue-700 text-[13px] font-bold">{bottomStatement}</p>
                </div>
            )}
        </div>
    </div>
);

// 3) Purple Timeline — dark, two-column, connected-dot feature list.
const PurpleTimelineTheme = ({ logoPreview, productName, tagline, contactRows, features, bottomStatement }) => (
    <div
        className="flex flex-col p-6 sm:p-7"
        style={{
            background: "radial-gradient(circle at 15% 15%, #2e1065 0%, #0b0620 55%, #05030f 100%)",
            minHeight: 380,
        }}
    >
        <div className="flex flex-col sm:flex-row gap-6 flex-1">
            <div className="w-full sm:w-[38%] flex flex-col gap-5">
                <div
                    className="h-16 w-16 border-2 border-purple-500/50 bg-white/5 flex items-center justify-center overflow-hidden shrink-0"
                    style={{ clipPath: "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)" }}
                >
                    {logoPreview ? (
                        <img src={logoPreview} alt="Logo" className="h-full w-full object-cover object-center" />
                    ) : (
                        <ImageIcon size={20} className="text-purple-300/50" />
                    )}
                </div>
                <div>
                    <h3 className="text-white font-extrabold text-2xl leading-tight break-words">
                        {productName || "Your Product Name"}
                    </h3>
                    {tagline && <p className="text-gray-400 text-[11px] mt-1.5 break-words">{tagline}</p>}
                    <div className="h-[3px] w-10 bg-purple-500 rounded-full mt-2.5" />
                </div>
                <div className="flex flex-col gap-3 mt-1">
                    {contactRows.map(({ Icon, value, placeholder }, i) => (
                        <div key={i} className="flex items-center gap-3">
                            <div className="h-7 w-7 rounded-full bg-purple-600 flex items-center justify-center shrink-0">
                                <Icon size={12} className="text-white" />
                            </div>
                            <span className="text-gray-300 text-xs font-medium leading-snug break-words">
                                {value || placeholder}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="w-full sm:w-[62%]">
                <p className="text-white text-[13px] font-extrabold tracking-[0.15em] uppercase">Feature Highlights</p>
                <div className="h-[3px] w-12 bg-purple-500 rounded-full mt-3 mb-5" />
                <div className="relative flex flex-col gap-3.5">
                    <div className="absolute left-[19px] top-2 bottom-2 w-px bg-purple-500/30 hidden sm:block" />
                    {features.length > 0 ? (
                        features.map((f, i) => (
                            <div key={i} className="relative flex items-start gap-3.5">
                                <div className="relative z-10 h-10 w-10 rounded-xl bg-purple-950 border border-purple-500/50 flex items-center justify-center shrink-0">
                                    <Sparkles size={15} className="text-purple-300" />
                                </div>
                                <div className="min-w-0 flex-1 bg-white/[0.03] border border-purple-500/20 rounded-xl px-4 py-2.5">
                                    <p className="text-white text-[13px] font-bold leading-snug">{f.title}</p>
                                    {f.description && (
                                        <p className="text-gray-400 text-[11px] leading-snug mt-0.5">{f.description}</p>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-gray-500 text-xs">Add 3–4 feature highlights to see them here.</p>
                    )}
                </div>
            </div>
        </div>

        {bottomStatement && (
            <div
                className="mt-6 rounded-xl px-5 py-3.5 text-center"
                style={{ background: "linear-gradient(90deg, #7c3aed, #a855f7)" }}
            >
                <p className="text-white text-[13px] font-bold">{bottomStatement}</p>
            </div>
        )}
    </div>
);

// 4) Nature Green — soft sage backdrop with floating white feature cards.
const NatureGreenTheme = ({ logoPreview, productName, tagline, contactRows, features, bottomStatement }) => (
    <div
        className="relative flex flex-col sm:flex-row overflow-hidden"
        style={{ minHeight: 380, background: "linear-gradient(160deg, #eef4ea 0%, #dce9d8 100%)" }}
    >
        <div
            className="absolute -bottom-16 -left-10 h-56 w-56 rounded-full pointer-events-none"
            style={{ background: "rgba(74,124,89,0.14)" }}
        />
        <div
            className="absolute top-10 right-10 h-24 w-24 rounded-full pointer-events-none hidden sm:block"
            style={{ background: "rgba(74,124,89,0.10)" }}
        />

        <div className="relative z-10 w-full sm:w-[36%] p-6 flex flex-col gap-5">
            <CardLogo src={logoPreview} tone="light" />
            <div>
                <h3 className="font-extrabold text-2xl leading-tight break-words" style={{ color: "#2f5233" }}>
                    {productName || "Your Product Name"}
                </h3>
                {tagline && <p className="text-gray-600 text-[11px] mt-1 break-words">{tagline}</p>}
                <div className="h-1 w-10 rounded-full mt-2.5" style={{ background: "#4a7c59" }} />
            </div>
            <div className="flex flex-col gap-3.5 mt-1">
                {contactRows.map(({ Icon, value, placeholder }, i) => (
                    <div key={i} className="flex items-center gap-3">
                        <div
                            className="h-7 w-7 rounded-full flex items-center justify-center shrink-0"
                            style={{ background: "#4a7c59" }}
                        >
                            <Icon size={12} className="text-white" />
                        </div>
                        <span className="text-gray-700 text-xs font-medium leading-snug break-words">
                            {value || placeholder}
                        </span>
                    </div>
                ))}
            </div>
        </div>

        <div className="relative z-10 w-full sm:w-[64%] p-6 flex flex-col justify-between">
            <div>
                <p className="text-[13px] font-extrabold tracking-[0.15em] uppercase" style={{ color: "#2f5233" }}>
                    Feature Highlights
                </p>
                <div className="h-[3px] w-14 rounded-full mt-3 mb-5" style={{ background: "#4a7c59" }} />
                <div className="flex flex-col gap-3">
                    {features.length > 0 ? (
                        features.map((f, i) => (
                            <div key={i} className="flex items-start gap-3 bg-white/80 rounded-2xl px-4 py-3 shadow-sm">
                                <div
                                    className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
                                    style={{ background: "rgba(74,124,89,0.15)" }}
                                >
                                    <Sparkles size={14} style={{ color: "#4a7c59" }} />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-gray-900 text-[13px] font-bold leading-snug">{f.title}</p>
                                    {f.description && (
                                        <p className="text-gray-500 text-[11px] leading-snug mt-0.5">{f.description}</p>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-gray-500 text-xs">Add 3–4 feature highlights to see them here.</p>
                    )}
                </div>
            </div>
            {bottomStatement && (
                <div
                    className="mt-5 rounded-xl px-5 py-3.5 text-center"
                    style={{ background: "linear-gradient(90deg, #2f5233, #4a7c59)" }}
                >
                    <p className="text-white text-[13px] font-bold">{bottomStatement}</p>
                </div>
            )}
        </div>
    </div>
);

// 5) Orange Highlights — white card, dotted accent, angled bottom banner.
const OrangeHighlightTheme = ({ logoPreview, productName, tagline, contactRows, features, bottomStatement }) => (
    <div className="relative flex flex-col bg-white overflow-hidden" style={{ minHeight: 380 }}>
        <div className="absolute top-5 right-5 grid grid-cols-4 gap-1.5 pointer-events-none hidden sm:grid">
            {Array.from({ length: 16 }).map((_, i) => (
                <span key={i} className="h-1 w-1 rounded-full bg-orange-300" />
            ))}
        </div>

        <div className="flex flex-col sm:flex-row flex-1 p-6 gap-6">
            <div className="w-full sm:w-[34%] flex flex-col gap-5">
                <CardLogo src={logoPreview} tone="light" />
                <div>
                    <h3 className="text-gray-900 font-extrabold text-2xl leading-tight break-words">
                        {productName || "Your Product Name"}
                    </h3>
                    {tagline && <p className="text-gray-500 text-[11px] mt-1 break-words">{tagline}</p>}
                    <div className="h-1 w-10 bg-orange-500 rounded-full mt-2.5" />
                </div>
                <div className="flex flex-col gap-3.5 mt-1">
                    {contactRows.map(({ Icon, value, placeholder }, i) => (
                        <div key={i} className="flex items-center gap-3">
                            <div className="h-7 w-7 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
                                <Icon size={12} className="text-white" />
                            </div>
                            <span className="text-gray-700 text-xs font-medium leading-snug break-words">
                                {value || placeholder}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="w-full sm:w-[66%]">
                <p className="text-orange-500 text-[13px] font-extrabold tracking-[0.15em] uppercase">
                    Feature Highlights
                </p>
                <div className="h-[3px] w-14 bg-orange-500 rounded-full mt-3 mb-5" />
                <div className="flex flex-col gap-3">
                    {features.length > 0 ? (
                        features.map((f, i) => (
                            <div key={i} className="flex items-start gap-3 border-b border-orange-100 pb-3 last:border-b-0">
                                <div className="h-10 w-10 rounded-full bg-orange-50 border-2 border-orange-500 flex items-center justify-center shrink-0">
                                    <Sparkles size={15} className="text-orange-500" />
                                </div>
                                <div className="min-w-0">
                                    <p className="text-gray-900 text-[13px] font-bold leading-snug">{f.title}</p>
                                    {f.description && (
                                        <p className="text-gray-500 text-[11px] leading-snug mt-0.5">{f.description}</p>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <p className="text-gray-400 text-xs">Add 3–4 feature highlights to see them here.</p>
                    )}
                </div>
            </div>
        </div>

        {bottomStatement && (
            <div
                className="px-6 py-3.5 text-center"
                style={{ background: "#f97316", clipPath: "polygon(0 0, 96% 0, 100% 100%, 0% 100%)" }}
            >
                <p className="text-white text-[13px] font-bold">{bottomStatement}</p>
            </div>
        )}
    </div>
);

// Registry the preview + theme picker both read from. `swatch` drives the
// little color chip shown on each picker button. "classic" is the default
// applied theme and stays untouched when swapping the others.
const CARD_THEMES = [
    { id: "classic", label: "Split Classic", Component: ClassicSplitTheme, swatch: "linear-gradient(90deg, #ffffff 50%, #0a0a0a 50%)" },
    { id: "blue", label: "Blue Gradient", Component: BlueSplitTheme, swatch: "linear-gradient(155deg, #3b82f6 0%, #1e3a8a 100%)" },
    { id: "purple", label: "Purple Timeline", Component: PurpleTimelineTheme, swatch: "radial-gradient(circle at 30% 30%, #7c3aed 0%, #1e0a3c 100%)" },
    { id: "nature", label: "Nature Green", Component: NatureGreenTheme, swatch: "linear-gradient(160deg, #eef4ea 0%, #4a7c59 100%)" },
    { id: "amber", label: "Orange Highlights", Component: OrangeHighlightTheme, swatch: "linear-gradient(160deg, #ffffff 0%, #f97316 100%)" },
];

// ---------- AI-generated dynamic theme renderer ----------
// Renders the exact same business data props as the five manual themes
// above (logoPreview, productName, tagline, contactRows, features,
// bottomStatement) — but every visual choice comes from a `theme` JSON
// object instead of being hardcoded per component. This is what the AI
// Theme Generator's output gets rendered through, and it's the only
// thing that ever changes when a new AI theme is applied: the data
// props are identical every time, so content can't drift.
const SHADOW_PRESETS = {
    none: "none",
    soft: "0 25px 60px -20px rgba(0,0,0,0.35)",
    medium: "0 30px 80px -20px rgba(0,0,0,0.5)",
    hard: "10px 10px 0 0 rgba(0,0,0,0.85)",
};

const DynamicThemeCard = ({ theme, logoPreview, productName, tagline, contactRows, features, bottomStatement }) => {
    const {
        background = "linear-gradient(135deg, #111111 0%, #1a1a1a 100%)",
        accent = "#f97316",
        text = "#ffffff",
        cardStyle = "solid", // "solid" | "glass" | "minimal"
        borderRadius = 20,
        shadow = "soft", // "none" | "soft" | "medium" | "hard"
        font = "inherit",
        layout = "split", // "split" | "stack"
        featureLayout = "grid", // "grid" | "list"
        iconStyle = "circle", // "circle" | "outline" | "square"
    } = theme || {};

    const isGlass = cardStyle === "glass";
    const isStack = layout === "stack";

    const leftPanelStyle = isGlass ? { background: "rgba(255,255,255,0.85)", backdropFilter: "blur(16px)" } : { background: "#ffffff" };
    const rightPanelStyle = { background, color: text, ...(isGlass ? { backdropFilter: "blur(16px)" } : {}) };

    const iconWrapClass =
        iconStyle === "outline" ? "rounded-full border-2 bg-transparent" : iconStyle === "square" ? "rounded-lg" : "rounded-full border-2";

    return (
        <div
            className={`flex ${isStack ? "flex-col" : "flex-col sm:flex-row"} overflow-hidden`}
            style={{ borderRadius, boxShadow: SHADOW_PRESETS[shadow] ?? SHADOW_PRESETS.soft, fontFamily: font }}
        >
            {/* Identity panel — always legible regardless of theme */}
            <div className={`w-full ${isStack ? "" : "sm:w-[38%]"} p-6 flex flex-col gap-5`} style={leftPanelStyle}>
                <CardLogo src={logoPreview} tone="light" />
                <div>
                    <h3 className="font-extrabold text-2xl leading-tight break-words text-gray-900">
                        {productName || "Your Product Name"}
                    </h3>
                    {tagline && <p className="text-gray-500 text-[11px] mt-1 break-words">{tagline}</p>}
                    <div className="h-1 w-10 rounded-full mt-2.5" style={{ background: accent }} />
                </div>
                <div className="flex flex-col gap-3.5 mt-1">
                    {contactRows.map(({ Icon, value, placeholder }, i) => (
                        <div key={i} className="flex items-center gap-3">
                            <div className="h-7 w-7 rounded-full flex items-center justify-center shrink-0" style={{ background: accent }}>
                                <Icon size={12} className="text-white" />
                            </div>
                            <span className="text-gray-800 text-xs font-medium leading-snug break-words">{value || placeholder}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Feature panel — background/accent/text/layout all driven by the theme JSON */}
            <div className={`relative w-full ${isStack ? "" : "sm:w-[62%]"} p-6 flex flex-col justify-between overflow-hidden`} style={rightPanelStyle}>
                <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full pointer-events-none" style={{ background: `${accent}22` }} />
                <div className="relative z-10">
                    <p className="text-[13px] font-extrabold tracking-[0.15em] uppercase" style={{ color: text }}>
                        {tagline || "Why Choose Us"}
                    </p>
                    <div className="h-[3px] w-16 rounded-full mt-3 mb-6" style={{ background: accent }} />

                    <div className={featureLayout === "list" ? "flex flex-col gap-3.5" : "grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-6"}>
                        {features.length > 0 ? (
                            features.map((f, i) => (
                                <div key={i} className="flex items-start gap-2.5">
                                    <div
                                        className={`h-9 w-9 flex items-center justify-center shrink-0 ${iconWrapClass}`}
                                        style={{
                                            borderColor: accent,
                                            background: iconStyle === "square" ? accent : `${accent}1a`,
                                            color: iconStyle === "square" ? "#ffffff" : accent,
                                        }}
                                    >
                                        <Sparkles size={14} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-[13px] font-bold leading-snug" style={{ color: text }}>
                                            {f.title}
                                        </p>
                                        {f.description && (
                                            <p className="text-[11px] leading-snug mt-0.5 opacity-70" style={{ color: text }}>
                                                {f.description}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-xs opacity-60 col-span-2" style={{ color: text }}>
                                Add 3–4 feature highlights to see them here.
                            </p>
                        )}
                    </div>
                </div>

                {bottomStatement && (
                    <div className="relative z-10 mt-6 bg-white rounded-xl px-5 py-3.5 text-center">
                        <p className="text-[13px] font-bold" style={{ color: accent }}>
                            {bottomStatement}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

// ---------- AI Theme Generator hook ----------
// Shared by the Feature Card and Flyer Generation modules — both hit
// the exact same /api/generate-theme endpoint with the exact same
// contract (a free-form prompt + a snapshot of the caller's form data
// for context only, never echoed back). Pulling this out once avoids
// re-implementing the prompt/loading/error/history state machine per
// module.
const useAiThemeGenerator = () => {
    const [aiPrompt, setAiPrompt] = useState("");
    const [aiThemeLoading, setAiThemeLoading] = useState(false);
    const [aiThemeError, setAiThemeError] = useState("");
    const [aiTheme, setAiTheme] = useState(null);
    const [themeHistory, setThemeHistory] = useState([]); // most-recent-first, capped

    const generate = async (contextData) => {
        const prompt = aiPrompt.trim();
        if (!prompt || aiThemeLoading) return;
        setAiThemeLoading(true);
        setAiThemeError("");
        try {
            const res = await fetch(AI_THEME_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt, data: contextData || {} }),
            });
            const resp = await res.json().catch(() => null);
            if (!res.ok || !resp?.theme) {
                throw new Error(resp?.detail || resp?.message || `Request failed (${res.status})`);
            }
            const newTheme = { ...resp.theme, id: `ai-${Date.now()}`, prompt };
            setAiTheme(newTheme);
            setThemeHistory((prev) => [newTheme, ...prev.filter((t) => t.id !== newTheme.id)].slice(0, 6));
        } catch (err) {
            setAiThemeError(
                `Couldn't generate a theme: ${err?.message || err}. Make sure the feature-card backend is running on ${FEATURE_CARD_API_BASE}.`
            );
        } finally {
            setAiThemeLoading(false);
        }
    };

    // "Reset to Default" — clears the AI theme so the caller falls back
    // to whichever manual theme/default it keeps around.
    const reset = () => {
        setAiTheme(null);
        setAiThemeError("");
    };

    return { aiPrompt, setAiPrompt, aiThemeLoading, aiThemeError, aiTheme, setAiTheme, themeHistory, generate, reset };
};

// ---------- Feature Card page ----------
// Collects everything needed to generate the card graphic (logo, product
// info, contact details, feature highlights, closing tagline) and shows
// a live preview alongside the form as it's filled in.
const FeatureCardView = () => {
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState("");
    const [form, setForm] = useState({
        productName: "",
        tagline: "",
        mobileNumber: "",
        email: "",
        website: "",
        address: "",
        bottomStatement: "",
    });
    const [features, setFeatures] = useState([emptyFeature(), emptyFeature(), emptyFeature()]);
    const [selectedThemeId, setSelectedThemeId] = useState(CARD_THEMES[0].id); // design only — never touches form data
    const [selectedFontId, setSelectedFontId] = useState(FONT_OPTIONS[0].id);
    const [customFontName, setCustomFontName] = useState("");
    useGoogleFonts([...FONT_OPTIONS.map((f) => f.google), customFontName.trim() ? customFontName.trim().replace(/\s+/g, "+") : null]);
    const selectedFontStack =
        selectedFontId === "other"
            ? (customFontName.trim() ? `'${customFontName.trim()}', sans-serif` : FONT_OPTIONS[0].stack)
            : FONT_OPTIONS.find((f) => f.id === selectedFontId)?.stack || FONT_OPTIONS[0].stack;
    const [genError, setGenError] = useState("");
    const [downloadingPreview, setDownloadingPreview] = useState(false);
    const [downloadFormat, setDownloadFormat] = useState(""); // which format is currently exporting, for the button label
    const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
    const previewRef = useRef(null);

    // Independent, measured-height scroll containers for the form and
    // the Live Preview — same pattern as Flyer Generation.
    const [formScrollRef, formMaxHeight] = useAvailableHeight(24);
    const [previewPanelScrollRef, previewPanelMaxHeight] = useAvailableHeight(24);

    // Prefill from the logged-in company's own profile — same idea as
    // Flyer Generation's AI Content Generator prefill. Runs once on
    // mount; never overwrites a field the person has already edited.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const [meRes, productsRes] = await Promise.allSettled([
                fetch(ME_ENDPOINT, { headers: authHeaders() }),
                fetch(PRODUCTS_ENDPOINT, { headers: authHeaders() }),
            ]);
            const me =
                meRes.status === "fulfilled" && meRes.value.ok ? await meRes.value.json().catch(() => null) : null;
            const productsData =
                productsRes.status === "fulfilled" && productsRes.value.ok ? await productsRes.value.json().catch(() => null) : null;
            const firstProduct = productsData?.data?.[0];
            if (cancelled || (!me && !firstProduct)) return;
            setForm((prev) => ({
                ...prev,
                productName: prev.productName || firstProduct?.product_name || "",
                website: prev.website || me?.website || "",
                email: prev.email || me?.email || "",
                mobileNumber: prev.mobileNumber || me?.contact_number || "",
                address: prev.address || me?.company_location || "",
            }));
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ---- AI Theme Generator state ----
    // `aiTheme` (when set) takes over the preview instead of the manual
    // CARD_THEMES pick — same data props, different visual layer. Picking
    // a manual theme again always clears it (see handleSelectManualTheme).
    const {
        aiPrompt, setAiPrompt, aiThemeLoading, aiThemeError, aiTheme, setAiTheme, themeHistory,
        generate: generateAiTheme, reset: handleResetTheme,
    } = useAiThemeGenerator();
    // Saved themes now live in growthos_backend, scoped to whichever
    // company is logged in — loaded fresh from there, never from
    // localStorage, so one company never sees another's saved themes.
    const [savedThemes, setSavedThemes] = useState([]);
    const [savedThemesLoading, setSavedThemesLoading] = useState(false);
    const [saveThemeStatus, setSaveThemeStatus] = useState(""); // "Theme saved" | "Already saved" | error text
    const [savingTheme, setSavingTheme] = useState(false);
    const isAiThemeActive = !!aiTheme;

    // Load this company's saved themes once on mount.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setSavedThemesLoading(true);
            try {
                const res = await fetch(SAVED_THEMES_ENDPOINT, { headers: authHeaders() });
                const resp = await res.json().catch(() => null);
                if (!cancelled && res.ok && Array.isArray(resp?.data)) {
                    setSavedThemes(resp.data);
                }
            } catch {
                // Backend not reachable — Saved Themes list just stays empty for now.
            } finally {
                if (!cancelled) setSavedThemesLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const setField = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

    const handleLogoChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setLogoFile(file);
        setLogoPreview(URL.createObjectURL(file));
    };

    const updateFeature = (index, key, value) => {
        setFeatures((prev) => prev.map((f, i) => (i === index ? { ...f, [key]: value } : f)));
    };

    const addFeature = () => {
        if (features.length >= MAX_FEATURES) return;
        setFeatures((prev) => [...prev, emptyFeature()]);
    };

    const removeFeature = (index) => {
        setFeatures((prev) => prev.filter((_, i) => i !== index));
    };

    // Picking a manual theme always drops back out of "AI theme active"
    // mode — the two are mutually exclusive in the preview.
    const handleSelectManualTheme = (id) => {
        setSelectedThemeId(id);
        setAiTheme(null);
    };

    // Sends the current prompt (+ a snapshot of the form data, for
    // context only — the backend contract explicitly never echoes or
    // alters that data) to the theme-generation endpoint, then applies
    // whatever theme JSON comes back to the live preview.
    const handleGenerateAiTheme = () => generateAiTheme(form);

    // Persists the current AI theme to growthos_backend, scoped to the
    // logged-in company (JWT sent via authHeaders()). The backend checks
    // by theme CONTENT (not by prompt wording) whether this company has
    // already saved this exact look — if so it returns already_saved:
    // true and nothing new is inserted, so we just show "Already saved"
    // instead of adding a duplicate row to the list.
    const handleSaveTheme = async () => {
        if (!aiTheme || savingTheme) return;
        setSavingTheme(true);
        setSaveThemeStatus("");
        try {
            const res = await fetch(SAVED_THEMES_ENDPOINT, {
                method: "POST",
                headers: authHeaders(),
                body: JSON.stringify({ theme: aiTheme, prompt: aiTheme.prompt || "" }),
            });
            const resp = await res.json().catch(() => null);
            if (!res.ok || !resp?.success) {
                throw new Error(resp?.detail || resp?.message || `Request failed (${res.status})`);
            }
            if (resp.already_saved) {
                setSaveThemeStatus("Already saved");
            } else {
                setSaveThemeStatus("Theme saved");
                if (resp.data) {
                    setSavedThemes((prev) => [resp.data, ...prev]);
                }
            }
        } catch (err) {
            setSaveThemeStatus(`Couldn't save theme: ${err?.message || err}`);
        } finally {
            setSavingTheme(false);
        }
    };

    // Data actually rendered in the preview — same for every theme.
    const filteredFeatures = features.filter((f) => f.title.trim());
    const contactRows = [
        { Icon: Phone, value: form.mobileNumber, placeholder: "+91 XXXXXXXXXX" },
        { Icon: Mail, value: form.email, placeholder: "you@company.com" },
        { Icon: Globe, value: form.website, placeholder: null },
        { Icon: MapPin, value: form.address, placeholder: null },
    ].filter((row) => row.value || row.placeholder);
    const ActiveTheme = CARD_THEMES.find((t) => t.id === selectedThemeId)?.Component || CARD_THEMES[0].Component;

    // Instant export of exactly what's in the preview panel — fully
    // client-side, no backend involved.
    // Uses html2canvas-pro (not plain html2canvas) because Tailwind's
    // generated CSS uses oklch()/lab() colors, which the original
    // html2canvas can't parse ("unsupported color function oklch").
    // PDF export wraps that same snapshot with jsPDF.
    // Install: npm install html2canvas-pro jspdf
    const handleDownloadPreview = async (fmt) => {
        if (!previewRef.current || downloadingPreview) return;
        setDownloadingPreview(true);
        setDownloadFormat(fmt);
        setDownloadMenuOpen(false);
        setGenError("");
        try {
            const { default: html2canvas } = await import("html2canvas-pro");
            const canvas = await html2canvas(previewRef.current, {
                backgroundColor: "#050505",
                scale: 2,
                useCORS: true,
            });
            const slug =
                form.productName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") ||
                "feature-card";

            if (fmt === "pdf") {
                const { jsPDF } = await import("jspdf");
                const imgData = canvas.toDataURL("image/png");
                const pdf = new jsPDF({
                    orientation: canvas.width >= canvas.height ? "landscape" : "portrait",
                    unit: "px",
                    format: [canvas.width, canvas.height],
                });
                pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
                pdf.save(`${slug}-feature-card.pdf`);
            } else {
                const link = document.createElement("a");
                link.download = `${slug}-feature-card.png`;
                link.href = canvas.toDataURL("image/png");
                link.click();
            }
        } catch (err) {
            console.error("Preview export failed:", err);
            setGenError(
                `Couldn't export the preview: ${err?.message || err}. Make sure \`npm install html2canvas-pro jspdf\` has been run and the dev server was restarted.`
            );
        } finally {
            setDownloadingPreview(false);
            setDownloadFormat("");
        }
    };

    return (
        <div className="mt-6 flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-6 pb-2">
            {/* ---- Form ---- */}
            <div ref={formScrollRef} className="space-y-5 lg:overflow-y-auto lg:pr-3" style={{ maxHeight: formMaxHeight ? `${formMaxHeight}px` : undefined }}>
                {genError && (
                    <div className="flex items-center gap-2.5 text-[15px] text-red-400 border border-red-500/20 bg-red-500/[0.06] rounded-2xl px-4 py-3.5">
                        <AlertCircle size={16} className="shrink-0" /> {genError}
                    </div>
                )}

                <SectionCard icon={ImageIcon} title="Brand & Identity" subtitle="Logo, name, and tagline">
                    <div className="flex items-center gap-4">
                        <div className="h-16 w-16 rounded-2xl border border-dashed border-orange-500/30 bg-white/[0.03] flex items-center justify-center overflow-hidden shrink-0">
                            {logoPreview ? (
                                <img
                                    src={logoPreview}
                                    alt="Logo preview"
                                    className="h-full w-full object-cover object-center"
                                />
                            ) : (
                                <ImageIcon size={20} className="text-gray-600" />
                            )}
                        </div>
                        <label className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-semibold rounded-xl px-4 py-2.5 cursor-pointer transition">
                            <Upload size={13} />
                            {logoFile ? "Change logo" : "Upload logo"}
                            <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                        </label>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Product / Company Name" required>
                            <input
                                className={inputClass}
                                placeholder="e.g. GrowthOS AI"
                                value={form.productName}
                                onChange={setField("productName")}
                            />
                        </Field>
                        <Field label="Tagline">
                            <input
                                className={inputClass}
                                placeholder="e.g. Smart. Simple. AI-Powered."
                                value={form.tagline}
                                onChange={setField("tagline")}
                            />
                        </Field>
                    </div>
                </SectionCard>

                <SectionCard icon={Phone} title="Contact Details" subtitle="Shown on the left panel of the card">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Mobile Number" required>
                            <IconInput
                                icon={Phone}
                                placeholder="+91 XXXXXXXXXX"
                                value={form.mobileNumber}
                                onChange={setField("mobileNumber")}
                            />
                        </Field>
                        <Field label="Email" required>
                            <IconInput
                                icon={Mail}
                                type="email"
                                placeholder="you@company.com"
                                value={form.email}
                                onChange={setField("email")}
                            />
                        </Field>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="Website">
                            <IconInput
                                icon={Globe}
                                placeholder="https://yourproduct.com"
                                value={form.website}
                                onChange={setField("website")}
                            />
                        </Field>
                        <Field label="Address">
                            <IconInput
                                icon={MapPin}
                                placeholder="City, State"
                                value={form.address}
                                onChange={setField("address")}
                            />
                        </Field>
                    </div>
                </SectionCard>

                <SectionCard
                    icon={Sparkles}
                    title="Feature Highlights"
                    subtitle={`${features.filter((f) => f.title.trim()).length} of ${MAX_FEATURES} added — shown as a grid on the card`}
                    action={
                        features.length < MAX_FEATURES && (
                            <button
                                type="button"
                                onClick={addFeature}
                                className="text-sm font-semibold text-orange-400 hover:text-orange-300 transition shrink-0"
                            >
                                + Add feature
                            </button>
                        )
                    }
                >
                    {features.map((f, i) => (
                        <div
                            key={i}
                            className="group relative rounded-xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/5 p-4 pl-12 transition"
                        >
                            <div className="absolute left-4 top-4 h-6 w-6 rounded-full bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-xs font-bold text-orange-400">
                                {i + 1}
                            </div>
                            <div className="space-y-2">
                                <input
                                    className={inputClass}
                                    placeholder={`Feature ${i + 1} title (e.g. AI-Powered Learning)`}
                                    value={f.title}
                                    onChange={(e) => updateFeature(i, "title", e.target.value)}
                                />
                                <input
                                    className={inputClass}
                                    placeholder="Short description"
                                    value={f.description}
                                    onChange={(e) => updateFeature(i, "description", e.target.value)}
                                />
                            </div>
                            {features.length > 1 && (
                                <button
                                    type="button"
                                    onClick={() => removeFeature(i)}
                                    className="absolute right-3.5 top-3.5 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                                    aria-label="Remove feature"
                                >
                                    <X size={15} />
                                </button>
                            )}
                        </div>
                    ))}
                </SectionCard>

                <SectionCard icon={FileText} title="Closing Statement" subtitle="Shown in the banner at the bottom">
                    <input
                        className={inputClass}
                        placeholder="e.g. Empowering Institutions. Enabling Futures."
                        value={form.bottomStatement}
                        onChange={setField("bottomStatement")}
                    />
                </SectionCard>
            </div>

            {/* ---- Live preview ---- */}
            <div ref={previewPanelScrollRef} className="space-y-3 lg:overflow-y-auto lg:pr-3" style={{ maxHeight: previewPanelMaxHeight ? `${previewPanelMaxHeight}px` : undefined }}>
                <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-semibold text-gray-400 tracking-wide uppercase">Preview</p>

                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setDownloadMenuOpen((v) => !v)}
                            disabled={downloadingPreview}
                            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-[15px] font-semibold rounded-xl px-5 py-3 transition"
                        >
                            {downloadingPreview ? (
                                <Loader2 size={16} className="animate-spin" />
                            ) : (
                                <Download size={16} />
                            )}
                            {downloadingPreview ? `Exporting ${downloadFormat.toUpperCase()}...` : "Download"}
                            {!downloadingPreview && <ChevronDown size={16} />}
                        </button>

                        {downloadMenuOpen && !downloadingPreview && (
                            <>
                                {/* Click-outside catcher */}
                                <div className="fixed inset-0 z-10" onClick={() => setDownloadMenuOpen(false)} />
                                <div className="absolute right-0 mt-2 w-40 bg-black border border-orange-600/30 rounded-xl overflow-hidden shadow-xl z-20">
                                    <button
                                        type="button"
                                        onClick={() => handleDownloadPreview("png")}
                                        className="w-full text-left px-4 py-3 text-[15px] font-semibold text-white hover:bg-orange-500/10 transition"
                                    >
                                        PNG Image
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDownloadPreview("pdf")}
                                        className="w-full text-left px-4 py-3 text-[15px] font-semibold text-white hover:bg-orange-500/10 transition border-t border-orange-600/10"
                                    >
                                        PDF Document
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="rounded-2xl border border-orange-600/20 bg-black p-2">
                    {/* This exact node is what gets exported as the PNG/PDF — export
                        logic below is generic (just screenshots this ref), so it
                        already works for AI themes with no changes needed. */}
                    <div ref={previewRef} className="rounded-xl overflow-hidden" style={{ fontFamily: selectedFontStack }}>
                        <AnimatePresence mode="wait">
                            {isAiThemeActive ? (
                                <motion.div
                                    key={aiTheme.id}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    transition={{ duration: 0.35, ease: "easeOut" }}
                                >
                                    <DynamicThemeCard
                                        theme={{ ...aiTheme, font: selectedFontStack }}
                                        logoPreview={logoPreview}
                                        productName={form.productName}
                                        tagline={form.tagline}
                                        contactRows={contactRows}
                                        features={filteredFeatures}
                                        bottomStatement={form.bottomStatement}
                                    />
                                </motion.div>
                            ) : (
                                <motion.div
                                    key={selectedThemeId}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -8 }}
                                    transition={{ duration: 0.35, ease: "easeOut" }}
                                >
                                    <ActiveTheme
                                        logoPreview={logoPreview}
                                        productName={form.productName}
                                        tagline={form.tagline}
                                        contactRows={contactRows}
                                        features={filteredFeatures}
                                        bottomStatement={form.bottomStatement}
                                    />
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* ---- Design / theme picker — changes layout only, never the form data ---- */}
                <div className="mt-6">
                    <div className="flex items-center gap-2 mb-3">
                        <Palette size={14} className="text-orange-500" />
                        <p className="text-sm font-semibold text-gray-400 tracking-wide uppercase">
                            Choose a design
                        </p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {CARD_THEMES.map((t) => {
                            const isActive = !isAiThemeActive && selectedThemeId === t.id;
                            return (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => handleSelectManualTheme(t.id)}
                                    className={`group relative text-left rounded-xl border p-3.5 transition ${
                                        isActive
                                            ? "border-orange-500 bg-orange-500/[0.06]"
                                            : "border-white/10 bg-white/[0.02] hover:border-orange-500/40 hover:bg-white/[0.04]"
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div
                                            className="h-8 w-8 rounded-lg border border-white/15 shrink-0"
                                            style={{ background: t.swatch }}
                                        />
                                        <div className="min-w-0">
                                            <p className="text-white text-sm font-semibold leading-tight truncate">
                                                {t.label}
                                            </p>
                                            <p className="text-gray-500 text-xs mt-0.5">
                                                {isActive ? "Applied to preview" : "Tap to preview"}
                                            </p>
                                        </div>
                                        {isActive && (
                                            <Check size={14} className="text-orange-500 ml-auto shrink-0" />
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* ---- Font Style picker ---- */}
                <div className="mt-6">
                    <div className="flex items-center gap-2 mb-3">
                        <FileText size={14} className="text-orange-500" />
                        <p className="text-sm font-semibold text-gray-400 tracking-wide uppercase">
                            Font Style
                        </p>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        {FONT_OPTIONS.map((f) => {
                            const isActive = selectedFontId === f.id;
                            return (
                                <button
                                    key={f.id}
                                    type="button"
                                    onClick={() => setSelectedFontId(f.id)}
                                    className={`text-left rounded-lg border px-3 py-2 transition ${
                                        isActive
                                            ? "border-orange-500/60 bg-orange-500/[0.08]"
                                            : "border-white/10 bg-white/[0.02] hover:border-orange-500/40"
                                    }`}
                                    style={f.stack ? { fontFamily: f.stack } : undefined}
                                >
                                    <span className={`text-[13px] ${isActive ? "text-orange-300" : "text-gray-200"}`}>{f.label}</span>
                                </button>
                            );
                        })}
                    </div>
                    {selectedFontId === "other" && (
                        <input
                            className={`${inputClass} mt-2.5`}
                            placeholder="Type any font name, e.g. Nunito, Georgia, Roboto Slab..."
                            value={customFontName}
                            onChange={(e) => setCustomFontName(e.target.value)}
                            style={{ fontFamily: selectedFontStack }}
                        />
                    )}
                </div>

                {/* ---- AI Theme Generator ---- */}
                <div className="mt-6 rounded-2xl border border-white/5 bg-white/[0.02] p-5">
                    <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center shrink-0">
                            <Wand2 size={15} className="text-orange-500" />
                        </div>
                        <div>
                            <h4 className="text-white text-[15px] font-semibold leading-tight">AI Theme Generator</h4>
                            <p className="text-gray-500 text-sm mt-0.5">
                                Describe a look and apply it to the preview instantly — your content never changes.
                            </p>
                        </div>
                    </div>

                    <textarea
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        rows={3}
                        placeholder={"Describe your design...\n\nExample: Create a premium Apple-style card with glassmorphism, rounded corners, blue gradients and elegant typography."}
                        className={`${inputClass} mt-4 resize-none`}
                    />

                    {aiThemeError && (
                        <div className="mt-3 flex items-center gap-2 text-sm text-red-400 border border-red-500/20 bg-red-500/[0.06] rounded-xl px-3.5 py-2.5">
                            <AlertCircle size={13} className="shrink-0" /> {aiThemeError}
                        </div>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-2.5">
                        <button
                            type="button"
                            onClick={handleGenerateAiTheme}
                            disabled={!aiPrompt.trim() || aiThemeLoading}
                            className="inline-flex items-center gap-2 bg-orange-500/15 hover:bg-orange-500/25 backdrop-blur-sm border border-orange-400/30 disabled:opacity-40 disabled:cursor-not-allowed text-orange-200 text-xs font-semibold rounded-lg px-3.5 py-2 transition"
                        >
                            {aiThemeLoading ? <Loader2 size={13} className="animate-spin" /> : <Wand2 size={13} />}
                            {aiThemeLoading ? "Generating..." : "Generate Theme"}
                        </button>

                        {isAiThemeActive && (
                            <>
                                <button
                                    type="button"
                                    onClick={handleSaveTheme}
                                    disabled={savingTheme}
                                    className="inline-flex items-center gap-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed border border-white/10 text-white text-sm font-semibold rounded-xl px-3.5 py-2.5 transition"
                                >
                                    {savingTheme ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                                    {savingTheme ? "Saving..." : "Save Theme"}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleResetTheme}
                                    className="inline-flex items-center gap-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-sm font-semibold rounded-xl px-3.5 py-2.5 transition"
                                >
                                    <RotateCcw size={13} /> Reset to Default
                                </button>
                            </>
                        )}
                    </div>

                    {isAiThemeActive && (
                        <div className="mt-4 flex items-center gap-2 text-xs text-orange-400 bg-orange-500/[0.06] border border-orange-500/20 rounded-lg px-3 py-2">
                            <Check size={13} className="shrink-0" />
                            AI theme "{aiTheme.themeName || "Custom"}" is applied to the preview.
                        </div>
                    )}

                    {saveThemeStatus && (
                        <div
                            className={`mt-2 flex items-center gap-2 text-xs rounded-lg px-3 py-2 border ${
                                saveThemeStatus.startsWith("Couldn't")
                                    ? "text-red-400 bg-red-500/[0.06] border-red-500/20"
                                    : "text-emerald-400 bg-emerald-500/[0.06] border-emerald-500/20"
                            }`}
                        >
                            {saveThemeStatus.startsWith("Couldn't") ? (
                                <AlertCircle size={13} className="shrink-0" />
                            ) : (
                                <Check size={13} className="shrink-0" />
                            )}
                            {saveThemeStatus}
                        </div>
                    )}

                    {themeHistory.length > 0 && (
                        <div className="mt-5">
                            <div className="flex items-center gap-1.5 mb-2">
                                <History size={12} className="text-gray-500" />
                                <p className="text-[11px] font-semibold text-gray-500 tracking-wide uppercase">
                                    Theme History
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {themeHistory.map((t, i) => (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => setAiTheme(t)}
                                        title={t.prompt}
                                        className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 transition ${
                                            aiTheme?.id === t.id
                                                ? "border-orange-500 bg-orange-500/[0.08]"
                                                : "border-white/10 bg-white/[0.02] hover:border-orange-500/30"
                                        }`}
                                    >
                                        <span
                                            className="h-4 w-4 rounded-full border border-white/20 shrink-0"
                                            style={{ background: t.background }}
                                        />
                                        <span className="text-xs text-gray-300 font-medium">
                                            Theme {themeHistory.length - i}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {savedThemesLoading && (
                        <div className="mt-5 flex items-center gap-2 text-xs text-gray-500">
                            <Loader2 size={12} className="animate-spin" /> Loading saved themes...
                        </div>
                    )}

                    {!savedThemesLoading && savedThemes.length > 0 && (
                        <div className="mt-5">
                            <div className="flex items-center gap-1.5 mb-2">
                                <Save size={12} className="text-gray-500" />
                                <p className="text-[11px] font-semibold text-gray-500 tracking-wide uppercase">
                                    Saved Themes
                                </p>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                {savedThemes.map((entry) => (
                                    <button
                                        key={entry.id}
                                        type="button"
                                        onClick={() => setAiTheme(entry.theme)}
                                        className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/[0.02] hover:border-orange-500/30 px-3 py-2 text-left transition"
                                    >
                                        <span
                                            className="h-5 w-5 rounded-full border border-white/20 shrink-0"
                                            style={{ background: entry.theme.background }}
                                        />
                                        <span className="text-xs text-gray-300 truncate flex-1">
                                            {entry.theme.themeName || entry.prompt}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ---------- Flyer Generation page ----------
// Mirrors the Feature Card module's shape (form on the left, live preview
// on the right, AI Theme Generator, a Download button) but for a full
// multi-section, multi-page, print-ready A4 flyer. Reuses every shared
// primitive already defined above (Field, inputClass, IconInput,
// SectionCard, CardLogo, useAiThemeGenerator, authHeaders) instead of
// duplicating them.

const FLYER_MAX_ITEMS = 8;
const MAX_SCREENSHOTS = 8;
const MAX_TESTIMONIALS = 6;
const MAX_PRICING_PLANS = 4;

const FLYER_LAYOUTS = [
    { id: "onePage", label: "One Page", icon: FileText, desc: "Always exactly one A4 page — content auto-fits, nothing spills or gets cut." },
    { id: "twoPage", label: "Two Page", icon: Columns, desc: "Cover page + one content page — always exactly two A4 pages." },
];

// Left-nav tabs for the detailed content form — clicking one opens only
// that section's fields on the right, instead of every section stacked
// and scrolled through at once.
const FLYER_FORM_TABS = [
    { id: "brand", label: "Brand Information", subtitle: "Your company and brand details", icon: ImageIcon },
    { id: "product", label: "Product Details", subtitle: "What you're showcasing", icon: Sparkles },
    { id: "problem", label: "Problem & Solution", subtitle: "Why customers need this", icon: FileText },
    { id: "features", label: "Features", subtitle: "Highlight up to 8 features", icon: Sparkles },
    { id: "benefits", label: "Benefits", subtitle: "The outcomes customers get", icon: Check },
    { id: "why", label: "Why Choose Us", subtitle: "What sets you apart", icon: ArrowUpRight },
    { id: "media", label: "Media & Screenshots", subtitle: "Upload up to 8 product images", icon: ImagePlus },
    { id: "pricing", label: "Pricing Plans", subtitle: "Optional — leave off to skip this page", icon: DollarSign },
    { id: "testimonials", label: "Testimonials", subtitle: "Social proof from real customers", icon: Quote },
    { id: "contact", label: "Contact Information", subtitle: "How prospects reach you", icon: Phone },
    { id: "cta", label: "CTA Section", subtitle: "What should the reader do next?", icon: ArrowUpRight },
    { id: "theme", label: "Theme", subtitle: "Colors and AI styling", icon: Palette },
];

// Visual template for the generated flyer content itself (separate
// from the AI Theme Generator's color palette). "classic" is the
// original design and stays the default; "modern" is the new
// icon-badge / hero-banner look. Sent to the backend as `template` and
// used locally to switch which preview renderer runs.
const FLYER_TEMPLATES = [
    { id: "classic", label: "Classic", desc: "The original clean, section-by-section layout." },
    { id: "modern", label: "Modern", desc: "Hero banner, icon-badge feature cards, icon contact row." },
];

// The backend (feature_card_generator.py) still only knows the original
// five layout ids. "twoPage" maps onto its "companyProfile" engine with
// page_count=2 (cover + exactly one content page), which produces the
// same result the simplified "Two Page" preview renders locally.
const BACKEND_LAYOUT_MAP = { onePage: "onePage", twoPage: "companyProfile" };

// Sensible look before any AI theme is generated — same shape as the
// Feature Card's ThemeJSON contract, just flyer-appropriate defaults.
const DEFAULT_FLYER_THEME = {
    themeName: "Default",
    background: "linear-gradient(135deg, #111111 0%, #1a1a1a 100%)",
    accent: "#f97316",
    text: "#ffffff",
    font: "Inter, sans-serif",
    borderRadius: 16,
};

const emptyPricingPlan = () => ({ name: "", price: "", period: "", featuresText: "", highlighted: false });
const emptyTestimonial = () => ({ quote: "", author: "", role: "" });

// Converts a File to a base64 data URL — needed (rather than
// URL.createObjectURL, which only works for local <img> previews) because
// every image in a flyer has to travel to the backend as JSON for the
// print-ready PDF render.
const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

// ---- Generic {title, description} list editor ----
// Reused for Feature List, Benefits, and Why Choose Us — three sections
// that all share the exact same item shape — instead of writing three
// near-identical editors.
const updateListItem = (setter) => (index, key, value) =>
    setter((prev) => prev.map((item, i) => (i === index ? { ...item, [key]: value } : item)));
const addListItem = (setter, max, factory) => () =>
    setter((prev) => (prev.length >= max ? prev : [...prev, factory()]));
const removeListItem = (setter) => (index) => setter((prev) => prev.filter((_, i) => i !== index));

const TitleDescListEditor = ({ items, onUpdate, onAdd, onRemove, max, itemLabel }) => (
    <div className="space-y-3">
        {items.map((item, i) => (
            <div key={i} className="flex gap-2 items-start bg-white/[0.02] border border-white/5 rounded-xl p-3">
                <div className="flex-1 space-y-2">
                    <input
                        className={inputClass}
                        placeholder={`${itemLabel} title`}
                        value={item.title}
                        onChange={(e) => onUpdate(i, "title", e.target.value)}
                    />
                    <input
                        className={inputClass}
                        placeholder="Short description"
                        value={item.description}
                        onChange={(e) => onUpdate(i, "description", e.target.value)}
                    />
                </div>
                <button
                    type="button"
                    onClick={() => onRemove(i)}
                    className="mt-1 h-8 w-8 flex items-center justify-center rounded-lg border border-white/10 text-gray-500 hover:text-red-400 hover:border-red-500/30 transition shrink-0"
                >
                    <Trash2 size={14} />
                </button>
            </div>
        ))}
        {items.length < max && (
            <button
                type="button"
                onClick={onAdd}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-400 hover:text-orange-300 transition"
            >
                <Plus size={14} /> Add {itemLabel.toLowerCase()}
            </button>
        )}
    </div>
);

// ---- Multi-image uploader (Screenshots) ----
const ScreenshotUploader = ({ screenshots, onAddFiles, onRemove, onCaptionChange, max }) => (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
        {screenshots.map((s, i) => (
            <div key={i} className="relative group rounded-xl overflow-hidden border border-white/10 bg-white/[0.02]">
                <img src={s.dataUrl} alt="" className="h-20 w-full object-cover" />
                <button
                    type="button"
                    onClick={() => onRemove(i)}
                    className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition"
                >
                    <X size={12} />
                </button>
                <input
                    value={s.caption}
                    onChange={(e) => onCaptionChange(i, e.target.value)}
                    placeholder="Caption"
                    className="w-full bg-black/40 text-white text-[10px] px-2 py-1 outline-none placeholder:text-gray-500"
                />
            </div>
        ))}
        {screenshots.length < max && (
            <label className="h-full min-h-[72px] rounded-xl border border-dashed border-orange-500/30 flex flex-col items-center justify-center gap-1 cursor-pointer text-gray-500 hover:text-orange-400 hover:border-orange-400/50 transition">
                <ImagePlus size={16} />
                <span className="text-[10px] font-medium">Add images</span>
                <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => onAddFiles(e.target.files)}
                />
            </label>
        )}
    </div>
);

// ---- Pricing plans editor (optional section) ----
const PricingPlansEditor = ({ plans, onUpdate, onAdd, onRemove, max }) => (
    <div className="space-y-3">
        {plans.map((plan, i) => (
            <div key={i} className="bg-white/[0.02] border border-white/5 rounded-xl p-3 space-y-2">
                <div className="flex gap-2">
                    <input className={inputClass} placeholder="Plan name" value={plan.name} onChange={(e) => onUpdate(i, "name", e.target.value)} />
                    <input className={inputClass} placeholder="Price (e.g. $49)" value={plan.price} onChange={(e) => onUpdate(i, "price", e.target.value)} />
                    <input className={inputClass} placeholder="/ month" value={plan.period} onChange={(e) => onUpdate(i, "period", e.target.value)} />
                </div>
                <input
                    className={inputClass}
                    placeholder="Plan features, comma separated"
                    value={plan.featuresText}
                    onChange={(e) => onUpdate(i, "featuresText", e.target.value)}
                />
                <div className="flex items-center justify-between">
                    <label className="inline-flex items-center gap-2 text-xs text-gray-400">
                        <input type="checkbox" checked={plan.highlighted} onChange={(e) => onUpdate(i, "highlighted", e.target.checked)} />
                        Highlight as most popular
                    </label>
                    <button type="button" onClick={() => onRemove(i)} className="text-gray-500 hover:text-red-400 transition">
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
        ))}
        {plans.length < max && (
            <button type="button" onClick={onAdd} className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-400 hover:text-orange-300 transition">
                <Plus size={14} /> Add pricing plan
            </button>
        )}
    </div>
);

// ---- Testimonials editor ----
const TestimonialsEditor = ({ items, onUpdate, onAdd, onRemove, max }) => (
    <div className="space-y-3">
        {items.map((t, i) => (
            <div key={i} className="bg-white/[0.02] border border-white/5 rounded-xl p-3 space-y-2">
                <textarea
                    className={`${inputClass} resize-none`}
                    rows={2}
                    placeholder="Customer quote"
                    value={t.quote}
                    onChange={(e) => onUpdate(i, "quote", e.target.value)}
                />
                <div className="flex gap-2">
                    <input className={inputClass} placeholder="Author name" value={t.author} onChange={(e) => onUpdate(i, "author", e.target.value)} />
                    <input className={inputClass} placeholder="Role / company" value={t.role} onChange={(e) => onUpdate(i, "role", e.target.value)} />
                    <button type="button" onClick={() => onRemove(i)} className="shrink-0 h-9 w-9 flex items-center justify-center rounded-lg border border-white/10 text-gray-500 hover:text-red-400 hover:border-red-500/30 transition">
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>
        ))}
        {items.length < max && (
            <button type="button" onClick={onAdd} className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-400 hover:text-orange-300 transition">
                <Plus size={14} /> Add testimonial
            </button>
        )}
    </div>
);

// ==========================================================
// FLYER LAYOUT RENDERING ENGINES
// Each layout has its own independent rendering engine.
// No shared "one size fits all" logic — every engine handles
// pagination, spacing, and content priority independently.
// ==========================================================

// ==========================================================
// FLYER LAYOUT RENDERING ENGINES
// ==========================================================

const PX_PER_MM = 2.6;
const mm = (v) => `${(v * PX_PER_MM).toFixed(2)}px`;
const A4 = { w: 210, h: 297 };
const PAGE_MARGIN = { y: 16, x: 14 };

const INNER_H_PX = (A4.h - PAGE_MARGIN.y * 2) * PX_PER_MM; // ~689px portrait
const INNER_W_PX = (A4.w - PAGE_MARGIN.x * 2) * PX_PER_MM; // ~473px portrait
const INNER_H_LANDSCAPE_PX = (A4.w - PAGE_MARGIN.y * 2) * PX_PER_MM; // ~462px landscape
const INNER_W_LANDSCAPE_PX = (A4.h - PAGE_MARGIN.x * 2) * PX_PER_MM; // ~698px landscape

/* ---------- A4 Page Shell ---------- */
const A4Page = ({ landscape = false, dense = false, accent = "#f97316", footer = "", fullBleed = false, background = "#ffffff", topBleed = null, bottomBleed = null, children, className = "", style = {} }) => {
    const w = landscape ? A4.h : A4.w;
    const h = landscape ? A4.w : A4.h;
    const pad = fullBleed ? "0" : `${mm(PAGE_MARGIN.y)} ${mm(PAGE_MARGIN.x)}`;
    return (
        <div className="flyer-page-frame">
            <div
                className={`flyer-page ${className}`}
                data-landscape={landscape ? "true" : "false"}
                style={{
                    width: mm(w),
                    minHeight: mm(h),
                    padding: 0,
                    background: background || "#ffffff",
                    ...style,
                }}
            >
                {/* True edge-to-edge slots — direct children of the page
                    itself, outside the padded content area, so they span
                    the full page width/reach the true top or bottom edge
                    with no negative margins needed. */}
                {topBleed}
                <div className={`flyer-page-inner${dense ? " flyer-page-dense" : ""}`} style={{ padding: pad }}>{children}</div>
                {bottomBleed}
                {footer && !fullBleed && (
                    <div className="flyer-page-footer" style={{ borderTopColor: `${accent}33`, padding: `0 ${mm(PAGE_MARGIN.x)} ${mm(PAGE_MARGIN.y)}` }}>
                        <span>{footer}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

/* ---------- Content Analysis ---------- */
const getFilteredData = (raw) => {
    const features = (raw.features || []).filter((f) => f.title.trim());
    const benefits = (raw.benefits || []).filter((f) => f.title.trim());
    const why = (raw.whyChooseUs || []).filter((f) => f.title.trim());
    const testimonials = (raw.testimonials || []).filter((t) => t.quote.trim());
    const plans = (raw.pricingPlans || []).filter((p) => p.name.trim());
    const screenshots = (raw.screenshots || []).slice(0, 8);
    const hasContact = raw.contact && (raw.contact.phone || raw.contact.email || raw.contact.website || raw.contact.address);
    const hasCta = raw.cta && (raw.cta.heading || raw.cta.subtext);
    return { features, benefits, why, testimonials, plans, screenshots, hasContact, hasCta };
};

/* ---------- Height Estimator (virtual page-packing) ---------- */
// Estimates how many pixels a section will consume when rendered so we
// can distribute across pages before React paints anything.
const estimateTextLines = (text, charsPerLine) => Math.max(1, Math.ceil((text || "").length / Math.max(1, charsPerLine)));
const est = {
    header: (dense) => (dense ? 65 : 85),
    // Compact hero banner (company + tagline + product badge) that now
    // sits at the top of content page 1 instead of eating a whole page.
    coverCompact: (dense) => (dense ? 92 : 112),
    heading: (dense) => (dense ? 18 : 22),
    overview: (text, dense) => {
        const lines = estimateTextLines(text, dense ? 100 : 80);
        return 18 + lines * (dense ? 14 : 17);
    },
    problemSolution: (p, s, dense) => {
        const lp = estimateTextLines(p, dense ? 100 : 80);
        const ls = estimateTextLines(s, dense ? 100 : 80);
        return 18 + lp * (dense ? 14 : 17) + (s ? 8 : 0) + ls * (dense ? 14 : 17);
    },
    gridSection: (items, dense) => {
        if (!items || !items.length) return 0;
        const cols = 2;
        const rows = Math.ceil(items.length / cols);
        const charsPerLine = dense ? 30 : 34; // approx chars that fit one column-width line
        const padding = dense ? 20 : 22; // box p-2.5 top+bottom
        const titleH = dense ? 14 : 15;
        const descLineH = dense ? 12 : 13;
        let total = 0;
        for (let r = 0; r < rows; r++) {
            const rowItems = items.slice(r * cols, r * cols + cols);
            const rowH = Math.max(...rowItems.map((it) => {
                const descLines = it.description ? estimateTextLines(it.description, charsPerLine) : 0;
                return padding + titleH + (descLines ? 2 + descLines * descLineH : 0);
            }));
            total += rowH;
        }
        // small safety buffer — better to slightly under-fill a page than
        // clip a box's bottom edge because the estimate ran a few px short.
        const buffer = Math.ceil(total * 0.08);
        return 18 + total + buffer + (rows - 1) * (dense ? 6 : 10);
    },
    screenshots: (count, dense) => {
        if (!count) return 0;
        const cols = dense ? 3 : 2;
        const rows = Math.ceil(count / cols);
        const imgH = dense ? 52 : 78;
        return 18 + rows * imgH + (rows - 1) * (dense ? 6 : 10);
    },
    pricing: (count, dense) => {
        if (!count) return 0;
        const planH = dense ? 72 : 96;
        return 18 + count * planH + (count - 1) * (dense ? 6 : 10);
    },
    testimonials: (count, dense) => {
        if (!count) return 0;
        const itemH = dense ? 44 : 60;
        return 18 + count * itemH + (count - 1) * (dense ? 6 : 10);
    },
    contact: (dense) => (dense ? 58 : 76),
    cta: (dense) => (dense ? 78 : 108),
    gap: (dense) => (dense ? 10 : 16),
};

const buildSectionMetas = (data, filtered) => {
    const dense = false;
    const list = [];
    const push = (id, render, height, priority = 5) => list.push({ id, render, height: Math.round(height), priority });

    if (data.product?.productOverview?.trim()) {
        push("overview", "overview", est.overview(data.product.productOverview, dense) + est.gap(dense));
    }
    if (data.problemStatement?.trim() || data.solutionStatement?.trim()) {
        push("problemSolution", "problemSolution", est.problemSolution(data.problemStatement, data.solutionStatement, dense) + est.gap(dense));
    }
    if (filtered.features.length) {
        push("features", "features", est.gridSection(filtered.features, dense) + est.gap(dense), 4);
    }
    if (filtered.benefits.length) {
        push("benefits", "benefits", est.gridSection(filtered.benefits, dense) + est.gap(dense), 4);
    }
    if (filtered.why.length) {
        push("whyChooseUs", "whyChooseUs", est.gridSection(filtered.why, dense) + est.gap(dense), 4);
    }
    if (filtered.screenshots.length) {
        push("screenshots", "screenshots", est.screenshots(filtered.screenshots.length, dense) + est.gap(dense), 3);
    }
    // ── GROUPED: pricing + testimonials never split across pages ──
    const pricingH = (data.pricingEnabled && filtered.plans.length) ? est.pricing(filtered.plans.length, dense) + est.gap(dense) : 0;
    const testimonialsH = filtered.testimonials.length ? est.testimonials(filtered.testimonials.length, dense) + est.gap(dense) : 0;
    if (pricingH && testimonialsH) {
        push("pricingTestimonials", "pricingTestimonials", pricingH + testimonialsH, 3);
    } else if (pricingH) {
        push("pricing", "pricing", pricingH, 3);
    } else if (testimonialsH) {
        push("testimonials", "testimonials", testimonialsH, 3);
    }
    // contact & cta are handled separately as footer on the last page
    return list;
};

/* ---------- Smart Page Packer ---------- */
// Packs sections into pages. Guarantees:
//   • Last page always reserved for footer (contact + cta)
//   • No blank pages
//   • No overflow
//   • Screenshots never split (it's one section)
//   • Visually balanced via post-processing
const packPages = (sections, pageHeight, footerHeight, targetContentPages) => {
    const footerReserved = footerHeight + est.gap(false);
    const lastPageHeight = pageHeight - footerReserved;

    // 1. Greedy fill pages 0..N-2 with full height, last page with reduced height
    const pages = [];
    let currentPage = [];
    let currentH = 0;
    const maxPages = Math.max(targetContentPages, 1);

    for (let i = 0; i < sections.length; i++) {
        const sec = sections[i];
        const isLastPage = pages.length === maxPages - 1;
        const limit = isLastPage ? lastPageHeight : pageHeight;

        if (currentH + sec.height <= limit || currentPage.length === 0) {
            currentPage.push(sec);
            currentH += sec.height;
        } else {
            pages.push(currentPage);
            currentPage = [sec];
            currentH = sec.height;
        }
    }
    if (currentPage.length) pages.push(currentPage);

    // 2. Ensure we have at least targetContentPages (pad empty if needed, then backfill)
    while (pages.length < targetContentPages) pages.push([]);
    // But never leave empty pages at the end before the footer page
    // Instead, redistribute from prior pages
    for (let i = pages.length - 1; i >= 0; i--) {
        if (pages[i].length === 0 && i > 0) {
            // steal last item from previous page
            const donor = pages[i - 1];
            if (donor.length > 1) {
                const moved = donor.pop();
                pages[i].push(moved);
            } else if (donor.length === 1 && i >= 2 && pages[i - 2].length > 1) {
                // cascade
                const moved = pages[i - 2].pop();
                pages[i - 1].push(moved);
            }
        }
    }
    // Remove trailing empties
    while (pages.length > 1 && pages[pages.length - 1].length === 0) pages.pop();

    // 3. Balance: if any page is < 40% full and neighbor can absorb, move items
    const avgFill = pages.reduce((s, p) => s + p.reduce((t, sec) => t + sec.height, 0), 0) / Math.max(1, pages.length);
    for (let i = 0; i < pages.length - 1; i++) {
        const pageH = pages[i].reduce((s, sec) => s + sec.height, 0);
        const nextH = pages[i + 1].reduce((s, sec) => s + sec.height, 0);
        if (pageH < avgFill * 0.45 && pages[i + 1].length > 1) {
            const moved = pages[i + 1].shift();
            pages[i].push(moved);
        } else if (nextH < avgFill * 0.45 && pages[i].length > 1) {
            const moved = pages[i].pop();
            pages[i + 1].unshift(moved);
        }
    }

    // 4. Final safety: if last page content + footer > pageHeight, steal from last page to previous
    const lastContentH = pages[pages.length - 1].reduce((s, sec) => s + sec.height, 0);
    if (lastContentH > lastPageHeight) {
        let overflow = lastContentH - lastPageHeight;
        while (overflow > 0 && pages[pages.length - 1].length > 0) {
            const sec = pages[pages.length - 1].pop();
            overflow -= sec.height;
            if (pages.length >= 2) {
                pages[pages.length - 2].push(sec);
            } else {
                // Can't fit even one page -> force dense mode handled by caller
                pages[0].push(sec);
                break;
            }
        }
    }

    return pages;
};

/* ---------- Reusable Section Renderers ---------- */
const SectionHeading = ({ children, accent }) => (
    <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] mb-2" style={{ color: accent }}>{children}</p>
);

const FeatureGrid = ({ items, dense = false }) => (
    <div className={`grid ${dense ? "grid-cols-2 gap-2" : "grid-cols-2 gap-2.5"}`}>
        {items.map((it, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-2.5">
                <p className="text-[11.5px] font-bold text-gray-900 leading-tight">{it.title}</p>
                {it.description && <p className="text-[10px] text-gray-500 mt-0.5 leading-snug">{it.description}</p>}
            </div>
        ))}
    </div>
);

const ScreenshotGallery = ({ items, maxCols = 2, dense = false }) => (
    <div className={`grid ${maxCols === 3 ? "grid-cols-3" : "grid-cols-2"} ${dense ? "gap-1.5" : "gap-2"}`}>
        {items.map((s, i) => (
            <div key={i} className="rounded-lg border border-gray-200 overflow-hidden">
                <img src={s.dataUrl} alt="" className={`w-full object-cover ${dense ? "h-14" : "h-20"}`} />
                {s.caption && <p className="text-[9px] text-gray-500 px-1.5 py-1 truncate">{s.caption}</p>}
            </div>
        ))}
    </div>
);

const PricingBlock = ({ plans, accent, dense = false }) => (
    <div className={`flex ${dense ? "gap-1.5" : "gap-2"}`}>
        {plans.map((p, i) => (
            <div key={i} className={`flex-1 rounded-lg ${dense ? "p-2" : "p-2.5"}`} style={{ border: p.highlighted ? `2px solid ${accent}` : "1px solid #e5e7eb" }}>
                <p className="text-[11px] font-bold text-gray-900">{p.name}</p>
                <p className="text-[13px] font-extrabold" style={{ color: accent }}>
                    {p.price}<span className="text-[9px] font-medium text-gray-400 ml-1">{p.period}</span>
                </p>
                {p.featuresText && <p className="text-[9px] text-gray-500 mt-1 leading-snug">{p.featuresText}</p>}
            </div>
        ))}
    </div>
);

const TestimonialsBlock = ({ items, accent }) => (
    <div className="space-y-2">
        {items.map((t, i) => (
            <div key={i} className="border-l-2 pl-2.5" style={{ borderColor: accent }}>
                <p className="text-[10.5px] italic text-gray-600 leading-snug">&ldquo;{t.quote}&rdquo;</p>
                <p className="text-[10px] font-semibold text-gray-800 mt-0.5">{t.author}{t.role ? ` — ${t.role}` : ""}</p>
            </div>
        ))}
    </div>
);

const ContactBlock = ({ contact }) => (
    <div className="flex flex-col gap-1 text-[10.5px] text-gray-600">
        {contact.phone && <span className="flex items-center gap-1.5"><Phone size={10} /> {contact.phone}</span>}
        {contact.email && <span className="flex items-center gap-1.5"><Mail size={10} /> {contact.email}</span>}
        {contact.website && <span className="flex items-center gap-1.5"><Globe size={10} /> {contact.website}</span>}
        {contact.address && <span className="flex items-center gap-1.5"><MapPin size={10} /> {contact.address}</span>}
    </div>
);

const CTABlock = ({ cta, theme, compact = false, squared = false }) => {
    if (!cta.heading && !cta.subtext) return null;
    return (
        <div className={`${squared ? "" : "rounded-xl"} text-center text-white mt-auto ${compact ? "p-3" : "p-4"}`} style={{ background: theme.background }}>
            <p className={`font-extrabold ${compact ? "text-[12px]" : "text-[13px]"}`}>{cta.heading || "Ready to get started?"}</p>
            {cta.subtext && <p className={`opacity-80 mt-1 ${compact ? "text-[10px]" : "text-[10.5px]"}`}>{cta.subtext}</p>}
            <span className="inline-block mt-2 px-4 py-1.5 rounded-full text-[10.5px] font-bold" style={{ background: theme.accent || "#f97316" }}>
                {cta.button || "Get Started"}
            </span>
        </div>
    );
};

const CoverPage = ({ data, theme, compact = false }) => (
    <div className={compact ? "flyer-cover-compact" : "flyer-cover-full"} style={{ background: theme.background, borderRadius: 0 }}>
        {data.logoPreview && (
            <div
                className={`mx-auto overflow-hidden bg-white/10 border border-white/20 ${compact ? "h-10 w-10 rounded-lg mb-2" : "h-16 w-16 rounded-xl mb-4"}`}
            >
                <img src={data.logoPreview} alt="Logo" className="h-full w-full object-cover" />
            </div>
        )}
        <p className="text-white/60 font-bold uppercase tracking-[0.2em] mb-1.5" style={{ fontSize: compact ? 8 : 10 }}>
            {data.product?.productCategory || "Product Flyer"}
        </p>
        <p className="text-white font-black leading-tight" style={{ fontSize: compact ? 15 : 26 }}>
            {data.brand?.companyName || "Your Company"}
        </p>
        <p className="text-white/75 mt-1" style={{ fontSize: compact ? 9 : 12 }}>
            {data.brand?.brandTagline}
        </p>
        {data.product?.productName && (
            <span className="inline-block mt-3 rounded-full font-bold bg-white/15 border border-white/25 text-white" style={{ fontSize: compact ? 8 : 10, padding: compact ? "3px 10px" : "5px 14px" }}>
                {data.product.productName}
            </span>
        )}
    </div>
);

const RenderSection = ({ section, data, filtered, theme, dense = false }) => {
    const accent = theme.accent || "#f97316";
    switch (section.render || section.id) {
        case "overview":
            return (
                <div className={dense ? "mb-3" : "mb-5"}>
                    <SectionHeading accent={accent}>Overview</SectionHeading>
                    <p className={`text-gray-600 leading-relaxed ${dense ? "text-[10px]" : "text-[11px]"}`}>{data.product.productOverview}</p>
                </div>
            );
        case "problemSolution":
            return (
                <div className={dense ? "mb-3" : "mb-5"}>
                    <SectionHeading accent={accent}>Problem &amp; Solution</SectionHeading>
                    {data.problemStatement && <p className={`text-gray-600 leading-relaxed mb-2 ${dense ? "text-[10px]" : "text-[11px]"}`}>{data.problemStatement}</p>}
                    {data.solutionStatement && <p className={`text-gray-600 leading-relaxed ${dense ? "text-[10px]" : "text-[11px]"}`}>{data.solutionStatement}</p>}
                </div>
            );
        case "features":
            return (
                <div className={dense ? "mb-3" : "mb-5"}>
                    <SectionHeading accent={accent}>Features</SectionHeading>
                    <FeatureGrid items={filtered.features.slice(0, dense ? 4 : 8)} dense={dense} />
                </div>
            );
        case "benefits":
            return (
                <div className={dense ? "mb-3" : "mb-5"}>
                    <SectionHeading accent={accent}>Benefits</SectionHeading>
                    <FeatureGrid items={filtered.benefits.slice(0, dense ? 4 : 8)} dense={dense} />
                </div>
            );
        case "whyChooseUs":
            return (
                <div className={dense ? "mb-3" : "mb-5"}>
                    <SectionHeading accent={accent}>Why Choose Us</SectionHeading>
                    <FeatureGrid items={filtered.why.slice(0, dense ? 3 : 8)} dense={dense} />
                </div>
            );
        case "screenshots":
            return (
                <div className={dense ? "mb-3" : "mb-5"}>
                    <SectionHeading accent={accent}>Gallery</SectionHeading>
                    <ScreenshotGallery items={filtered.screenshots} maxCols={dense ? 3 : 2} dense={dense} />
                </div>
            );
        case "pricing":
            return (
                <div className={dense ? "mb-3" : "mb-5"}>
                    <SectionHeading accent={accent}>Pricing</SectionHeading>
                    <PricingBlock plans={filtered.plans} accent={accent} dense={dense} />
                </div>
            );
        case "testimonials":
            return (
                <div className={dense ? "mb-3" : "mb-5"}>
                    <SectionHeading accent={accent}>Testimonials</SectionHeading>
                    <TestimonialsBlock items={filtered.testimonials} accent={accent} />
                </div>
            );
        case "pricingTestimonials":
            return (
                <>
                    <div className={dense ? "mb-3" : "mb-5"}>
                        <SectionHeading accent={accent}>Pricing</SectionHeading>
                        <PricingBlock plans={filtered.plans} accent={accent} dense={dense} />
                    </div>
                    <div className={dense ? "mb-3" : "mb-5"}>
                        <SectionHeading accent={accent}>Testimonials</SectionHeading>
                        <TestimonialsBlock items={filtered.testimonials} accent={accent} />
                    </div>
                </>
            );
        case "contact":
            return (
                <div className={dense ? "mb-3" : "mb-5"}>
                    <SectionHeading accent={accent}>Contact</SectionHeading>
                    <ContactBlock contact={data.contact} />
                </div>
            );
        case "cta":
            return <CTABlock cta={data.cta} theme={theme} compact={dense} />;
        default:
            return null;
    }
};

/* ==========================================================
   1) ONE PAGE FLYER ENGINE
   Always exactly 1 portrait A4. Uses aggressive proportional
   scaling (font size, gap, image size, padding) so everything
   fits with zero clipping. If still too large, drops lowest-
   priority sections. CTA is pinned to bottom.
   ========================================================== */
const OnePageFlyerEngine = ({ data, theme }) => {
    const filtered = getFilteredData(data);
    const accent = theme.accent || "#f97316";
    const availableH = INNER_H_PX;

    // Build all possible sections with normal-density height estimates
    const allSections = buildSectionMetas(data, filtered);
    // Add contact & cta as regular items for estimation, then pin them
    const footerHeight = (filtered.hasContact ? est.contact(true) : 0) + (filtered.hasCta ? est.cta(true) : 0) + est.gap(true);

    const headerH = est.header(true);
    const contentH = allSections.reduce((s, sec) => s + sec.height, 0);
    const totalH = headerH + contentH + footerHeight;

    // Compute scale: if total fits, scale=1. Otherwise shrink proportionally.
    // We allow down to 0.58 before we start dropping sections.
    let scale = totalH <= availableH ? 1 : Math.max(0.58, availableH / totalH);
    let visibleSections = allSections;

    // If even at 0.58 it won't fit, drop lowest-priority sections —
    // preserving the ORIGINAL content order (Overview -> Problem &
    // Solution -> Features -> ...) for whatever remains, instead of
    // re-sorting by priority (which used to make e.g. Why Choose Us
    // render before Overview once dropping kicked in).
    if (totalH * scale > availableH) {
        const sorted = [...allSections].sort((a, b) => a.priority - b.priority);
        for (let i = 0; i < sorted.length; i++) {
            const tryDrop = sorted.slice(i + 1);
            const tryH = headerH + tryDrop.reduce((s, sec) => s + sec.height, 0) + footerHeight;
            const tryScale = Math.max(0.58, availableH / tryH);
            if (tryH * tryScale <= availableH) {
                const keepIds = new Set(tryDrop.map((s) => s.id));
                visibleSections = allSections.filter((s) => keepIds.has(s.id));
                scale = tryScale;
                break;
            }
        }
    }

    const gap = Math.max(6, Math.round(12 * scale));
    const fontSize = Math.max(9, Math.round(12 * scale));
    const headingSize = Math.max(10, Math.round(14 * scale));

    return (
        <A4Page
            dense
            accent={accent}
            background="#ffffff"
            bottomBleed={
                (filtered.hasContact || filtered.hasCta) ? (
                    <div className="shrink-0" style={{ marginTop: `${gap}px`, fontFamily: theme.font || "Inter, sans-serif", fontSize: `${fontSize}px`, lineHeight: 1.35 }}>
                        {filtered.hasContact && (
                            <div style={{ padding: `0 ${mm(PAGE_MARGIN.x)}` }}>
                                <RenderSection section={{ id: "contact", render: "contact" }} data={data} filtered={filtered} theme={theme} dense={true} />
                            </div>
                        )}
                        {filtered.hasCta && (
                            <div style={{ marginTop: filtered.hasContact ? `${gap}px` : 0 }}>
                                <CTABlock cta={data.cta} theme={theme} compact={true} squared />
                            </div>
                        )}
                    </div>
                ) : null
            }
        >
            <div className="flex flex-col" style={{ fontFamily: theme.font || "Inter, sans-serif", fontSize: `${fontSize}px`, lineHeight: 1.35 }}>
                {/* Header */}
                <div className="flex items-center gap-2.5 mb-2 shrink-0" style={{ marginBottom: `${gap}px` }}>
                    {data.logoPreview && (
                        <img src={data.logoPreview} alt="Logo" className="h-12 w-12 object-cover rounded-lg border border-gray-200 shrink-0" style={{ transform: `scale(${scale})`, transformOrigin: "top left" }} />
                    )}
                    <div className="min-w-0">
                        <p className="font-black text-gray-900 leading-tight" style={{ fontSize: `${headingSize + 7}px` }}>{data.brand?.companyName || "Your Company"}</p>
                        <p className="text-gray-500 font-semibold leading-tight mt-0.5" style={{ fontSize: `${headingSize - 1}px` }}>{data.product?.productName}</p>
                        {data.brand?.brandTagline && <p className="text-gray-400 leading-tight mt-0.5" style={{ fontSize: `${headingSize - 4}px` }}>{data.brand.brandTagline}</p>}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-h-0 overflow-visible">
                    {visibleSections.map((sec) => (
                        <div key={sec.id} style={{ marginBottom: `${gap}px` }}>
                            <RenderSection section={sec} data={data} filtered={filtered} theme={theme} dense={true} />
                        </div>
                    ))}
                </div>
            </div>
        </A4Page>
    );
};

/* ==========================================================
   2–5) MULTI-PAGE ENGINE (BiFold, TriFold, Catalogue, CompanyProfile)
   All use the same smart packer but with different configs:
   • landscape vs portrait
   • default page counts
   • density mode
   ========================================================== */
const MultiPageEngine = ({ data, theme, pageCount, config }) => {
    const filtered = getFilteredData(data);
    const accent = theme.accent || "#f97316";
    const { landscape, defaultPages, dense: baseDense } = config;

    // totalPages is FIXED by the caller (TwoPageEngine always passes 2)
    // and is now the ACTUAL number of physical pages rendered — there is
    // no separate full-page cover anymore. The cover is a compact hero
    // banner (company name, tagline, product badge) living at the top
    // of page 1; real content starts right underneath it and continues
    // onto page 2 only if page 1 can't hold everything.
    const totalPages = Math.max(1, pageCount || defaultPages);
    const pageH = landscape ? INNER_H_LANDSCAPE_PX : INNER_H_PX;

    let dense = baseDense;
    let sections = buildSectionMetas(data, filtered);

    // Per-page capacity: page 1 loses space to the cover banner, the
    // last page loses space to Contact/CTA. Recomputed whenever density
    // changes since dense mode shrinks the banner/footer too.
    const computeLimits = (d) => {
        const coverH = est.coverCompact(d) + est.gap(d);
        const contactH = filtered.hasContact ? est.contact(d) + est.gap(d) : 0;
        const ctaH = filtered.hasCta ? est.cta(d) + est.gap(d) : 0;
        const footerH = contactH + ctaH;
        return Array.from({ length: totalPages }, (_, i) => {
            let limit = pageH;
            if (i === 0) limit -= coverH;
            if (i === totalPages - 1) limit -= footerH;
            return limit;
        });
    };

    let pageLimits = computeLimits(dense);
    let totalCapacity = pageLimits.reduce((s, l) => s + l, 0);
    let contentH = sections.reduce((s, sec) => s + sec.height, 0);

    if (contentH > totalCapacity) {
        // Tighten spacing first (same as the One Page engine) before
        // dropping any section outright.
        dense = true;
        sections = buildSectionMetas(data, filtered).map((sec) => ({
            ...sec,
            height: Math.round(sec.height * 0.8),
        }));
        pageLimits = computeLimits(dense);
        totalCapacity = pageLimits.reduce((s, l) => s + l, 0);
        contentH = sections.reduce((s, sec) => s + sec.height, 0);
    }

    // Fill each page up to its limit before spilling to the next.
    const distribute = (list, limits) => {
        const pages = limits.map(() => []);
        let p = 0, used = 0;
        for (const sec of list) {
            while (p < limits.length - 1 && used + sec.height > limits[p] && pages[p].length > 0) {
                p += 1;
                used = 0;
            }
            pages[p].push(sec);
            used += sec.height;
        }
        return pages;
    };

    let pages = distribute(sections, pageLimits);

    // The page COUNT never changes (it's fixed by the layout choice) —
    // if what's left over still can't fit on the final page, drop the
    // lowest-priority sections (screenshots/pricing/testimonials before
    // core features) one at a time until it does.
    const lastPageOverflows = () => {
        const last = pages[pages.length - 1];
        const lastH = last.reduce((s, sec) => s + sec.height, 0);
        return lastH > pageLimits[pageLimits.length - 1];
    };
    while (lastPageOverflows() && sections.length > 1) {
        const minPriority = Math.min(...sections.map((s) => s.priority));
        const dropIdx = sections.findIndex((s) => s.priority === minPriority);
        sections = sections.filter((_, i) => i !== dropIdx);
        pages = distribute(sections, pageLimits);
    }

    const renderPage = (secs, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === pages.length - 1;
        return (
            <A4Page
                key={`page-${idx}`}
                landscape={landscape}
                accent={accent}
                background="#ffffff"
                dense={dense}
                topBleed={isFirst ? <CoverPage data={data} theme={theme} compact /> : null}
                bottomBleed={isLast && filtered.hasCta ? <CTABlock cta={data.cta} theme={theme} compact={dense} squared /> : null}
            >
                <div className="flex flex-col" style={{ fontFamily: theme.font || "Inter, sans-serif" }}>
                    <div className={isFirst ? (dense ? "mt-2" : "mt-3") : ""}>
                        {secs.map((sec, sIdx) => (
                            <RenderSection key={`${sec.id}-${sIdx}`} section={sec} data={data} filtered={filtered} theme={theme} dense={dense} />
                        ))}
                    </div>
                    {/* Last page: Contact follows the content directly. */}
                    {isLast && filtered.hasContact && (
                        <div className={dense ? "mt-2" : "mt-3"}>
                            <RenderSection section={{ id: "contact", render: "contact" }} data={data} filtered={filtered} theme={theme} dense={dense} />
                        </div>
                    )}
                </div>
            </A4Page>
        );
    };

    return <>{pages.map((secs, idx) => renderPage(secs, idx))}</>;
};

/* ==========================================================
   MODERN TEMPLATE — new selectable flyer design (Flyer
   Template picker). Single continuous document preview: hero
   banner cover, two-tone Problem/Solution cards, icon-badge
   Features/Benefits/Why-Choose-Us grids, icon contact row, and
   a bottom CTA banner. The Classic template (default) and its
   OnePage/TwoPage paginated engines above are untouched.
   ========================================================== */
const ModernIconBadge = ({ Icon, accent }) => (
    <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${accent}1a`, color: accent }}>
        <Icon size={16} />
    </div>
);

const ModernTemplatePreview = ({ data, theme }) => {
    const accent = theme.accent || "#f97316";
    // Modern is now One Page only (see FLYER_TEMPLATES/FLYER_LAYOUTS
    // handling), so this preview caps content to the exact same limits
    // _build_onepage_flyer applies server-side — otherwise someone with
    // more items than the One Page engine keeps would see everything
    // here but only the top N in the downloaded PDF.
    const raw = getFilteredData(data);
    const filtered = {
        ...raw,
        features: raw.features.slice(0, 4),
        benefits: raw.benefits.slice(0, 4),
        why: raw.why.slice(0, 3),
        screenshots: raw.screenshots.slice(0, 1),
        plans: raw.plans.slice(0, 3),
        testimonials: raw.testimonials.slice(0, 2),
    };
    const iconCycle = [Sparkles, Layers, ArrowUpRight, Check, Rocket, Wand2];

    return (
        <div className="w-full max-w-3xl bg-white overflow-hidden shadow-2xl" style={{ fontFamily: theme.font || "Inter, sans-serif" }}>
            {/* Hero cover */}
            <div className="relative overflow-hidden p-8" style={{ background: theme.background }}>
                <div className="flex items-center gap-2.5">
                    {data.logoPreview && (
                        <div className="h-8 w-8 rounded-lg bg-white/10 border border-white/20 overflow-hidden shrink-0">
                            <img src={data.logoPreview} alt="Logo" className="h-full w-full object-cover" />
                        </div>
                    )}
                    <span className="text-white font-extrabold text-sm">
                        {data.brand.companyName || "Your Company"} <span style={{ color: accent }}>{data.product.productCategory ? "" : ""}</span>
                    </span>
                    <span className="text-white/50 text-xs ml-auto">{data.brand.brandTagline}</span>
                </div>
                <h1 className="text-white font-black text-4xl mt-6 leading-tight">{data.product.productName || "Your Product"}</h1>
                <p className="text-white/70 text-sm mt-2 max-w-md">{data.product.productOverview || data.brand.brandTagline}</p>
                {data.product.productOverview && (
                    <p className="mt-3" style={{ color: accent }}>
                        <span className="text-white/70 text-xs">{data.product.productCategory}</span>
                    </p>
                )}
                <div className="absolute -right-6 -bottom-10 h-40 w-40 rounded-full opacity-20" style={{ background: accent }} />
            </div>

            <div className="p-8 space-y-8">
                {/* Problem & Solution */}
                {(data.problemStatement || data.solutionStatement) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {data.problemStatement && (
                            <div className="rounded-xl p-4" style={{ background: `${accent}0d` }}>
                                <p className="text-[10px] font-extrabold uppercase tracking-wider mb-1.5" style={{ color: accent }}>The Problem</p>
                                <p className="text-[12px] text-gray-700 leading-relaxed">{data.problemStatement}</p>
                            </div>
                        )}
                        {data.solutionStatement && (
                            <div className="rounded-xl p-4 bg-gray-50">
                                <p className="text-[10px] font-extrabold uppercase tracking-wider mb-1.5 text-gray-500">Our Solution</p>
                                <p className="text-[12px] text-gray-700 leading-relaxed">{data.solutionStatement}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Key Features */}
                {filtered.features.length > 0 && (
                    <div>
                        <p className="text-[11px] font-extrabold uppercase tracking-wider mb-3" style={{ color: accent }}>Key Features</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {filtered.features.map((f, i) => (
                                <div key={i} className="flex items-start gap-3">
                                    <ModernIconBadge Icon={iconCycle[i % iconCycle.length]} accent={accent} />
                                    <div className="min-w-0">
                                        <p className="text-[12px] font-bold text-gray-900">{f.title}</p>
                                        {f.description && <p className="text-[10.5px] text-gray-500 leading-snug mt-0.5">{f.description}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Key Benefits / Why Choose Us */}
                {(filtered.benefits.length > 0 || filtered.why.length > 0) && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        {filtered.benefits.length > 0 && (
                            <div>
                                <p className="text-[11px] font-extrabold uppercase tracking-wider mb-3" style={{ color: accent }}>Key Benefits</p>
                                <div className="space-y-3">
                                    {filtered.benefits.map((b, i) => (
                                        <div key={i} className="flex items-start gap-3">
                                            <ModernIconBadge Icon={iconCycle[i % iconCycle.length]} accent={accent} />
                                            <div className="min-w-0">
                                                <p className="text-[12px] font-bold text-gray-900">{b.title}</p>
                                                {b.description && <p className="text-[10.5px] text-gray-500 leading-snug mt-0.5">{b.description}</p>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        {filtered.why.length > 0 && (
                            <div>
                                <p className="text-[11px] font-extrabold uppercase tracking-wider mb-3" style={{ color: accent }}>Why Choose Us</p>
                                <div className="space-y-3">
                                    {filtered.why.map((w, i) => (
                                        <div key={i} className="flex items-start gap-3">
                                            <ModernIconBadge Icon={iconCycle[(i + 2) % iconCycle.length]} accent={accent} />
                                            <div className="min-w-0">
                                                <p className="text-[12px] font-bold text-gray-900">{w.title}</p>
                                                {w.description && <p className="text-[10.5px] text-gray-500 leading-snug mt-0.5">{w.description}</p>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Screenshots */}
                {filtered.screenshots.length > 0 && (
                    <div>
                        <p className="text-[11px] font-extrabold uppercase tracking-wider mb-3" style={{ color: accent }}>Product Gallery</p>
                        <ScreenshotGallery items={filtered.screenshots} maxCols={filtered.screenshots.length >= 5 ? 3 : 2} />
                    </div>
                )}

                {/* Pricing */}
                {data.pricingEnabled && filtered.plans.length > 0 && (
                    <div>
                        <p className="text-[11px] font-extrabold uppercase tracking-wider mb-3" style={{ color: accent }}>Pricing</p>
                        <PricingBlock plans={filtered.plans} accent={accent} />
                    </div>
                )}

                {/* Testimonials */}
                {filtered.testimonials.length > 0 && (
                    <div>
                        <p className="text-[11px] font-extrabold uppercase tracking-wider mb-3" style={{ color: accent }}>Testimonials</p>
                        <TestimonialsBlock items={filtered.testimonials} accent={accent} />
                    </div>
                )}

                {/* Get In Touch */}
                {filtered.hasContact && (
                    <div>
                        <p className="text-[11px] font-extrabold uppercase tracking-wider mb-3" style={{ color: accent }}>Get In Touch</p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                            {data.contact.phone && (
                                <div className="flex items-center gap-2"><ModernIconBadge Icon={Phone} accent={accent} /><span className="text-[11px] text-gray-700">{data.contact.phone}</span></div>
                            )}
                            {data.contact.email && (
                                <div className="flex items-center gap-2"><ModernIconBadge Icon={Mail} accent={accent} /><span className="text-[11px] text-gray-700">{data.contact.email}</span></div>
                            )}
                            {data.contact.website && (
                                <div className="flex items-center gap-2"><ModernIconBadge Icon={Globe} accent={accent} /><span className="text-[11px] text-gray-700">{data.contact.website}</span></div>
                            )}
                            {data.contact.address && (
                                <div className="flex items-center gap-2"><ModernIconBadge Icon={MapPin} accent={accent} /><span className="text-[11px] text-gray-700">{data.contact.address}</span></div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* CTA banner */}
            {filtered.hasCta && (
                <div className="flex items-center justify-between gap-4 px-8 py-6 bg-gray-950">
                    <div>
                        <p className="text-white font-extrabold text-sm">{data.cta.heading || "Ready to get started?"}</p>
                        {data.cta.subtext && <p className="text-gray-400 text-xs mt-1">{data.cta.subtext}</p>}
                    </div>
                    <span className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold text-white" style={{ background: accent }}>
                        {data.cta.button || "Get Started"} <ArrowUpRight size={13} />
                    </span>
                </div>
            )}
        </div>
    );
};

const TwoPageEngine = ({ data, theme }) => (
    <MultiPageEngine data={data} theme={theme} pageCount={2} config={{ landscape: false, defaultPages: 2, dense: false }} />
);

/* ==========================================================
   MAIN PREVIEW COMPONENT — Layout Router
   ========================================================== */
const FlyerPreview = ({ layout, template = "classic", theme, brand, product, problemStatement, solutionStatement, features, benefits, whyChooseUs, screenshots, pricingEnabled, pricingPlans, testimonials, contact, cta, logoPreview }) => {
    const data = {
        brand, product, problemStatement, solutionStatement,
        features, benefits, whyChooseUs, screenshots,
        pricingEnabled, pricingPlans, testimonials,
        contact, cta, logoPreview
    };

    const renderEngine = () => {
        if (template === "modern") {
            return <ModernTemplatePreview data={data} theme={theme} />;
        }
        switch (layout) {
            case "onePage":
                return <OnePageFlyerEngine data={data} theme={theme} />;
            case "twoPage":
                return <TwoPageEngine data={data} theme={theme} />;
            default:
                return <OnePageFlyerEngine data={data} theme={theme} />;
        }
    };

    return (
        <>
            <style>{`
                .flyer-page-frame { break-inside: avoid; page-break-inside: avoid; }
                .flyer-page { box-sizing: border-box; overflow: visible; display: flex; flex-direction: column; box-shadow: 0 18px 40px -12px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,0,0,0.04); }
                .flyer-page-inner { flex: 0 1 auto; overflow: visible; }
                .flyer-page-dense .flyer-page-inner { font-size: 10.5px; }
                .flyer-page-footer { margin-top: auto; padding-top: 6px; border-top: 1px solid; display: flex; justify-content: space-between; font-size: 7.5px; letter-spacing: 0.08em; text-transform: uppercase; color: #9ca3af; }
                .flyer-cover-full { min-height: 100%; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: ${mm(20)} ${mm(14)}; }
                .flyer-cover-compact { text-align: center; padding: 14px 12px; margin-bottom: 10px; border-radius: 12px; }
                @media print {
                    body * { visibility: hidden; }
                    #flyer-print-root, #flyer-print-root * { visibility: visible; }
                    #flyer-print-root { position: absolute; left: 0; top: 0; width: auto; }
                    .flyer-page-frame { box-shadow: none !important; margin: 0 !important; break-after: page; page-break-after: always; }
                    .flyer-page-frame:last-child { break-after: auto; page-break-after: auto; }
                    .flyer-page { box-shadow: none !important; overflow: hidden !important; width: ${A4.w}mm !important; height: ${A4.h}mm !important; }
                    .flyer-page[data-landscape="true"] { width: ${A4.h}mm !important; height: ${A4.w}mm !important; }
                }
            `}</style>
            <div className="flex flex-col items-center gap-6 w-fit mx-auto">
                {renderEngine()}
            </div>
        </>
    );
};


// Measures exactly how much viewport height is left below an element's
// actual rendered top position, so a scroll container's max-height is
// always precisely "the rest of the screen" — no more guessing a fixed
// vh or calc(100vh - Npx) value that may or may not match the real
// header height. Recomputes on resize and after content changes.
const useAvailableHeight = (bottomPadding = 24) => {
    const ref = useRef(null);
    const [maxHeight, setMaxHeight] = useState(null);
    useLayoutEffect(() => {
        const compute = () => {
            if (!ref.current) return;
            const top = ref.current.getBoundingClientRect().top;
            setMaxHeight(Math.max(240, window.innerHeight - top - bottomPadding));
        };
        compute();
        window.addEventListener("resize", compute);
        const id = window.setInterval(compute, 500); // catches layout shifts (tab switches, AI content loading, etc.) without needing a ResizeObserver
        return () => {
            window.removeEventListener("resize", compute);
            window.clearInterval(id);
        };
    }, []);
    return [ref, maxHeight];
};

const FlyerGenerationView = () => {
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState(""); // base64 data URL — travels to the backend as-is

    const [brand, setBrand] = useState({ companyName: "", brandTagline: "" });
    const [product, setProduct] = useState({ productName: "", productCategory: "", productOverview: "" });
    const [problemStatement, setProblemStatement] = useState("");
    const [solutionStatement, setSolutionStatement] = useState("");
    const [features, setFeatures] = useState([emptyFeature()]);
    const [benefits, setBenefits] = useState([emptyFeature()]);
    const [whyChooseUs, setWhyChooseUs] = useState([emptyFeature()]);
    const [screenshots, setScreenshots] = useState([]); // [{dataUrl, caption}]
    const [pricingEnabled, setPricingEnabled] = useState(false);
    const [pricingPlans, setPricingPlans] = useState([emptyPricingPlan()]);
    const [testimonials, setTestimonials] = useState([emptyTestimonial()]);
    const [contact, setContact] = useState({ phone: "", email: "", website: "", address: "" });
    const [cta, setCta] = useState({ heading: "", subtext: "", button: "Get Started" });
    const [layout, setLayout] = useState(FLYER_LAYOUTS[0].id);
    // Which of the detailed content tabs (Brand, Product, Features, ...)
    // is currently open — clicking a tab in the left nav swaps this,
    // showing only that tab's fields on the right instead of every
    // section stacked and scrolled through at once.
    const [activeFormTab, setActiveFormTab] = useState(FLYER_FORM_TABS[0].id);
    // Visual template for the generated flyer itself (not the color
    // theme) — "classic" is the original look and stays the default;
    // "modern" is the new icon-badge/hero-banner look.
    const [template, setTemplate] = useState(FLYER_TEMPLATES[0].id);

    // Independent, measured-height scroll containers for the form and
    // the Live Preview — each ends exactly at the bottom of the
    // viewport, so both scroll all the way to their own end reliably.
    const [formScrollRef, formMaxHeight] = useAvailableHeight(24);
    const [previewScrollRef, previewMaxHeight] = useAvailableHeight(24);

    // Page count is now fixed by the layout choice: One Page is always
    // exactly 1 page, Two Page is always exactly 1 cover + 1 content
    // page (2 total) — see TwoPageEngine / MultiPageEngine. There's
    // nothing left for the user to enter here.
    const pageCountValid = true;
    const effectivePageCount = layout === "onePage" ? 1 : 2;

    // AI Theme Generator — same shared hook the Feature Card module uses.
    const {
        aiPrompt, setAiPrompt, aiThemeLoading, aiThemeError, aiTheme,
        generate: generateAiTheme, reset: handleResetTheme,
    } = useAiThemeGenerator();
    const [selectedFontId, setSelectedFontId] = useState(FONT_OPTIONS[0].id);
    const [customFontName, setCustomFontName] = useState("");
    useGoogleFonts([...FONT_OPTIONS.map((f) => f.google), customFontName.trim() ? customFontName.trim().replace(/\s+/g, "+") : null]);
    const selectedFontStack =
        selectedFontId === "other"
            ? (customFontName.trim() ? `'${customFontName.trim()}', sans-serif` : FONT_OPTIONS[0].stack)
            : FONT_OPTIONS.find((f) => f.id === selectedFontId)?.stack || FONT_OPTIONS[0].stack;
    const activeTheme = { ...(aiTheme || DEFAULT_FLYER_THEME), font: selectedFontStack };

    // AI Content Generator — quick-fill form (company, product, industry,
    // website) that drafts every text section; everything it returns
    // stays fully editable afterwards.
    const [aiContentForm, setAiContentForm] = useState({ companyName: "", productName: "", industry: "", website: "" });
    const [aiContentLoading, setAiContentLoading] = useState(false);
    const [aiContentError, setAiContentError] = useState("");

    // Prefill the four AI Content Generator fields with the logged-in
    // company's own profile the moment this page opens — company_name /
    // website / industry_sector come from GET /me, product_name comes
    // from the first product in GET /products (if any exist yet). Runs
    // once on mount; whatever the person types afterwards is theirs —
    // this never overwrites a field they've already edited.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            const [meRes, productsRes] = await Promise.allSettled([
                fetch(ME_ENDPOINT, { headers: authHeaders() }),
                fetch(PRODUCTS_ENDPOINT, { headers: authHeaders() }),
            ]);
            const me =
                meRes.status === "fulfilled" && meRes.value.ok ? await meRes.value.json().catch(() => null) : null;
            const productsData =
                productsRes.status === "fulfilled" && productsRes.value.ok ? await productsRes.value.json().catch(() => null) : null;
            const firstProduct = productsData?.data?.[0];
            if (cancelled || (!me && !firstProduct)) return;
            setAiContentForm((prev) => ({
                companyName: prev.companyName || me?.company_name || "",
                productName: prev.productName || firstProduct?.product_name || "",
                industry: prev.industry || me?.industry_sector || "",
                website: prev.website || me?.website || "",
            }));
        })();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const [downloadingPdf, setDownloadingPdf] = useState(false);
    const [downloadError, setDownloadError] = useState("");

    // ---- Client-side PNG/PDF export of exactly what's in the preview
    // panel — same pattern as the Feature Card's Download dropdown
    // (html2canvas-pro snapshot + jsPDF wrap), so what downloads is a
    // pixel-for-pixel match of the Live Preview, no server round-trip,
    // no icon-rendering discrepancies, and no new tab opening.
    const [downloadingPreview, setDownloadingPreview] = useState(false);
    const [downloadFormat, setDownloadFormat] = useState("");
    const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
    const previewRef = useRef(null);

    const handleDownloadPreview = async (fmt) => {
        if (!previewRef.current || downloadingPreview) return;
        setDownloadingPreview(true);
        setDownloadFormat(fmt);
        setDownloadMenuOpen(false);
        setDownloadError("");
        try {
            const { default: html2canvas } = await import("html2canvas-pro");
            const canvas = await html2canvas(previewRef.current, {
                backgroundColor: "#ffffff",
                scale: 2,
                useCORS: true,
            });
            const slug =
                (brand.companyName || product.productName).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") ||
                "flyer";

            if (fmt === "pdf") {
                const { jsPDF } = await import("jspdf");
                const imgData = canvas.toDataURL("image/png");
                const pdf = new jsPDF({
                    orientation: canvas.width >= canvas.height ? "landscape" : "portrait",
                    unit: "px",
                    format: [canvas.width, canvas.height],
                });
                pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
                pdf.save(`${slug}-flyer.pdf`);
            } else {
                const link = document.createElement("a");
                link.download = `${slug}-flyer.png`;
                link.href = canvas.toDataURL("image/png");
                link.click();
            }
        } catch (err) {
            console.error("Flyer preview export failed:", err);
            setDownloadError(
                `Couldn't export the preview: ${err?.message || err}. Make sure \`npm install html2canvas-pro jspdf\` has been run and the dev server was restarted.`
            );
        } finally {
            setDownloadingPreview(false);
            setDownloadFormat("");
        }
    };

    const handleLogoChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setLogoFile(file);
        setLogoPreview(await fileToDataUrl(file));
    };

    const handleAddScreenshots = async (fileList) => {
        const files = Array.from(fileList || []).slice(0, MAX_SCREENSHOTS - screenshots.length);
        const converted = await Promise.all(files.map(async (f) => ({ dataUrl: await fileToDataUrl(f), caption: "" })));
        setScreenshots((prev) => [...prev, ...converted].slice(0, MAX_SCREENSHOTS));
    };
    const removeScreenshot = (i) => setScreenshots((prev) => prev.filter((_, idx) => idx !== i));
    const updateScreenshotCaption = (i, val) =>
        setScreenshots((prev) => prev.map((s, idx) => (idx === i ? { ...s, caption: val } : s)));

    // Fills every field with realistic placeholder content in one click —
    // for demoing/testing the preview and PDF export without typing a
    // full flyer by hand. Purely a convenience over the same setters
    // the form's own inputs already call; doesn't touch the backend.
    const handleFillDemoData = () => {
        setBrand({ companyName: "Northwind Robotics", brandTagline: "Automation that pays for itself in 90 days" });
        setProduct({
            productName: "Northwind FlowLine",
            productCategory: "Warehouse Automation",
            productOverview:
                "FlowLine is a modular conveyor-and-robotics kit that bolts onto your existing warehouse layout, cutting manual pick-and-pack time by more than half without a full facility redesign.",
        });
        setProblemStatement(
            "Manual pick-and-pack workflows can't keep up with peak-season order volume, leading to missed SLAs, overtime costs, and burned-out warehouse staff."
        );
        setSolutionStatement(
            "FlowLine adds robotic picking arms and smart conveyor routing to your current racking, guided by an AI queue optimizer that rebalances work in real time as orders spike."
        );
        setFeatures([
            { title: "Smart Pick Routing", description: "AI reroutes orders to the fastest open picking station automatically." },
            { title: "Plug-and-Play Install", description: "Bolts onto existing racking — no facility redesign or downtime week." },
            { title: "Live Throughput Dashboard", description: "Real-time visibility into orders/hour, bottlenecks, and staffing needs." },
            { title: "Modular Expansion", description: "Add lanes or arms as volume grows, without replacing the base system." },
        ]);
        setBenefits([
            { title: "58% Faster Pick Times", description: "Average across pilot customers in the first 90 days." },
            { title: "Lower Overtime Spend", description: "Smooths peak-season spikes instead of relying on extra shifts." },
            { title: "Fewer Mis-Picks", description: "Guided picking cuts order errors and costly returns." },
        ]);
        setWhyChooseUs([
            { title: "12-Week Install", description: "Fastest deployment timeline in the category, start to finish." },
            { title: "Dedicated Success Team", description: "A named engineer stays on your account for the first year." },
            { title: "Hardware-Agnostic", description: "Works with most existing conveyor and racking systems." },
        ]);
        setPricingEnabled(true);
        setPricingPlans([
            { name: "Starter", price: "$1,499", period: "/ month", featuresText: "1 lane, Live dashboard, Email support", highlighted: false },
            { name: "Growth", price: "$3,999", period: "/ month", featuresText: "Up to 4 lanes, Priority support, Quarterly tuning", highlighted: true },
            { name: "Enterprise", price: "Custom", period: "", featuresText: "Unlimited lanes, Dedicated engineer, Custom SLAs", highlighted: false },
        ]);
        setTestimonials([
            { quote: "FlowLine cut our peak-season overtime bill in half within one quarter.", author: "Priya Nair", role: "Ops Director, Cascade Retail" },
            { quote: "Installed in under three weeks with zero disruption to live shipping.", author: "Marcus Webb", role: "Warehouse Manager, Ironclad Supply" },
        ]);
        setContact({ phone: "+1 (555) 019-4482", email: "hello@northwindrobotics.com", website: "www.northwindrobotics.com", address: "480 Harbor Way, Austin, TX" });
        setCta({ heading: "Ready to see FlowLine in your warehouse?", subtext: "Book a 20-minute walkthrough — no commitment required.", button: "Book a Demo" });
    };

    const handleGenerateAiContent = async () => {
        const { companyName, productName, industry, website } = aiContentForm;
        if (!companyName.trim() || !productName.trim() || aiContentLoading) return;
        setAiContentLoading(true);
        setAiContentError("");
        try {
            const res = await fetch(FLYER_AI_CONTENT_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ company_name: companyName, product_name: productName, industry, website, page_count: effectivePageCount }),
            });
            const resp = await res.json().catch(() => null);
            if (!res.ok || !resp?.content) {
                throw new Error(resp?.detail || resp?.message || `Request failed (${res.status})`);
            }
            const c = resp.content;
            setBrand({ companyName, brandTagline: c.brand_tagline || "" });
            setProduct((prev) => ({ ...prev, productName, productOverview: c.product_overview || "" }));
            setProblemStatement(c.problem_statement || "");
            setSolutionStatement(c.solution_statement || "");
            if (Array.isArray(c.features) && c.features.length) {
                setFeatures(c.features.slice(0, FLYER_MAX_ITEMS).map((f) => ({ title: f.title || "", description: f.description || "" })));
            }
            if (Array.isArray(c.benefits) && c.benefits.length) {
                setBenefits(c.benefits.slice(0, FLYER_MAX_ITEMS).map((f) => ({ title: f.title || "", description: f.description || "" })));
            }
            if (Array.isArray(c.why_choose_us) && c.why_choose_us.length) {
                setWhyChooseUs(c.why_choose_us.slice(0, FLYER_MAX_ITEMS).map((f) => ({ title: f.title || "", description: f.description || "" })));
            }
            setCta((prev) => ({ ...prev, heading: c.cta_heading || prev.heading, subtext: c.cta_subtext || prev.subtext }));
        } catch (err) {
            setAiContentError(
                `Couldn't generate content: ${err?.message || err}. Make sure the feature-card backend is running on ${FEATURE_CARD_API_BASE}.`
            );
        } finally {
            setAiContentLoading(false);
        }
    };

    // Calls /generate-flyer with the full structured JSON payload and
    // downloads the print-ready A4 PDF it returns — the flyer
    // equivalent of the Feature Card's "Download PDF" button (same
    // loading/error affordances), backed by a real server-side paginated
    // render rather than a single-page canvas snapshot, since a proper
    // print-ready multi-page flyer (page breaks, repeating
    // headers/footers) needs real pagination.
    const handleDownloadPdf = async () => {
        if (downloadingPdf) return;
        setDownloadingPdf(true);
        setDownloadError("");
        try {
            const payload = {
                layout: BACKEND_LAYOUT_MAP[layout] || layout,
                template,
                page_count: effectivePageCount,
                theme: activeTheme,
                logo_base64: logoPreview,
                company_name: brand.companyName,
                brand_tagline: brand.brandTagline,
                product_name: product.productName,
                product_category: product.productCategory,
                product_overview: product.productOverview,
                problem_statement: problemStatement,
                solution_statement: solutionStatement,
                features,
                benefits,
                why_choose_us: whyChooseUs,
                screenshots: screenshots.map((s) => ({ image_base64: s.dataUrl, caption: s.caption })),
                pricing_enabled: pricingEnabled,
                pricing_plans: pricingPlans
                    .filter((p) => p.name.trim())
                    .map((p) => ({
                        name: p.name,
                        price: p.price,
                        period: p.period,
                        features: (p.featuresText || "").split(",").map((x) => x.trim()).filter(Boolean),
                        highlighted: p.highlighted,
                    })),
                testimonials,
                phone: contact.phone,
                email: contact.email,
                website: contact.website,
                address: contact.address,
                cta_heading: cta.heading,
                cta_subtext: cta.subtext,
                cta_button: cta.button || "Get Started",
            };
            const res = await fetch(FLYER_GENERATE_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            const resp = await res.json().catch(() => null);
            if (!res.ok || !resp?.download_url) {
                throw new Error(resp?.detail || resp?.message || `Request failed (${res.status})`);
            }
            const slug = (brand.companyName || "flyer").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
            const link = document.createElement("a");
            link.href = resp.download_url;
            link.target = "_blank";
            link.rel = "noopener";
            link.download = `${slug || "flyer"}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            setDownloadError(
                `Couldn't generate the PDF: ${err?.message || err}. Make sure the feature-card backend is running on ${FEATURE_CARD_API_BASE}.`
            );
        } finally {
            setDownloadingPdf(false);
        }
    };

    return (
        <div className="mt-6 flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-6 pb-2">
            {/* ---- Form ---- */}
            <div ref={formScrollRef} className="space-y-5 lg:overflow-y-auto lg:pr-3" style={{ maxHeight: formMaxHeight ? `${formMaxHeight}px` : undefined }}>
                <div className="flex items-center justify-between rounded-2xl border border-dashed border-orange-500/25 bg-orange-500/[0.04] px-4 py-3">
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Wand2 size={14} className="text-orange-400 shrink-0" />
                        Just testing? Fill the form with sample content in one click.
                    </div>
                    <button
                        type="button"
                        onClick={handleFillDemoData}
                        className="inline-flex items-center gap-1.5 shrink-0 bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 text-orange-300 text-xs font-semibold rounded-lg px-3 py-1.5 transition"
                    >
                        <Wand2 size={13} /> Demo
                    </button>
                </div>

                {downloadError && (
                    <div className="flex items-center gap-2.5 text-[13px] text-red-400 border border-red-500/20 bg-red-500/[0.06] rounded-2xl px-4 py-3.5">
                        <AlertCircle size={16} className="shrink-0" /> {downloadError}
                    </div>
                )}

                {/* Number of Pages — entered up front, before generating anything.
                    Not applicable to the One Page Flyer: its dedicated engine
                    always produces exactly one page, so this becomes an
                    informational note instead of an input for that layout. */}
                <SectionCard
                    icon={Hash}
                    title="Number of Pages"
                    subtitle="Set automatically by the layout you choose below"
                >
                    {layout === "onePage" ? (
                        <p className="text-[11px] text-gray-400 leading-relaxed">
                            One Page always generates exactly{" "}
                            <span className="text-orange-400 font-semibold">1 page</span>. Content is
                            auto-prioritized — logo → company → product → overview → problem &amp;
                            solution → top 4 features → top 4 benefits → top 3 why-choose-us → 1
                            screenshot → top 3 pricing plans → top 2 testimonials → contact → CTA —
                            and font size, spacing, and padding shrink automatically so everything
                            fits with no overflow and nothing is hidden. The CTA always stays pinned
                            to the bottom.
                        </p>
                    ) : (
                        <p className="text-[11px] text-gray-400 leading-relaxed">
                            Two Page always generates exactly{" "}
                            <span className="text-orange-400 font-semibold">2 pages</span>: a cover page,
                            then one content page with every section — features, benefits,
                            why-choose-us, screenshots, pricing, and testimonials — followed by
                            contact and the CTA pinned to the bottom of that same page.
                        </p>
                    )}
                </SectionCard>

                {/* AI Content Generator — quick-fill, drafts every section below */}
                <SectionCard icon={Rocket} title="AI Content Generator" subtitle="Draft the whole flyer from four fields">
                    {aiContentError && (
                        <div className="flex items-center gap-2 text-xs text-red-400 border border-red-500/20 bg-red-500/[0.06] rounded-xl px-3 py-2.5">
                            <AlertCircle size={13} className="shrink-0" /> {aiContentError}
                        </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                            className={inputClass}
                            placeholder="Company name"
                            value={aiContentForm.companyName}
                            onChange={(e) => setAiContentForm((p) => ({ ...p, companyName: e.target.value }))}
                        />
                        <input
                            className={inputClass}
                            placeholder="Product name"
                            value={aiContentForm.productName}
                            onChange={(e) => setAiContentForm((p) => ({ ...p, productName: e.target.value }))}
                        />
                        <input
                            className={inputClass}
                            placeholder="Industry"
                            value={aiContentForm.industry}
                            onChange={(e) => setAiContentForm((p) => ({ ...p, industry: e.target.value }))}
                        />
                        <input
                            className={inputClass}
                            placeholder="Website (optional)"
                            value={aiContentForm.website}
                            onChange={(e) => setAiContentForm((p) => ({ ...p, website: e.target.value }))}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={handleGenerateAiContent}
                        disabled={!aiContentForm.companyName.trim() || !aiContentForm.productName.trim() || aiContentLoading}
                        className="w-full inline-flex items-center justify-center gap-2 bg-orange-500/15 hover:bg-orange-500/25 backdrop-blur-sm border border-orange-400/30 disabled:opacity-40 disabled:cursor-not-allowed text-orange-200 text-xs font-semibold rounded-lg px-3.5 py-2 transition"
                    >
                        {aiContentLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                        {aiContentLoading ? "Generating..." : "Generate Flyer with AI"}
                    </button>
                    <p className="text-[11px] text-gray-500">Everything it drafts stays fully editable in the sections below.</p>
                </SectionCard>

                {/* Layout preset */}
                <SectionCard icon={Layers} title="Flyer Layout" subtitle="Changes page structure — not your content">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {FLYER_LAYOUTS.map((l) => {
                            const Icon = l.icon;
                            const active = layout === l.id;
                            // Modern template only supports One Page right now —
                            // every other layout option is disabled and blurred
                            // out instead of hidden, so it's clear why it's
                            // unavailable rather than just missing.
                            const disabledByTemplate = template === "modern" && l.id !== "onePage";
                            return (
                                <button
                                    key={l.id}
                                    type="button"
                                    disabled={disabledByTemplate}
                                    onClick={() => !disabledByTemplate && setLayout(l.id)}
                                    title={disabledByTemplate ? "Modern template currently only supports One Page" : undefined}
                                    className={`text-left rounded-xl border px-3.5 py-3 transition ${
                                        disabledByTemplate
                                            ? "border-white/5 bg-white/[0.01] opacity-40 blur-[1px] cursor-not-allowed pointer-events-none"
                                            : active
                                            ? "border-orange-500/60 bg-orange-500/[0.08]"
                                            : "border-white/10 bg-white/[0.02] hover:border-white/20"
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <Icon size={14} className={active && !disabledByTemplate ? "text-orange-400" : "text-gray-400"} />
                                        <span className={`text-xs font-semibold ${active && !disabledByTemplate ? "text-orange-300" : "text-gray-200"}`}>{l.label}</span>
                                        {active && !disabledByTemplate && <Check size={12} className="text-orange-400 ml-auto" />}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                    {template === "modern" && (
                        <p className="text-[10.5px] text-gray-500 leading-snug">
                            Modern template is currently One Page only — switch back to Classic under Flyer Template to unlock Two Page.
                        </p>
                    )}
                </SectionCard>

                {/* Flyer Template — visual design of the generated content itself,
                    separate from the AI Theme Generator's color palette below. */}
                <SectionCard icon={Layers} title="Flyer Template" subtitle="Choose the visual design — content stays the same">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {FLYER_TEMPLATES.map((t) => {
                            const active = template === t.id;
                            return (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => {
                                        setTemplate(t.id);
                                        // Modern only supports One Page right now — jumping
                                        // straight to it avoids leaving "twoPage" selected
                                        // underneath a disabled/blurred layout card.
                                        if (t.id === "modern") setLayout("onePage");
                                    }}
                                    className={`text-left rounded-xl border px-3.5 py-3 transition ${
                                        active
                                            ? "border-orange-500/60 bg-orange-500/[0.08]"
                                            : "border-white/10 bg-white/[0.02] hover:border-white/20"
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className={`text-xs font-semibold ${active ? "text-orange-300" : "text-gray-200"}`}>{t.label}</span>
                                        {t.id === "classic" && <span className="text-[9px] text-gray-500 border border-white/10 rounded-full px-1.5 py-0.5">Default</span>}
                                        {active && <Check size={12} className="text-orange-400 ml-auto" />}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </SectionCard>

                {/* Detailed content — a left tab list (Brand Information, Product
                    Details, Problem & Solution, Features, Benefits, Why Choose Us,
                    Media & Screenshots, Pricing Plans, Testimonials, Contact
                    Information, CTA Section, Theme). Clicking a tab opens only
                    that section's fields on the right, instead of every section
                    stacked and scrolled through at once. */}
                <div className="rounded-2xl border border-white/5 bg-white/[0.02]">
                    <div className="flex flex-col sm:flex-row">
                        <div className="sm:w-56 shrink-0 border-b sm:border-b-0 sm:border-r border-white/5 p-2 flex flex-row sm:flex-col gap-1 overflow-x-auto sm:overflow-visible">
                            {FLYER_FORM_TABS.map((t) => {
                                const TabIcon = t.icon;
                                const active = activeFormTab === t.id;
                                return (
                                    <button
                                        key={t.id}
                                        type="button"
                                        onClick={() => setActiveFormTab(t.id)}
                                        className={`shrink-0 sm:w-full flex items-center gap-2.5 text-left rounded-xl px-3 py-2.5 text-xs font-semibold transition whitespace-nowrap ${
                                            active
                                                ? "bg-orange-500/10 text-orange-300 border border-orange-500/30"
                                                : "text-gray-400 hover:bg-white/[0.04] hover:text-gray-200 border border-transparent"
                                        }`}
                                    >
                                        <TabIcon size={14} className={active ? "text-orange-400" : "text-gray-500"} />
                                        {t.label}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="flex-1 min-w-0 p-5 space-y-4">
                            <div>
                                <h4 className="text-white text-sm font-semibold leading-tight">
                                    {FLYER_FORM_TABS.find((t) => t.id === activeFormTab)?.label}
                                </h4>
                                <p className="text-gray-500 text-xs mt-0.5">
                                    {FLYER_FORM_TABS.find((t) => t.id === activeFormTab)?.subtitle}
                                </p>
                            </div>

                            {/* Brand Information */}
                            {activeFormTab === "brand" && (
                                <>
                                    <div className="flex items-center gap-4">
                                        <div className="h-16 w-16 rounded-2xl border border-dashed border-orange-500/30 bg-white/[0.03] flex items-center justify-center overflow-hidden shrink-0">
                                            {logoPreview ? (
                                                <img src={logoPreview} alt="Logo preview" className="h-full w-full object-cover" />
                                            ) : (
                                                <ImageIcon size={20} className="text-gray-600" />
                                            )}
                                        </div>
                                        <label className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-semibold rounded-xl px-4 py-2.5 cursor-pointer transition">
                                            <Upload size={13} />
                                            {logoFile ? "Change logo" : "Upload logo"}
                                            <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                                        </label>
                                    </div>

                                    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-orange-500/[0.06] to-transparent p-4 space-y-4">
                                        <Field label="Company Name" required>
                                            <IconInput
                                                icon={Building2}
                                                className="text-base font-semibold"
                                                placeholder="Acme Inc."
                                                value={brand.companyName}
                                                onChange={(e) => setBrand((p) => ({ ...p, companyName: e.target.value }))}
                                            />
                                        </Field>
                                        <Field label="Brand Tagline">
                                            <IconInput
                                                icon={Quote}
                                                placeholder="Smart. Simple. Powerful."
                                                value={brand.brandTagline}
                                                onChange={(e) => setBrand((p) => ({ ...p, brandTagline: e.target.value }))}
                                            />
                                        </Field>
                                    </div>
                                </>
                            )}

                            {/* Product Details */}
                            {activeFormTab === "product" && (
                                <>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <Field label="Product Name" required>
                                            <input
                                                className={inputClass}
                                                placeholder="Your product name"
                                                value={product.productName}
                                                onChange={(e) => setProduct((p) => ({ ...p, productName: e.target.value }))}
                                            />
                                        </Field>
                                        <Field label="Category">
                                            <input
                                                className={inputClass}
                                                placeholder="e.g. SaaS Platform"
                                                value={product.productCategory}
                                                onChange={(e) => setProduct((p) => ({ ...p, productCategory: e.target.value }))}
                                            />
                                        </Field>
                                    </div>
                                    <Field label="Overview">
                                        <textarea
                                            className={`${inputClass} resize-none`}
                                            rows={3}
                                            placeholder="2-3 sentences describing the product"
                                            value={product.productOverview}
                                            onChange={(e) => setProduct((p) => ({ ...p, productOverview: e.target.value }))}
                                        />
                                    </Field>
                                </>
                            )}

                            {/* Problem & Solution */}
                            {activeFormTab === "problem" && (
                                <>
                                    <Field label="Problem Statement">
                                        <textarea
                                            className={`${inputClass} resize-none`}
                                            rows={2}
                                            placeholder="What pain point does your customer have?"
                                            value={problemStatement}
                                            onChange={(e) => setProblemStatement(e.target.value)}
                                        />
                                    </Field>
                                    <Field label="Solution">
                                        <textarea
                                            className={`${inputClass} resize-none`}
                                            rows={2}
                                            placeholder="How does your product solve it?"
                                            value={solutionStatement}
                                            onChange={(e) => setSolutionStatement(e.target.value)}
                                        />
                                    </Field>
                                </>
                            )}

                            {/* Features */}
                            {activeFormTab === "features" && (
                                <TitleDescListEditor
                                    items={features}
                                    onUpdate={updateListItem(setFeatures)}
                                    onAdd={addListItem(setFeatures, FLYER_MAX_ITEMS, emptyFeature)}
                                    onRemove={removeListItem(setFeatures)}
                                    max={FLYER_MAX_ITEMS}
                                    itemLabel="Feature"
                                />
                            )}

                            {/* Benefits */}
                            {activeFormTab === "benefits" && (
                                <TitleDescListEditor
                                    items={benefits}
                                    onUpdate={updateListItem(setBenefits)}
                                    onAdd={addListItem(setBenefits, FLYER_MAX_ITEMS, emptyFeature)}
                                    onRemove={removeListItem(setBenefits)}
                                    max={FLYER_MAX_ITEMS}
                                    itemLabel="Benefit"
                                />
                            )}

                            {/* Why Choose Us */}
                            {activeFormTab === "why" && (
                                <TitleDescListEditor
                                    items={whyChooseUs}
                                    onUpdate={updateListItem(setWhyChooseUs)}
                                    onAdd={addListItem(setWhyChooseUs, FLYER_MAX_ITEMS, emptyFeature)}
                                    onRemove={removeListItem(setWhyChooseUs)}
                                    max={FLYER_MAX_ITEMS}
                                    itemLabel="Reason"
                                />
                            )}

                            {/* Media & Screenshots */}
                            {activeFormTab === "media" && (
                                <ScreenshotUploader
                                    screenshots={screenshots}
                                    onAddFiles={handleAddScreenshots}
                                    onRemove={removeScreenshot}
                                    onCaptionChange={updateScreenshotCaption}
                                    max={MAX_SCREENSHOTS}
                                />
                            )}

                            {/* Pricing Plans */}
                            {activeFormTab === "pricing" && (
                                <>
                                    <label className="inline-flex items-center gap-2 text-xs text-gray-400">
                                        <input type="checkbox" checked={pricingEnabled} onChange={(e) => setPricingEnabled(e.target.checked)} />
                                        Include pricing
                                    </label>
                                    {pricingEnabled && (
                                        <PricingPlansEditor
                                            plans={pricingPlans}
                                            onUpdate={updateListItem(setPricingPlans)}
                                            onAdd={addListItem(setPricingPlans, MAX_PRICING_PLANS, emptyPricingPlan)}
                                            onRemove={removeListItem(setPricingPlans)}
                                            max={MAX_PRICING_PLANS}
                                        />
                                    )}
                                </>
                            )}

                            {/* Testimonials */}
                            {activeFormTab === "testimonials" && (
                                <TestimonialsEditor
                                    items={testimonials}
                                    onUpdate={updateListItem(setTestimonials)}
                                    onAdd={addListItem(setTestimonials, MAX_TESTIMONIALS, emptyTestimonial)}
                                    onRemove={removeListItem(setTestimonials)}
                                    max={MAX_TESTIMONIALS}
                                />
                            )}

                            {/* Contact Information */}
                            {activeFormTab === "contact" && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <Field label="Phone">
                                        <IconInput icon={Phone} placeholder="+91 XXXXXXXXXX" value={contact.phone} onChange={(e) => setContact((p) => ({ ...p, phone: e.target.value }))} />
                                    </Field>
                                    <Field label="Email">
                                        <IconInput icon={Mail} placeholder="you@company.com" value={contact.email} onChange={(e) => setContact((p) => ({ ...p, email: e.target.value }))} />
                                    </Field>
                                    <Field label="Website">
                                        <IconInput icon={Globe} placeholder="www.company.com" value={contact.website} onChange={(e) => setContact((p) => ({ ...p, website: e.target.value }))} />
                                    </Field>
                                    <Field label="Address">
                                        <IconInput icon={MapPin} placeholder="City, Country" value={contact.address} onChange={(e) => setContact((p) => ({ ...p, address: e.target.value }))} />
                                    </Field>
                                </div>
                            )}

                            {/* CTA Section */}
                            {activeFormTab === "cta" && (
                                <>
                                    <Field label="CTA Heading">
                                        <input className={inputClass} placeholder="Ready to get started?" value={cta.heading} onChange={(e) => setCta((p) => ({ ...p, heading: e.target.value }))} />
                                    </Field>
                                    <Field label="CTA Subtext">
                                        <input className={inputClass} placeholder="Talk to our team today." value={cta.subtext} onChange={(e) => setCta((p) => ({ ...p, subtext: e.target.value }))} />
                                    </Field>
                                    <Field label="Button Text">
                                        <input className={inputClass} placeholder="Get Started" value={cta.button} onChange={(e) => setCta((p) => ({ ...p, button: e.target.value }))} />
                                    </Field>
                                </>
                            )}

                            {/* Theme — same AI Theme Generator prompt-driven flow as before */}
                            {activeFormTab === "theme" && (
                                <>
                                    <div className="flex gap-2">
                                        <input
                                            className={inputClass}
                                            placeholder="Describe a design style..."
                                            value={aiPrompt}
                                            onChange={(e) => setAiPrompt(e.target.value)}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => generateAiTheme({ brand, product })}
                                            disabled={!aiPrompt.trim() || aiThemeLoading}
                                            className="shrink-0 inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl px-4 py-2.5 transition"
                                        >
                                            {aiThemeLoading ? <Loader2 size={15} className="animate-spin" /> : <Wand2 size={15} />}
                                        </button>
                                    </div>
                                    {aiThemeError && (
                                        <div className="flex items-center gap-2 text-xs text-red-400 border border-red-500/20 bg-red-500/[0.06] rounded-xl px-3 py-2.5">
                                            <AlertCircle size={13} className="shrink-0" /> {aiThemeError}
                                        </div>
                                    )}
                                    {aiTheme && (
                                        <div className="flex items-center justify-between text-[11px] text-gray-400">
                                            <span>
                                                Applied: <span className="text-orange-300 font-semibold">{aiTheme.themeName || "Custom Theme"}</span>
                                            </span>
                                            <button type="button" onClick={handleResetTheme} className="inline-flex items-center gap-1 text-gray-400 hover:text-white transition">
                                                <RotateCcw size={12} /> Reset
                                            </button>
                                        </div>
                                    )}

                                    <div className="pt-1">
                                        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-2">Font Style</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {FONT_OPTIONS.map((f) => {
                                                const isActive = selectedFontId === f.id;
                                                return (
                                                    <button
                                                        key={f.id}
                                                        type="button"
                                                        onClick={() => setSelectedFontId(f.id)}
                                                        className={`text-left rounded-lg border px-3 py-2 transition ${
                                                            isActive
                                                                ? "border-orange-500/60 bg-orange-500/[0.08]"
                                                                : "border-white/10 bg-white/[0.02] hover:border-white/20"
                                                        }`}
                                                        style={f.stack ? { fontFamily: f.stack } : undefined}
                                                    >
                                                        <span className={`text-[13px] ${isActive ? "text-orange-300" : "text-gray-200"}`}>{f.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                        {selectedFontId === "other" && (
                                            <input
                                                className={`${inputClass} mt-2.5`}
                                                placeholder="Type any font name, e.g. Nunito, Georgia, Roboto Slab..."
                                                value={customFontName}
                                                onChange={(e) => setCustomFontName(e.target.value)}
                                                style={{ fontFamily: selectedFontStack }}
                                            />
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ---- Live Preview ---- */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FileText size={14} className="text-orange-500" />
                        <h4 className="text-white text-sm font-semibold">Live Preview</h4>
                        <span className="text-[10.5px] font-medium text-gray-300 bg-white/[0.06] border border-white/10 rounded-full px-2.5 py-1">
                            {effectivePageCount ? `${effectivePageCount} page${effectivePageCount === 1 ? "" : "s"}` : "Single page"}
                        </span>
                        <span className="text-[10.5px] font-medium text-orange-300 bg-orange-500/10 border border-orange-500/20 rounded-full px-2.5 py-1">
                            {FLYER_TEMPLATES.find((t) => t.id === template)?.label} template
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => window.print()}
                            title="Print directly from the browser — every page prints as its own true-size A4 sheet"
                            className="inline-flex items-center gap-2 border border-white/10 hover:border-orange-400/40 text-gray-300 hover:text-orange-300 text-xs font-semibold rounded-xl px-4 py-2.5 transition"
                        >
                            <FileText size={14} /> Print
                        </button>

                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setDownloadMenuOpen((v) => !v)}
                                disabled={downloadingPreview}
                                className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-semibold rounded-xl px-4 py-2.5 transition"
                            >
                                {downloadingPreview ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                                {downloadingPreview ? `Exporting ${downloadFormat.toUpperCase()}...` : "Download"}
                                {!downloadingPreview && <ChevronDown size={14} />}
                            </button>

                            {downloadMenuOpen && !downloadingPreview && (
                                <>
                                    {/* Click-outside catcher */}
                                    <div className="fixed inset-0 z-10" onClick={() => setDownloadMenuOpen(false)} />
                                    <div className="absolute right-0 mt-2 w-40 bg-black border border-orange-600/30 rounded-xl overflow-hidden shadow-xl z-20">
                                        <button
                                            type="button"
                                            onClick={() => handleDownloadPreview("png")}
                                            className="w-full text-left px-4 py-3 text-sm font-semibold text-white hover:bg-orange-500/10 transition"
                                        >
                                            PNG Image
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDownloadPreview("pdf")}
                                            className="w-full text-left px-4 py-3 text-sm font-semibold text-white hover:bg-orange-500/10 transition border-t border-orange-600/10"
                                        >
                                            PDF Document
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Canvas the fixed-size A4 sheets sit on. #flyer-print-root
                    is the print scope: the @media print rules inside
                    FlyerPreview hide everything else on the page and print
                    only these sheets, one true-size A4 page at a time, when
                    the person hits "Print" (or Ctrl/Cmd+P). The inner
                    ref={previewRef} div is what gets captured for the PNG/PDF
                    download above — same html2canvas-pro + jsPDF snapshot
                    pattern as the Feature Card, so what downloads is a
                    pixel-for-pixel match of exactly what's rendered here. */}
                <div id="flyer-print-root" ref={previewScrollRef} className="rounded-2xl border border-white/5 bg-black/40 p-6 overflow-y-auto" style={{ maxHeight: previewMaxHeight ? `${previewMaxHeight}px` : undefined }}>
                    <div ref={previewRef} className="w-fit mx-auto">
                        <FlyerPreview
                            layout={layout}
                            template={template}
                            theme={activeTheme}
                            brand={brand}
                            product={product}
                            problemStatement={problemStatement}
                            solutionStatement={solutionStatement}
                            features={features}
                            benefits={benefits}
                            whyChooseUs={whyChooseUs}
                            screenshots={screenshots}
                            pricingEnabled={pricingEnabled}
                            pricingPlans={pricingPlans}
                            testimonials={testimonials}
                            contact={contact}
                            cta={cta}
                            logoPreview={logoPreview}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

// ---------- Module picker card (sleek / premium) ----------
// Designed to look finished at rest, not just on hover: a two-layer
// shadow (a soft dark drop shadow for lift + a warm orange glow under
// it) gives the glass real elevation, the icon chip carries its own
// gentle glow, and the footer control reads as a real pill button
// rather than bare text. Hover simply turns all of that up.
const PremiumModuleCard = ({ icon: Icon, eyebrow, title, description, status = "Ready", onOpen }) => (
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
            <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-orange-200/50">{eyebrow}</span>
        </div>

        <h3 className="relative mt-5 text-[18px] font-semibold tracking-tight text-white">{title}</h3>
        <p className="relative mt-2 text-[13.5px] leading-relaxed text-zinc-400">{description}</p>

        <div className="relative mt-6 flex items-center justify-between border-t border-white/[0.08] pt-4">
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-zinc-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500/80" />
                {status}
            </span>
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

const MediaSection = () => {
    // null = show the two entry cards, "feature" = Feature Card page,
    // "flyer" = Flyer Generation page.
    const [activeView, setActiveView] = useState(null);

    return (
        <div id="sec-media" className="h-full flex flex-col py-6 overflow-hidden pr-1">
            {/* Header */}
            <div className="shrink-0">
                <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
                    <ImageIcon className="text-orange-500" size={26} />
                    Media
                </h1>
                <p className="text-gray-400 mt-1.5 text-sm">
                    Manage images, videos, and other assets used across your campaigns.
                </p>
            </div>

            {/* Entry point: two cards — Feature Card / Flyer Generation.
                Sleek/glass treatment: bordered icon mark, hairline rules,
                a corner mark as the one signature detail, minimal text
                link instead of a boxed button. */}
            {activeView === null && (
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-3xl shrink-0">
                    <PremiumModuleCard
                        icon={Sparkles}
                        eyebrow="Design Tool"
                        title="Feature Card"
                        description="Create and manage feature highlight cards for your products."
                        onOpen={() => setActiveView("feature")}
                    />
                    <PremiumModuleCard
                        icon={FileText}
                        eyebrow="Auto-Generate"
                        title="Flyer Generation"
                        description="Generate shareable flyers for your products automatically."
                        onOpen={() => setActiveView("flyer")}
                    />
                </div>
            )}

            {/* Feature Card page */}
            {activeView === "feature" && (
                <div className="flex-1 min-h-0 flex flex-col">
                    <button
                        type="button"
                        onClick={() => setActiveView(null)}
                        className="mt-6 shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-orange-400 transition w-fit"
                    >
                        <ArrowLeft size={14} /> Back
                    </button>
                    <div className="flex items-center gap-2 mt-4 shrink-0">
                        <Sparkles size={16} className="text-orange-500" />
                        <h2 className="text-sm font-semibold text-white">Feature Card</h2>
                    </div>
                    <FeatureCardView />
                </div>
            )}

            {/* Flyer Generation page */}
            {activeView === "flyer" && (
                <div className="flex-1 min-h-0 flex flex-col">
                    <button
                        type="button"
                        onClick={() => setActiveView(null)}
                        className="mt-6 shrink-0 inline-flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-orange-400 transition w-fit"
                    >
                        <ArrowLeft size={14} /> Back
                    </button>
                    <div className="flex items-center gap-2 mt-4 shrink-0">
                        <FileText size={16} className="text-orange-500" />
                        <h2 className="text-sm font-semibold text-white">Flyer Generation</h2>
                    </div>
                    <FlyerGenerationView />
                </div>
            )}
        </div>
    );
};

export default MediaSection;