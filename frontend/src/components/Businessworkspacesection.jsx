import React, { useState, useEffect, useRef, useMemo } from "react";
import * as XLSX from "xlsx"; // Excel import/export for Team & Users — run `npm install xlsx` if not already a dependency
import {
    Briefcase,
    Lightbulb,
    CheckCircle,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Plus,
    X,
    Wallet,
    Clock,
    Tag,
    Package,
    Wrench,
    CreditCard,
    Shuffle,
    Settings2,
    GripVertical,
    Trash2,
    UserRound,
    Phone,
    Monitor,
    FileText,
    CheckCircle2,
    Circle,
    Target,
    Users,
    Plug,
    BookOpen,
    SlidersHorizontal,
    Flag,
    Search,
    Eye,
    Pencil,
    MoreVertical,
    Bot,
    MessageCircle,
    LayoutGrid,
    Mail,
    Copy,
    Check,
    Download,
    Upload,
    FileSpreadsheet,
    UploadCloud,
} from "lucide-react";

/* ==========================================================
   Business Workspace
   Matches the reference screen: header (Guide + Save Changes),
   a 9-tab bar, a hero banner, editable cards, and a tip strip.

   Business Model / Deal Size / Sales Cycle / Pricing Model /
   Services Offered / Subscription Plan / Sales Process now load
   from and save to the backend (GET/PUT /business-info), scoped
   to the logged-in company via the JWT — no more localStorage.

   Products Offered is read-only here and comes straight from
   GET /products (the same per-company `company_products` table
   used on the Home page) — every company login only ever sees
   its own products, and editing them happens on the Products
   page, not duplicated here.

   The Subscription Plans dropdown loads its options from
   GET /dropdown-options/subscription_plan, the same shared
   dropdown-options table used for Industry/Company Type "Other"
   values — seed it with your real plan names (see main.py).

   NOTE: API_BASE and the auth-token key below are placeholders —
   point them at your existing API client / token storage if the
   app already has one, so this doesn't create a second convention.
========================================================== */

const API_BASE = import.meta.env?.VITE_API_BASE_URL || "http://localhost:8000";
const AUTH_TOKEN_KEY = "growthos_token"; // adjust to match your existing login flow

const authHeaders = () => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    return token ? { Authorization: `Bearer ${token}` } : {};
};

const apiGet = async (path) => {
    const res = await fetch(`${API_BASE}${path}`, { headers: { ...authHeaders() } });
    if (!res.ok) throw new Error(`GET ${path} failed (${res.status})`);
    return res.json();
};

const apiPut = async (path, body) => {
    const res = await fetch(`${API_BASE}${path}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`PUT ${path} failed (${res.status})`);
    return res.json();
};

const apiPatch = async (path, body) => {
    const res = await fetch(`${API_BASE}${path}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`PATCH ${path} failed (${res.status})`);
    return res.json();
};

const apiPost = async (path, body) => {
    const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`POST ${path} failed (${res.status})`);
    return res.json();
};

const apiDelete = async (path) => {
    const res = await fetch(`${API_BASE}${path}`, {
        method: "DELETE",
        headers: { ...authHeaders() },
    });
    if (!res.ok) throw new Error(`DELETE ${path} failed (${res.status})`);
    return res.json();
};

const TABS = [
    { label: "Business Info", icon: Briefcase },
    { label: "Products & Services", icon: Package },
    { label: "Target Audience", icon: Target },
    { label: "Team & Users", icon: Users },
    { label: "Integrations", icon: Plug },
    { label: "AI Knowledge Base", icon: BookOpen },
    { label: "AI Preferences", icon: SlidersHorizontal },
    { label: "Business Goals", icon: Flag },
];

const BUSINESS_MODEL_OPTIONS = ["SaaS Subscription", "One-Time License", "Marketplace", "Usage-Based", "Hybrid"];
const PRICING_MODEL_OPTIONS = ["Tiered Pricing", "Flat Rate", "Usage-Based", "Freemium", "Custom Quote"];
// Fallback only — shown until GET /dropdown-options/subscription_plan
// returns the platform's real named plans. Replace with your actual
// plan names once seeded in the DB (see main.py's DROPDOWN_ALLOWED_FIELDS note).
const FALLBACK_PLAN_OPTIONS = ["Starter", "Growth", "Pro"];

// Target Audience tab — plain static lists, same treatment as
// BUSINESS_MODEL_OPTIONS/PRICING_MODEL_OPTIONS above, PLUS an "Other"
// option (appended automatically by SelectFieldWithOther, not listed
// here) that lets a company type a value that isn't in the list yet.
// Typing a custom value POSTs it to the shared custom_dropdown_options
// table (same one industry_sector/company_type/subscription_plan use),
// so the next company to open this tab sees it as a normal option too.
const COUNTRY_OPTIONS = ["India", "United States", "United Kingdom", "UAE", "Australia", "Singapore"];

// Full India states/UTs list. State (and City) only offer a pick-from-list
// experience when the selected Country is "India" — for any other country
// there's no maintained list, so State/City fall back to free-typing (same
// pattern as before), per the agreed scope: detailed cascading data for
// India only.
const STATE_OPTIONS = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
    "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya",
    "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim",
    "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
    "West Bengal", "Delhi NCR", "Chandigarh", "Jammu & Kashmir", "Ladakh",
    "Puducherry",
];

// City options for the City field are derived from this map based on
// whichever India state(s) are currently selected (union of their cities).
// Not exhaustive — states/UTs without a curated list here simply fall back
// to free-typing for City, same as any non-India country.
const INDIA_STATE_CITIES = {
    "Maharashtra": ["Mumbai", "Pune", "Nagpur", "Nashik", "Thane", "Aurangabad"],
    "Karnataka": ["Bengaluru", "Mysuru", "Mangaluru", "Hubballi"],
    "Delhi NCR": ["New Delhi", "Gurugram", "Noida", "Faridabad", "Ghaziabad"],
    "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Tiruchirappalli"],
    "Gujarat": ["Ahmedabad", "Surat", "Vadodara", "Rajkot"],
    "Telangana": ["Hyderabad", "Warangal"],
    "West Bengal": ["Kolkata", "Howrah", "Siliguri"],
    "Uttar Pradesh": ["Lucknow", "Kanpur", "Noida", "Ghaziabad", "Varanasi", "Agra"],
    "Rajasthan": ["Jaipur", "Jodhpur", "Udaipur", "Kota"],
    "Punjab": ["Chandigarh", "Ludhiana", "Amritsar", "Jalandhar"],
    "Haryana": ["Gurugram", "Faridabad", "Panipat"],
    "Kerala": ["Kochi", "Thiruvananthapuram", "Kozhikode"],
    "Madhya Pradesh": ["Bhopal", "Indore", "Gwalior", "Jabalpur"],
    "Bihar": ["Patna", "Gaya"],
    "Andhra Pradesh": ["Visakhapatnam", "Vijayawada", "Guntur"],
    "Odisha": ["Bhubaneswar", "Cuttack"],
    "Jharkhand": ["Ranchi", "Jamshedpur"],
    "Chhattisgarh": ["Raipur", "Bhilai"],
    "Assam": ["Guwahati"],
    "Himachal Pradesh": ["Shimla"],
    "Uttarakhand": ["Dehradun", "Haridwar"],
    "Goa": ["Panaji", "Margao"],
    "Chandigarh": ["Chandigarh"],
    "Puducherry": ["Puducherry"],
};
const TARGET_INDUSTRY_OPTIONS = [
    "Education", "Healthcare", "Retail & E-commerce", "Real Estate",
    "Manufacturing", "Financial Services", "Hospitality", "Technology / SaaS",
];
const COMPANY_SIZE_OPTIONS = [
    "1 - 10 Employees", "11 - 50 Employees", "50 - 200 Employees",
    "200 - 500 Employees", "500+ Employees",
];
// Label only — the underlying field is generic ("customer_count") since
// what counts as "the customer" varies per company (e.g. "Student Count"
// for an edtech company, "Bed Count" for healthcare). Change this one
// string per deployment/vertical rather than the schema or state key.
const CUSTOMER_COUNT_LABEL = "Customer Count";
const CUSTOMER_COUNT_OPTIONS = ["Under 100", "100 - 500", "500 - 5,000", "5,000 - 20,000", "20,000+"];

// Maps each Target Audience select's local state key to the backend's
// custom_dropdown_options field_name (must be in DROPDOWN_ALLOWED_FIELDS
// in main.py) — used both to load existing custom values on mount and
// to POST a newly-typed "Other" value.
const TARGET_DROPDOWN_FIELD_MAP = {
    country: "target_country",
    state: "target_state",
    industry: "target_industry",
    companySize: "target_company_size",
    customerCount: "target_customer_count",
};

const STAGE_ICONS = [
    { match: /lead/i, icon: UserRound },
    { match: /contact/i, icon: Phone },
    { match: /demo/i, icon: Monitor },
    { match: /propos|quote/i, icon: FileText },
    { match: /clos|won/i, icon: CheckCircle2 },
];
const iconForStage = (label) => (STAGE_ICONS.find((s) => s.match.test(label)) || {}).icon || Circle;

/* ---------- Products & Services: icon + color per product ---------- */

const PRODUCT_ICON_RULES = [
    { match: /chat|bot|assistant/i, icon: Bot },
    { match: /lms|learn|course|education/i, icon: BookOpen },
    { match: /whatsapp|sms|message/i, icon: MessageCircle },
    { match: /crm|sales/i, icon: Users },
];
const iconForProduct = (product) =>
    (PRODUCT_ICON_RULES.find((r) => r.match.test(`${product.category || ""} ${product.product_name || ""}`)) || {})
        .icon || Package;

const PRODUCT_TINTS = ["#3b82f6", "#a855f7", "#22c55e", "#f97316", "#ec4899"];
const tintForIndex = (i) => PRODUCT_TINTS[i % PRODUCT_TINTS.length];

const formatPrice = (price) => {
    const n = Number(price) || 0;
    return `₹${n.toLocaleString("en-IN")} / mo`;
};

/* ---------- AI Knowledge Base: file-type badges + formatters ---------- */

const KNOWLEDGE_ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx,.txt";
const KNOWLEDGE_MAX_MB = 30;
const KNOWLEDGE_FILE_TINTS = {
    pdf: "#ef4444",
    doc: "#3b82f6",
    docx: "#3b82f6",
    ppt: "#f97316",
    pptx: "#f97316",
    txt: "#6b7280",
};

// Groups the "PDF / DOCX / PPT / TXT" filter chips (Upload Knowledge card)
// map to when clicked — doc+docx count as one "DOCX" chip, ppt+pptx count
// as one "PPT" chip, so the Knowledge Library filters by file family, not
// just a single raw extension.
const KNOWLEDGE_TYPE_FILTERS = [
    { key: "pdf", label: "PDF", exts: ["pdf"], tint: KNOWLEDGE_FILE_TINTS.pdf },
    { key: "docx", label: "DOCX", exts: ["doc", "docx"], tint: KNOWLEDGE_FILE_TINTS.docx },
    { key: "ppt", label: "PPT", exts: ["ppt", "pptx"], tint: KNOWLEDGE_FILE_TINTS.ppt },
    { key: "txt", label: "TXT", exts: ["txt"], tint: KNOWLEDGE_FILE_TINTS.txt },
];

const extensionOf = (fileName) => (fileName.split(".").pop() || "").toLowerCase();

const tintForExtension = (ext) => KNOWLEDGE_FILE_TINTS[ext] || "#6b7280";

const formatFileSize = (bytes) => {
    const n = Number(bytes) || 0;
    if (n <= 0) return "—";
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

const formatUploadedDate = (value) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

/* ---------- tiny CSV helpers (Team & Users import/export) ----------
   Hand-rolled instead of pulling in a CSV library — the shape here is
   simple (a handful of plain-text columns, no nested data), so a small
   quote-aware parser covers it without adding a dependency. Excel
   import/export goes through the `xlsx` package instead (see
   TeamUsersTab) since .xlsx is a binary zip format, not something a
   hand-rolled parser can read. */

// Excel cells can come back as numbers/booleans/dates, not just
// strings (e.g. a phone-number-shaped role typed as a number) — this
// keeps every cell access safe before .trim()/.toLowerCase() calls,
// regardless of whether the row came from CSV text or a parsed sheet.
const cellStr = (v) => String(v ?? "").trim();

const csvEscapeField = (val) => {
    const s = String(val ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const buildCsv = (headerRow, dataRows) =>
    [headerRow, ...dataRows].map((row) => row.map(csvEscapeField).join(",")).join("\r\n");

const downloadCsv = (filename, csvText) => {
    const blob = new Blob(["\uFEFF" + csvText], { type: "text/csv;charset=utf-8;" }); // BOM so Excel opens UTF-8 cleanly
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
};

// Quote-aware CSV parser: handles commas/newlines inside "quoted" fields
// and "" as an escaped quote. Returns an array of rows, each an array
// of raw string cells (no trimming/typing — callers handle that).
const parseCsvRows = (text) => {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    const pushField = () => {
        row.push(field);
        field = "";
    };
    const pushRow = () => {
        pushField();
        rows.push(row);
        row = [];
    };
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += c;
            }
        } else if (c === '"') {
            inQuotes = true;
        } else if (c === ",") {
            pushField();
        } else if (c === "\n") {
            pushRow();
        } else if (c === "\r") {
            // skip — \r\n line endings are handled by the \n branch above
        } else {
            field += c;
        }
    }
    if (field.length > 0 || row.length > 0) pushRow();
    return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
};

const DEFAULT_STATE = {
    businessModel: BUSINESS_MODEL_OPTIONS[0],
    dealSize: "1,25,000",
    salesCycle: "45",
    pricingModel: PRICING_MODEL_OPTIONS[0],
    services: ["Implementation", "Training", "Support", "Customization"],
    plans: FALLBACK_PLAN_OPTIONS[0],
    stages: ["Lead", "Contacted", "Demo", "Proposal", "Closed"],
    // products is intentionally NOT here — it's loaded separately from
    // GET /products (read-only, per-company) rather than kept in this
    // editable business-info state.
};

const DEFAULT_TARGET_AUDIENCE_STATE = {
    country: COUNTRY_OPTIONS[0],
    state: [],
    cities: [],
    industry: TARGET_INDUSTRY_OPTIONS[0],
    companySize: COMPANY_SIZE_OPTIONS[0],
    customerCount: CUSTOMER_COUNT_OPTIONS[0],
    decisionMakers: [],
    designations: [],
    painPoints: [],
    budgetRange: "",
    keywords: [],
};

/* ---------- small building blocks ---------- */

const IconBadge = ({ icon: Icon, tint }) => (
    <div
        className="h-9 w-9 rounded-full flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${tint}1f`, color: tint }}
    >
        <Icon size={16} />
    </div>
);

const Card = ({ title, icon, tint, action, children, className = "" }) => (
    <div className={`bg-[#0d0d0d] border border-white/[0.08] rounded-xl p-5 flex flex-col gap-4 ${className}`}>
        {(title || action) && (
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    {icon && <IconBadge icon={icon} tint={tint} />}
                    {title && <p className="text-[13px] font-semibold text-gray-200 truncate">{title}</p>}
                </div>
                {action}
            </div>
        )}
        {children}
    </div>
);

const SelectField = ({ value, onChange, options }) => (
    <div className="relative">
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full appearance-none bg-black/40 border border-white/10 rounded-lg pl-3 pr-8 py-2.5 text-sm text-gray-200 hover:border-orange-500/30 focus:border-orange-500/50 focus:outline-none transition cursor-pointer"
        >
            {options.map((opt) => (
                <option key={opt} value={opt} className="bg-[#111]">
                    {opt}
                </option>
            ))}
        </select>
        <ChevronDown size={15} className="text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
);

// Union of a fallback list and whatever's been saved to the backend so
// far, deduped case-insensitively, fallback order first. Used to build
// the option list shown in a SelectFieldWithOther.
const mergeOptions = (fallback, custom) => {
    const seen = new Set();
    const out = [];
    for (const v of [...fallback, ...custom]) {
        const key = v.trim().toLowerCase();
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push(v);
    }
    return out;
};

// Same as SelectField, plus a built-in "Other" option: picking it swaps
// the dropdown for a text input, and submitting that input calls
// onAddCustom(value) — the parent is expected to POST it to
// /dropdown-options/{field} and fold it into `options` so it shows up
// as a normal choice from then on (for this company and every other one,
// since custom_dropdown_options is shared).
const SelectFieldWithOther = ({ value, onChange, options, onAddCustom }) => {
    const [addingCustom, setAddingCustom] = useState(false);
    const [customValue, setCustomValue] = useState("");
    const [saving, setSaving] = useState(false);

    const handleSelectChange = (v) => {
        if (v === "__other__") {
            setCustomValue("");
            setAddingCustom(true);
        } else {
            onChange(v);
        }
    };

    const submitCustom = async () => {
        const trimmed = customValue.trim();
        if (!trimmed) {
            setAddingCustom(false);
            return;
        }
        setSaving(true);
        try {
            await onAddCustom(trimmed);
            setAddingCustom(false);
        } catch (err) {
            console.error("Failed to save custom option:", err);
            // Leave the input open so the person can retry instead of losing what they typed.
        } finally {
            setSaving(false);
        }
    };

    if (addingCustom) {
        return (
            <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-lg px-3 py-2 focus-within:border-orange-500/40 transition">
                <input
                    autoFocus
                    value={customValue}
                    disabled={saving}
                    onChange={(e) => setCustomValue(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") submitCustom();
                        if (e.key === "Escape") setAddingCustom(false);
                    }}
                    placeholder="Type a value, press Enter…"
                    className="w-full bg-transparent text-sm text-gray-200 outline-none min-w-0 placeholder:text-gray-600"
                />
                <button
                    type="button"
                    onClick={submitCustom}
                    disabled={saving}
                    className="text-xs text-orange-500 hover:text-orange-400 font-semibold shrink-0 disabled:opacity-50"
                >
                    {saving ? "Saving…" : "Add"}
                </button>
                <button
                    type="button"
                    onClick={() => setAddingCustom(false)}
                    disabled={saving}
                    className="text-gray-500 hover:text-gray-300 shrink-0"
                    aria-label="Cancel"
                >
                    <X size={13} />
                </button>
            </div>
        );
    }

    return (
        <div className="relative">
            <select
                value={value}
                onChange={(e) => handleSelectChange(e.target.value)}
                className="w-full appearance-none bg-black/40 border border-white/10 rounded-lg pl-3 pr-8 py-2.5 text-sm text-gray-200 hover:border-orange-500/30 focus:border-orange-500/50 focus:outline-none transition cursor-pointer"
            >
                {/* If a previously-saved value isn't in the known list yet
                    (e.g. loaded before the custom-options fetch resolved),
                    show it anyway so the select doesn't silently jump to
                    the first option. */}
                {value && !options.includes(value) && (
                    <option value={value} className="bg-[#111]">
                        {value}
                    </option>
                )}
                {options.map((opt) => (
                    <option key={opt} value={opt} className="bg-[#111]">
                        {opt}
                    </option>
                ))}
                <option value="__other__" className="bg-[#111]">
                    Other…
                </option>
            </select>
            <ChevronDown size={15} className="text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
    );
};

const TextField = ({ value, onChange, prefix, suffix }) => (
    <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-lg px-3 py-2.5 focus-within:border-orange-500/40 transition">
        {prefix && <span className="text-sm text-gray-500 shrink-0">{prefix}</span>}
        <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full bg-transparent text-sm text-gray-200 outline-none min-w-0"
        />
        {suffix && <span className="text-sm text-gray-500 shrink-0">{suffix}</span>}
    </div>
);

const Pill = ({ children, onRemove }) => (
    <span className="group flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-gray-300">
        {children}
        <button
            type="button"
            onClick={onRemove}
            className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition"
            aria-label={`Remove ${children}`}
        >
            <X size={11} />
        </button>
    </span>
);

const PillEditor = ({ items, onAdd, onRemove, addLabel, example }) => {
    const [adding, setAdding] = useState(false);
    const [draft, setDraft] = useState("");
    const inputRef = useRef(null);

    useEffect(() => {
        if (adding) inputRef.current?.focus();
    }, [adding]);

    const commit = () => {
        const v = draft.trim();
        if (v) onAdd(v);
        setDraft("");
        setAdding(false);
    };

    return (
        <div className="flex flex-wrap items-center gap-2">
            {items.map((item) => (
                <Pill key={item} onRemove={() => onRemove(item)}>
                    {item}
                </Pill>
            ))}
            {adding ? (
                <input
                    ref={inputRef}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") commit();
                        if (e.key === "Escape") {
                            setDraft("");
                            setAdding(false);
                        }
                    }}
                    onBlur={commit}
                    placeholder={example ? `e.g. ${example}` : "Type & press Enter"}
                    className="px-3 py-1.5 rounded-full bg-black/40 border border-orange-500/30 text-xs text-gray-200 outline-none w-48 placeholder:text-gray-600 placeholder:italic"
                />
            ) : (
                <button
                    type="button"
                    onClick={() => setAdding(true)}
                    className="px-3 py-1.5 rounded-full border border-dashed border-white/15 text-xs text-gray-400 hover:border-orange-500/40 hover:text-orange-400 hover:bg-orange-500/10 transition flex items-center gap-1"
                >
                    <Plus size={12} />
                    {addLabel}
                </button>
            )}
        </div>
    );
};

// Multi-select combobox used for fields where more than one value can be
// picked (e.g. State, City). Selected values render as removable pills.
// Clicking "+ Add" opens a small panel: if `options` is non-empty it lists
// the remaining pickable values (click to add, stays open for picking more),
// plus a text input at the bottom for typing a value that isn't in the list.
// If `options` is empty, the panel is just the free-type input (same feel
// as PillEditor). Pass `onAddCustom` to persist a typed value to the shared
// backend dropdown-options table (like SelectFieldWithOther); omit it to
// just add the typed value locally (e.g. City, which isn't shared/persisted).
const MultiSelectField = ({ value, onAdd, onRemove, options = [], onAddCustom, addLabel = "Add", placeholder = "Type & press Enter" }) => {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState("");
    const [saving, setSaving] = useState(false);
    const wrapRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        const onClickAway = (e) => {
            if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", onClickAway);
        return () => document.removeEventListener("mousedown", onClickAway);
    }, [open]);

    const hasList = options.length > 0;
    const available = options.filter((o) => !value.includes(o));

    const commitCustom = async () => {
        const v = draft.trim();
        if (!v || value.includes(v)) {
            setDraft("");
            return;
        }
        if (onAddCustom) {
            setSaving(true);
            try {
                await onAddCustom(v);
                setDraft("");
            } catch (err) {
                console.error("Failed to save custom option:", err);
                // Leave the input open so the person can retry.
            } finally {
                setSaving(false);
            }
        } else {
            onAdd(v);
            setDraft("");
        }
    };

    return (
        <div className="relative" ref={wrapRef}>
            <div className="flex flex-wrap items-center gap-2">
                {value.map((item) => (
                    <Pill key={item} onRemove={() => onRemove(item)}>
                        {item}
                    </Pill>
                ))}
                <button
                    type="button"
                    onClick={() => setOpen((v) => !v)}
                    className="px-3 py-1.5 rounded-full border border-dashed border-white/15 text-xs text-gray-400 hover:border-orange-500/40 hover:text-orange-400 hover:bg-orange-500/10 transition flex items-center gap-1"
                >
                    <Plus size={12} />
                    {addLabel}
                </button>
            </div>

            {open && (
                <div className="absolute z-20 mt-2 w-64 rounded-lg bg-[#161616] border border-white/10 shadow-xl p-2">
                    {hasList && (
                        <div className="max-h-40 overflow-y-auto space-y-0.5 mb-1.5">
                            {available.length > 0 ? (
                                available.map((opt) => (
                                    <button
                                        key={opt}
                                        type="button"
                                        onClick={() => onAdd(opt)}
                                        className="w-full text-left px-2.5 py-1.5 rounded-md text-xs text-gray-300 hover:bg-orange-500/10 hover:text-orange-400 transition"
                                    >
                                        {opt}
                                    </button>
                                ))
                            ) : (
                                <p className="px-2.5 py-1.5 text-xs text-gray-600">All options selected</p>
                            )}
                        </div>
                    )}
                    <div className={`flex items-center gap-1.5 ${hasList ? "pt-1.5 border-t border-white/5" : ""}`}>
                        <input
                            autoFocus={!hasList}
                            value={draft}
                            disabled={saving}
                            onChange={(e) => setDraft(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") commitCustom();
                                if (e.key === "Escape") setOpen(false);
                            }}
                            placeholder={placeholder}
                            className="flex-1 min-w-0 bg-black/40 border border-white/10 focus:border-orange-500/50 rounded-md px-2.5 py-1.5 text-xs text-gray-200 outline-none placeholder:text-gray-600 placeholder:italic transition"
                        />
                        <button
                            type="button"
                            onClick={commitCustom}
                            disabled={saving}
                            className="text-xs text-orange-500 hover:text-orange-400 font-semibold shrink-0 disabled:opacity-50 px-1"
                        >
                            {saving ? "…" : "Add"}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

/* ---------- decorative banner illustration (abstract, original) ---------- */

const InsightsIllustration = () => (
    <svg viewBox="0 0 220 110" className="w-56 h-28 shrink-0 hidden md:block" aria-hidden="true">
        <defs>
            <linearGradient id="bwsBarGrad" x1="0" y1="1" x2="0" y2="0">
                <stop offset="0%" stopColor="#f97316" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#f97316" stopOpacity="0.9" />
            </linearGradient>
            <radialGradient id="bwsGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#f97316" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
            </radialGradient>
        </defs>
        <circle cx="60" cy="60" r="55" fill="url(#bwsGlow)" />
        <circle cx="55" cy="62" r="26" fill="none" stroke="#3f2a1a" strokeWidth="12" />
        <circle
            cx="55"
            cy="62"
            r="26"
            fill="none"
            stroke="#f97316"
            strokeWidth="12"
            strokeDasharray="98 163"
            strokeLinecap="round"
            transform="rotate(-90 55 62)"
        />
        {[
            { x: 118, h: 28 },
            { x: 138, h: 42 },
            { x: 158, h: 34 },
            { x: 178, h: 56 },
            { x: 198, h: 70 },
        ].map((b) => (
            <rect key={b.x} x={b.x} y={92 - b.h} width="14" height={b.h} rx="3" fill="url(#bwsBarGrad)" />
        ))}
        <polyline
            points="112,70 132,50 152,58 172,32 200,14"
            fill="none"
            stroke="#fb923c"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        <polygon points="200,14 210,16 202,24" fill="#fb923c" />
    </svg>
);

/* ---------- decorative banner illustration for Target Audience (abstract, original) ---------- */

const TargetAudienceIllustration = () => (
    <svg viewBox="0 0 200 190" className="w-40 h-40 shrink-0 hidden md:block" aria-hidden="true">
        <defs>
            <radialGradient id="taGlow" cx="50%" cy="42%" r="55%">
                <stop offset="0%" stopColor="#f97316" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
            </radialGradient>
        </defs>
        <circle cx="100" cy="80" r="85" fill="url(#taGlow)" />
        <circle cx="100" cy="80" r="60" fill="none" stroke="#3f2a1a" strokeWidth="4" />
        <circle cx="100" cy="80" r="44" fill="none" stroke="#f97316" strokeWidth="4" opacity="0.55" />
        <circle cx="100" cy="80" r="28" fill="none" stroke="#f97316" strokeWidth="5" opacity="0.8" />
        <circle cx="100" cy="80" r="12" fill="#f97316" opacity="0.9" />
        <line x1="60" y1="122" x2="118" y2="62" stroke="#fb923c" strokeWidth="4" strokeLinecap="round" />
        <polygon points="118,62 132,52 122,72" fill="#fb923c" />
        {[
            { cx: 70, fill: "#60a5fa" },
            { cx: 100, fill: "#f97316" },
            { cx: 130, fill: "#e2725b" },
        ].map((p) => (
            <g key={p.cx}>
                <circle cx={p.cx} cy="152" r="11" fill={p.fill} opacity="0.85" />
                <path d={`M ${p.cx - 16} 182 Q ${p.cx} 158 ${p.cx + 16} 182 Z`} fill={p.fill} opacity="0.85" />
            </g>
        ))}
    </svg>
);

const Field = ({ label, children, className = "" }) => (
    <div className={`flex flex-col gap-2 min-w-0 ${className}`}>
        <label className="text-sm text-gray-300">{label}</label>
        {children}
    </div>
);

/* ---------- Manage Stages modal ---------- */

const ManageStagesModal = ({ stages, onClose, onSave }) => {
    const [draftStages, setDraftStages] = useState(stages);
    const [newStage, setNewStage] = useState("");

    const move = (i, dir) => {
        const next = [...draftStages];
        const j = i + dir;
        if (j < 0 || j >= next.length) return;
        [next[i], next[j]] = [next[j], next[i]];
        setDraftStages(next);
    };

    const remove = (i) => setDraftStages(draftStages.filter((_, idx) => idx !== i));

    const add = () => {
        const v = newStage.trim();
        if (!v) return;
        setDraftStages([...draftStages, v]);
        setNewStage("");
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/70" onClick={onClose} />
            <div className="relative z-10 w-full max-w-md bg-[#111111] border border-orange-600/20 rounded-xl p-5 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                    <p className="text-white font-semibold">Manage Sales Stages</p>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition">
                        <X size={18} />
                    </button>
                </div>

                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {draftStages.map((stage, i) => {
                        const Icon = iconForStage(stage);
                        return (
                            <div
                                key={`${stage}-${i}`}
                                className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-lg px-2.5 py-2"
                            >
                                <GripVertical size={14} className="text-gray-600 shrink-0" />
                                <Icon size={14} className="text-orange-500 shrink-0" />
                                <input
                                    value={stage}
                                    onChange={(e) => {
                                        const next = [...draftStages];
                                        next[i] = e.target.value;
                                        setDraftStages(next);
                                    }}
                                    className="flex-1 min-w-0 bg-transparent text-sm text-gray-200 outline-none"
                                />
                                <button
                                    onClick={() => move(i, -1)}
                                    disabled={i === 0}
                                    className="text-gray-500 hover:text-orange-400 disabled:opacity-20 transition text-xs px-1"
                                    aria-label="Move up"
                                >
                                    ▲
                                </button>
                                <button
                                    onClick={() => move(i, 1)}
                                    disabled={i === draftStages.length - 1}
                                    className="text-gray-500 hover:text-orange-400 disabled:opacity-20 transition text-xs px-1"
                                    aria-label="Move down"
                                >
                                    ▼
                                </button>
                                <button onClick={() => remove(i)} className="text-gray-500 hover:text-red-400 transition">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        );
                    })}
                </div>

                <div className="flex items-center gap-2 mt-3">
                    <input
                        value={newStage}
                        onChange={(e) => setNewStage(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && add()}
                        placeholder="New stage name"
                        className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-orange-500/40"
                    />
                    <button
                        onClick={add}
                        className="flex items-center gap-1 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-200 text-sm px-3 py-2 rounded-lg transition"
                    >
                        <Plus size={14} />
                        Add
                    </button>
                </div>

                <div className="flex items-center justify-end gap-2 mt-5">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white transition">
                        Cancel
                    </button>
                    <button
                        onClick={() => onSave(draftStages)}
                        className="px-4 py-2 rounded-lg text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white transition"
                    >
                        Save Stages
                    </button>
                </div>
            </div>
        </div>
    );
};

/* ---------- Business Info tab (receives lifted state from the shell) ---------- */

const BusinessInfoTab = ({ data, setData, showGuide, setShowGuide, products, productsLoading, planOptions }) => {
    const [stagesModalOpen, setStagesModalOpen] = useState(false);
    const set = (key) => (value) => setData((prev) => ({ ...prev, [key]: value }));

    return (
        <div className="space-y-5">
            {showGuide && (
                <div className="bg-[#0d0d0d] border border-orange-600/20 rounded-xl p-4 flex items-start gap-3">
                    <Lightbulb size={16} className="text-orange-500 mt-0.5 shrink-0" />
                    <p className="text-xs text-gray-400 leading-relaxed">
                        Business Model sets how you sell, Pricing Model and Subscription Plans shape quotes, and
                        Products/Services Offered feed the AI's recommendations. Sales Process controls the stages
                        used across Sales Pipeline and Customer 360.
                    </p>
                    <button
                        onClick={() => setShowGuide(false)}
                        className="ml-auto text-gray-500 hover:text-white transition shrink-0"
                    >
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Hero banner */}
            <div className="relative overflow-hidden bg-gradient-to-br from-[#1a1006] to-[#0d0d0d] border border-orange-600/20 rounded-xl p-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                    <div className="h-12 w-12 rounded-xl bg-orange-500/15 flex items-center justify-center text-orange-500 shrink-0">
                        <Briefcase size={22} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-white font-semibold text-lg leading-none">Business Information</p>
                        <p className="text-sm text-gray-500 mt-2">
                            Define your business model, offerings, pricing and sales process
                        </p>
                    </div>
                </div>
                <InsightsIllustration />
            </div>

            {/* Model / deal size / sales cycle / pricing */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                <Card title="Business Model" icon={Briefcase} tint="#f97316">
                    <SelectField value={data.businessModel} onChange={set("businessModel")} options={BUSINESS_MODEL_OPTIONS} />
                </Card>
                <Card title="Average Deal Size" icon={Wallet} tint="#a855f7">
                    <TextField value={data.dealSize} onChange={set("dealSize")} prefix="₹" />
                </Card>
                <Card title="Average Sales Cycle" icon={Clock} tint="#3b82f6">
                    <TextField value={data.salesCycle} onChange={set("salesCycle")} suffix="Days" />
                </Card>
                <Card title="Pricing Model" icon={Tag} tint="#22c55e">
                    <SelectField value={data.pricingModel} onChange={set("pricingModel")} options={PRICING_MODEL_OPTIONS} />
                </Card>
            </div>

            {/* Products / services offered */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Card
                    title="Products Offered"
                    icon={Package}
                    tint="#3b82f6"
                    action={
                        <span className="text-[11px] text-gray-500 shrink-0">From your Products page</span>
                    }
                >
                    {productsLoading ? (
                        <p className="text-xs text-gray-500">Loading products…</p>
                    ) : products.length ? (
                        <div className="flex flex-wrap gap-2">
                            {products.map((p) => (
                                <span
                                    key={p.id}
                                    className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-gray-300"
                                >
                                    {p.product_name}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-gray-500">
                            No products yet — add one from the Products page and it'll show up here automatically.
                        </p>
                    )}
                </Card>
                <Card title="Services Offered" icon={Wrench} tint="#22c55e">
                    <PillEditor
                        items={data.services}
                        addLabel="Add Service"
                        onAdd={(v) => setData((p) => ({ ...p, services: [...p.services, v] }))}
                        onRemove={(v) => setData((p) => ({ ...p, services: p.services.filter((x) => x !== v) }))}
                    />
                </Card>
            </div>

            {/* Subscription plans / sales process */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <Card title="Subscription Plans" icon={CreditCard} tint="#ec4899">
                    <SelectField value={data.plans} onChange={set("plans")} options={planOptions} />
                    <p className="text-[11px] text-gray-600">
                        Preview only — this'll switch to your actual live plan once billing goes live.
                    </p>
                </Card>
                <Card
                    title="Sales Process"
                    icon={Shuffle}
                    tint="#f97316"
                    className="md:col-span-2"
                    action={
                        <button
                            type="button"
                            onClick={() => setStagesModalOpen(true)}
                            className="flex items-center gap-1.5 text-xs text-gray-300 border border-white/10 hover:border-orange-500/40 hover:text-orange-400 transition px-3 py-1.5 rounded-lg shrink-0"
                        >
                            <Settings2 size={13} />
                            Manage Stages
                        </button>
                    }
                >
                    <div className="flex items-center">
                        {data.stages.map((stage, i) => {
                            const Icon = iconForStage(stage);
                            const isLast = i === data.stages.length - 1;
                            return (
                                <React.Fragment key={`${stage}-${i}`}>
                                    <div className="flex flex-col items-center gap-1.5 text-center shrink-0">
                                        <div
                                            className={`h-9 w-9 rounded-full border flex items-center justify-center ${
                                                isLast ? "border-green-500/60 text-green-500" : "border-orange-500/40 text-orange-500"
                                            }`}
                                        >
                                            <Icon size={15} />
                                        </div>
                                        <span className="text-[11px] text-gray-400 whitespace-nowrap max-w-[72px] truncate">
                                            {stage}
                                        </span>
                                    </div>
                                    {i < data.stages.length - 1 && (
                                        <div className="flex-1 h-px border-t border-dashed border-orange-600/30 mx-1 mb-5" />
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </div>
                </Card>
            </div>

            {/* Tip strip */}
            <div className="bg-gradient-to-r from-orange-500/10 to-transparent border border-orange-600/20 rounded-xl px-5 py-3.5 flex items-center gap-3">
                <Lightbulb size={16} className="text-orange-500 shrink-0" />
                <p className="text-xs text-gray-400">
                    <span className="text-orange-500 font-semibold">Tip: </span>
                    A well-defined business profile helps our AI generate better insights and automations for your
                    business.
                </p>
            </div>

            {stagesModalOpen && (
                <ManageStagesModal
                    stages={data.stages}
                    onClose={() => setStagesModalOpen(false)}
                    onSave={(next) => {
                        setData((p) => ({ ...p, stages: next }));
                        setStagesModalOpen(false);
                    }}
                />
            )}
        </div>
    );
};

/* ---------- Target Audience tab (receives lifted state from the shell) ----------
   Mirrors the Business Info tab's data flow: state lives in the shell,
   loaded from/saved to GET/PUT /target-audience (same company_registrations
   row, see main.py). "Customer Count" below is intentionally NOT "Student
   Count" — that label only makes sense for an edtech company; the field
   itself (customerCount / target_customer_count) is generic so it fits
   whatever vertical the logged-in company is actually in. */

const TargetAudienceTab = ({ data, setData, options, onAddCustomOption }) => {
    const set = (key) => (value) => setData((prev) => ({ ...prev, [key]: value }));
    const addTo = (key) => (v) => setData((prev) => ({ ...prev, [key]: [...prev[key], v] }));
    const removeFrom = (key) => (v) =>
        setData((prev) => ({ ...prev, [key]: prev[key].filter((x) => x !== v) }));

    // Country drives which State list (if any) is offered, and State drives
    // which City list (if any) is offered — so changing Country clears the
    // now-possibly-invalid State/City picks rather than leaving stale values
    // from a different country's state list sitting around.
    const handleCountryChange = (value) => setData((prev) => ({ ...prev, country: value, state: [], cities: [] }));

    // Only India has a maintained State list — every other country falls
    // back to free-typing (empty options => MultiSelectField just shows the
    // text input).
    const stateOptions = data.country === "India" ? options.state : [];

    // City options are the union of curated cities for whichever state(s)
    // are currently selected; no maintained list => free-typing, same as
    // any non-India country.
    const cityOptions = useMemo(() => {
        if (data.country !== "India" || !data.state?.length) return [];
        const citySet = new Set();
        data.state.forEach((s) => (INDIA_STATE_CITIES[s] || []).forEach((c) => citySet.add(c)));
        return Array.from(citySet);
    }, [data.country, data.state]);

    return (
        <div className="space-y-8">
            {/* Header + illustration */}
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3.5 min-w-0">
                    <div className="h-11 w-11 rounded-xl bg-orange-500/15 flex items-center justify-center text-orange-500 shrink-0">
                        <Target size={20} />
                    </div>
                    <div className="min-w-0">
                        <p className="text-white font-semibold text-lg leading-none">Target Audience</p>
                        <p className="text-sm text-gray-500 mt-2">
                            Define your ideal customer profile. This data will be used for lead generation.
                        </p>
                    </div>
                </div>
                <TargetAudienceIllustration />
            </div>

            {/* Country / State / City */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-6">
                <Field label="Country">
                    <SelectFieldWithOther
                        value={data.country}
                        onChange={handleCountryChange}
                        options={options.country}
                        onAddCustom={onAddCustomOption("country", handleCountryChange)}
                    />
                </Field>
                <Field label="State">
                    <MultiSelectField
                        value={data.state}
                        onAdd={addTo("state")}
                        onRemove={removeFrom("state")}
                        options={stateOptions}
                        onAddCustom={data.country === "India" ? onAddCustomOption("state", addTo("state")) : undefined}
                        addLabel="Add"
                        placeholder={data.country === "India" ? "Type another state, press Enter" : "e.g. California"}
                    />
                </Field>
                <Field label="City">
                    <MultiSelectField
                        value={data.cities}
                        onAdd={addTo("cities")}
                        onRemove={removeFrom("cities")}
                        options={cityOptions}
                        addLabel="Add"
                        placeholder={data.state?.length ? "Type another city, press Enter" : "e.g. Mumbai, Pune"}
                    />
                </Field>

                {/* Industry / Company Size / Customer Count */}
                <Field label="Industry">
                    <SelectFieldWithOther
                        value={data.industry}
                        onChange={set("industry")}
                        options={options.industry}
                        onAddCustom={onAddCustomOption("industry", set("industry"))}
                    />
                </Field>
                <Field label="Company Size">
                    <SelectFieldWithOther
                        value={data.companySize}
                        onChange={set("companySize")}
                        options={options.companySize}
                        onAddCustom={onAddCustomOption("companySize", set("companySize"))}
                    />
                </Field>
                <Field label={CUSTOMER_COUNT_LABEL}>
                    <SelectFieldWithOther
                        value={data.customerCount}
                        onChange={set("customerCount")}
                        options={options.customerCount}
                        onAddCustom={onAddCustomOption("customerCount", set("customerCount"))}
                    />
                </Field>

                {/* Decision Maker / Designation / Pain Points */}
                <Field label="Decision Maker">
                    <PillEditor
                        items={data.decisionMakers}
                        addLabel="Add"
                        example="CEO, Founder"
                        onAdd={addTo("decisionMakers")}
                        onRemove={removeFrom("decisionMakers")}
                    />
                </Field>
                <Field label="Designation">
                    <PillEditor
                        items={data.designations}
                        addLabel="Add"
                        example="Marketing Head"
                        onAdd={addTo("designations")}
                        onRemove={removeFrom("designations")}
                    />
                </Field>
                <Field label="Pain Points">
                    <PillEditor
                        items={data.painPoints}
                        addLabel="Add"
                        example="High customer acquisition cost"
                        onAdd={addTo("painPoints")}
                        onRemove={removeFrom("painPoints")}
                    />
                </Field>

                {/* Budget Range / Target Keywords */}
                <Field label="Budget Range">
                    <TextField value={data.budgetRange} onChange={set("budgetRange")} prefix="₹" />
                </Field>
                <Field label="Target Keywords" className="md:col-span-2">
                    <PillEditor
                        items={data.keywords}
                        addLabel="Add"
                        example="CRM software, lead generation"
                        onAdd={addTo("keywords")}
                        onRemove={removeFrom("keywords")}
                    />
                </Field>
            </div>

            {/* Tip strip */}
            <div className="bg-gradient-to-r from-orange-500/10 to-transparent border border-orange-600/20 rounded-xl px-5 py-3.5 flex items-center gap-3">
                <Lightbulb size={16} className="text-orange-500 shrink-0" />
                <p className="text-xs text-gray-400">
                    <span className="text-orange-500 font-semibold">Tip: </span>
                    A sharper ideal-customer profile means more relevant leads from Discover Leads and better-targeted
                    AI outreach.
                </p>
            </div>
        </div>
    );
};

/* ---------- Add/Edit Product modal ---------- */

const emptyProductForm = {
    product_name: "",
    category: "",
    price: "",
    description: "",
    image_url: "",
    target_keywords: "",
    target_location: "",
    target_audience: "",
};

const ProductFormModal = ({ product, readOnly, onClose, onSave, saving }) => {
    const [form, setForm] = useState(() =>
        product
            ? {
                  product_name: product.product_name || "",
                  category: product.category || "",
                  price: product.price ?? "",
                  description: product.description || "",
                  image_url: product.image_url || "",
                  target_keywords: product.target_keywords || "",
                  target_location: product.target_location || "",
                  target_audience: product.target_audience || "",
              }
            : emptyProductForm
    );

    const field = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

    const canSave = form.product_name.trim().length > 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/70" onClick={onClose} />
            <div className="relative z-10 w-full max-w-lg bg-[#111111] border border-orange-600/20 rounded-xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <p className="text-white font-semibold">
                        {readOnly ? "Product Details" : product ? "Edit Product" : "Add Product"}
                    </p>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition">
                        <X size={18} />
                    </button>
                </div>

                <div className="space-y-3">
                    <div>
                        <label className="text-xs text-gray-500 mb-1 block">Product Name</label>
                        <input
                            value={form.product_name}
                            onChange={field("product_name")}
                            disabled={readOnly}
                            placeholder="e.g. AI Chatbot Assistant"
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-orange-500/40 disabled:opacity-60"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Industry / Category</label>
                            <input
                                value={form.category}
                                onChange={field("category")}
                                disabled={readOnly}
                                placeholder="e.g. IT Services"
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-orange-500/40 disabled:opacity-60"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Price (₹ / mo)</label>
                            <input
                                value={form.price}
                                onChange={field("price")}
                                disabled={readOnly}
                                type="number"
                                min="0"
                                placeholder="1999"
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-orange-500/40 disabled:opacity-60"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs text-gray-500 mb-1 block">Description</label>
                        <textarea
                            value={form.description}
                            onChange={field("description")}
                            disabled={readOnly}
                            rows={3}
                            placeholder="What this product does, in a line or two"
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-orange-500/40 resize-none disabled:opacity-60"
                        />
                    </div>

                    <div>
                        <label className="text-xs text-gray-500 mb-1 block">Image URL (optional)</label>
                        <input
                            value={form.image_url}
                            onChange={field("image_url")}
                            disabled={readOnly}
                            placeholder="https://…"
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-orange-500/40 disabled:opacity-60"
                        />
                    </div>

                    <details className="group">
                        <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-300 transition select-none">
                            Lead targeting (used once lead discovery is connected)
                        </summary>
                        <div className="grid grid-cols-1 gap-3 mt-3">
                            <input
                                value={form.target_keywords}
                                onChange={field("target_keywords")}
                                disabled={readOnly}
                                placeholder="Target keywords, comma separated"
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-orange-500/40 disabled:opacity-60"
                            />
                            <input
                                value={form.target_location}
                                onChange={field("target_location")}
                                disabled={readOnly}
                                placeholder="Target location"
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-orange-500/40 disabled:opacity-60"
                            />
                            <input
                                value={form.target_audience}
                                onChange={field("target_audience")}
                                disabled={readOnly}
                                placeholder="Target audience"
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-orange-500/40 disabled:opacity-60"
                            />
                        </div>
                    </details>
                </div>

                <div className="flex items-center justify-end gap-2 mt-5">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white transition">
                        {readOnly ? "Close" : "Cancel"}
                    </button>
                    {!readOnly && (
                        <button
                            onClick={() => canSave && onSave(form)}
                            disabled={!canSave || saving}
                            className="px-4 py-2 rounded-lg text-sm font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:hover:bg-orange-500 text-white transition"
                        >
                            {saving ? "Saving…" : product ? "Save Changes" : "Add Product"}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

/* ---------- Products & Services tab ---------- */

const ProductsServicesTab = ({ products, productsLoading, refetchProducts }) => {
    const [search, setSearch] = useState("");
    const [modalMode, setModalMode] = useState(null); // null | "add" | "edit" | "view"
    const [activeProduct, setActiveProduct] = useState(null);
    const [saving, setSaving] = useState(false);
    const [openMenuId, setOpenMenuId] = useState(null);
    const [deletingId, setDeletingId] = useState(null);

    const filtered = products.filter((p) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return `${p.product_name} ${p.category}`.toLowerCase().includes(q);
    });

    const closeModal = () => {
        setModalMode(null);
        setActiveProduct(null);
    };

    const handleSubmit = async (form) => {
        setSaving(true);
        const payload = {
            product_name: form.product_name.trim(),
            category: form.category.trim(),
            price: Number(form.price) || 0,
            description: form.description,
            image_url: form.image_url,
            target_keywords: form.target_keywords,
            target_location: form.target_location,
            target_audience: form.target_audience,
        };
        try {
            if (modalMode === "edit" && activeProduct) {
                await apiPatch(`/products/${activeProduct.id}`, payload);
            } else {
                await apiPost("/products", payload);
            }
            await refetchProducts();
            closeModal();
        } catch (err) {
            console.error("Failed to save product:", err);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (product) => {
        setOpenMenuId(null);
        if (!window.confirm(`Delete "${product.product_name}"? This can't be undone.`)) return;
        setDeletingId(product.id);
        try {
            await apiDelete(`/products/${product.id}`);
            await refetchProducts();
        } catch (err) {
            console.error("Failed to delete product:", err);
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                    <IconBadge icon={LayoutGrid} tint="#f97316" />
                    <div className="min-w-0">
                        <p className="text-white font-semibold text-base leading-none">Products & Services</p>
                        <p className="text-xs text-gray-500 mt-1.5">Manage your products with complete details.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                    <div className="relative">
                        <Search size={14} className="text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search products…"
                            className="bg-black/40 border border-white/10 focus:border-orange-500/40 rounded-lg pl-8 pr-3 py-2 text-sm text-gray-200 outline-none w-52 transition"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => setModalMode("add")}
                        className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 transition text-white text-sm font-semibold px-3.5 py-2 rounded-lg shrink-0"
                    >
                        <Plus size={15} />
                        Add Product
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-[#0d0d0d] border border-white/[0.08] rounded-xl overflow-hidden">
                <div className="grid grid-cols-[2.2fr_1fr_1fr_1fr_auto] gap-3 px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-400 bg-white/[0.03] border-b border-orange-500/10">
                    <span>Product</span>
                    <span>Industry</span>
                    <span>Price</span>
                    <span>Status</span>
                    <span className="text-right pr-2">Actions</span>
                </div>

                {productsLoading ? (
                    <p className="text-sm text-gray-500 text-center py-10">Loading products…</p>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-14 px-5">
                        <p className="text-sm text-gray-300 font-medium">
                            {products.length === 0 ? "No products yet" : "No products match your search"}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            {products.length === 0
                                ? "Add your first product to start tracking it across leads and campaigns."
                                : "Try a different name or industry."}
                        </p>
                    </div>
                ) : (
                    filtered.map((p, i) => {
                        const Icon = iconForProduct(p);
                        const tint = tintForIndex(i);
                        return (
                            <div
                                key={p.id}
                                className="grid grid-cols-[2.2fr_1fr_1fr_1fr_auto] gap-3 px-5 py-3.5 items-center border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02] transition"
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <IconBadge icon={Icon} tint={tint} />
                                    <span className="text-sm text-gray-200 truncate">{p.product_name}</span>
                                </div>
                                <span className="text-sm text-gray-400 truncate">{p.category || "—"}</span>
                                <span className="text-sm text-gray-300">{formatPrice(p.price)}</span>
                                <span>
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-green-500/10 text-green-500 text-[11px] font-medium">
                                        <CheckCircle size={11} />
                                        Active
                                    </span>
                                </span>
                                <div className="flex items-center justify-end gap-1 relative">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveProduct(p);
                                            setModalMode("view");
                                        }}
                                        className="p-1.5 text-gray-500 hover:text-gray-200 transition"
                                        aria-label={`View ${p.product_name}`}
                                    >
                                        <Eye size={15} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveProduct(p);
                                            setModalMode("edit");
                                        }}
                                        className="p-1.5 text-gray-500 hover:text-orange-400 transition"
                                        aria-label={`Edit ${p.product_name}`}
                                    >
                                        <Pencil size={15} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setOpenMenuId(openMenuId === p.id ? null : p.id)}
                                        className="p-1.5 text-gray-500 hover:text-gray-200 transition"
                                        aria-label={`More actions for ${p.product_name}`}
                                        disabled={deletingId === p.id}
                                    >
                                        <MoreVertical size={15} />
                                    </button>
                                    {openMenuId === p.id && (
                                        <>
                                            <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                                            <div className="absolute right-0 top-8 z-20 w-32 bg-[#161616] border border-white/10 rounded-lg shadow-xl overflow-hidden">
                                                <button
                                                    onClick={() => handleDelete(p)}
                                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition"
                                                >
                                                    <Trash2 size={13} />
                                                    {deletingId === p.id ? "Deleting…" : "Delete"}
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {modalMode && (
                <ProductFormModal
                    product={modalMode === "add" ? null : activeProduct}
                    readOnly={modalMode === "view"}
                    saving={saving}
                    onClose={closeModal}
                    onSave={handleSubmit}
                />
            )}
        </div>
    );
};

const DEPARTMENT_OPTIONS = ["Sales", "Marketing", "Support", "Admin", "Operations", "Finance"];
const STATUS_TINTS = { Active: "#22c55e", Invited: "#f59e0b", Inactive: "#6b7280" };

const initialsFor = (name) =>
    name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join("") || "?";

const emptyMemberForm = { name: "", email: "", department: "", role: "", status: "Active" };

const TeamMemberFormModal = ({ member, onClose, onSave, onRemove, onResendInvite, saving, removing, resending }) => {
    const [form, setForm] = useState(() =>
        member
            ? {
                  name: member.name || "",
                  email: member.email || "",
                  department: member.department || "",
                  role: member.role || "",
                  status: member.status || "Active",
              }
            : emptyMemberForm
    );

    const field = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));

    const canSave = form.name.trim().length > 0 && /\S+@\S+\.\S+/.test(form.email.trim());

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/70" onClick={onClose} />
            <div className="relative z-10 w-full max-w-md bg-[#111111] border border-orange-600/20 rounded-xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <p className="text-white font-semibold">{member ? "Edit Team Member" : "Invite Member"}</p>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition">
                        <X size={18} />
                    </button>
                </div>

                <div className="space-y-3">
                    <div>
                        <label className="text-xs text-gray-500 mb-1 block">Name</label>
                        <input
                            value={form.name}
                            onChange={field("name")}
                            placeholder="e.g. John Doe"
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-orange-500/40"
                        />
                    </div>
                    <div>
                        <label className="text-xs text-gray-500 mb-1 block">Email</label>
                        <input
                            value={form.email}
                            onChange={field("email")}
                            type="email"
                            disabled={!!member}
                            placeholder="e.g. john@company.com"
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-orange-500/40 disabled:opacity-60"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Department</label>
                            <select
                                value={form.department}
                                onChange={field("department")}
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-orange-500/40"
                            >
                                <option value="">Select…</option>
                                {DEPARTMENT_OPTIONS.map((d) => (
                                    <option key={d} value={d}>
                                        {d}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Role</label>
                            <input
                                value={form.role}
                                onChange={field("role")}
                                placeholder="e.g. Sales Manager"
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-orange-500/40"
                            />
                        </div>
                    </div>

                    {member && (
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Status</label>
                            {member.status === "Invited" ? (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-lg px-3 py-2.5">
                                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                                        <span className="text-sm text-gray-300">
                                            Invited — waiting for them to set a password
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={onResendInvite}
                                        disabled={resending}
                                        className="flex items-center gap-1.5 text-xs text-gray-300 border border-white/10 hover:border-orange-500/40 hover:text-orange-400 transition px-3 py-1.5 rounded-lg disabled:opacity-50"
                                    >
                                        <Mail size={13} />
                                        {resending ? "Resending…" : "Resend Invite"}
                                    </button>
                                </div>
                            ) : (
                                <select
                                    value={form.status}
                                    onChange={field("status")}
                                    className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-orange-500/40"
                                >
                                    <option value="Active">Active</option>
                                    <option value="Inactive">Inactive</option>
                                </select>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between gap-2 mt-5">
                    {member ? (
                        <button
                            onClick={() => onRemove(member)}
                            disabled={removing || saving}
                            className="px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition disabled:opacity-50 flex items-center gap-1.5"
                        >
                            <Trash2 size={14} />
                            {removing ? "Removing…" : "Remove"}
                        </button>
                    ) : (
                        <span />
                    )}
                    <div className="flex items-center gap-2">
                        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white transition">
                            Cancel
                        </button>
                        <button
                            onClick={() => canSave && onSave(form)}
                            disabled={!canSave || saving || removing}
                            className="px-4 py-2 rounded-lg text-sm font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:hover:bg-orange-500 text-white transition"
                        >
                            {saving ? "Saving…" : member ? "Save Changes" : "Send Invite"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ---------- shown after a successful invite/resend — the invite link is
   always surfaced here as a fallback, since SMTP delivery can fail
   silently on the backend's end ---------- */

const InviteResultBanner = ({ result, onDismiss }) => {
    const [copied, setCopied] = useState(false);
    if (!result) return null;

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(result.link);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch (err) {
            // clipboard API unavailable — the link is still visible to select/copy manually
        }
    };

    const failed = /fail/i.test(result.message || "");

    return (
        <div
            className={`rounded-xl px-4 py-3 flex items-start gap-3 border ${
                failed ? "bg-red-500/10 border-red-500/30" : "bg-orange-500/10 border-orange-600/20"
            }`}
        >
            <Mail size={16} className={`mt-0.5 shrink-0 ${failed ? "text-red-400" : "text-orange-500"}`} />
            <div className="min-w-0 flex-1">
                <p className={`text-xs font-medium ${failed ? "text-red-400" : "text-orange-400"}`}>{result.message}</p>
                <div className="flex items-center gap-2 mt-2">
                    <input
                        readOnly
                        value={result.link}
                        onFocus={(e) => e.target.select()}
                        className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-gray-400 outline-none"
                    />
                    <button
                        type="button"
                        onClick={copyLink}
                        className="flex items-center gap-1.5 text-xs text-gray-300 border border-white/10 hover:border-orange-500/40 hover:text-orange-400 transition px-2.5 py-1.5 rounded-lg shrink-0"
                    >
                        {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                        {copied ? "Copied" : "Copy"}
                    </button>
                </div>
            </div>
            <button onClick={onDismiss} className="text-gray-500 hover:text-white transition shrink-0">
                <X size={14} />
            </button>
        </div>
    );
};

const ImportSummaryBanner = ({ summary, onDismiss }) => {
    if (!summary) return null;
    const hasFailures = summary.failed.length > 0 || summary.error;

    return (
        <div
            className={`rounded-xl px-4 py-3 flex items-start gap-3 border ${
                hasFailures ? "bg-red-500/10 border-red-500/30" : "bg-orange-500/10 border-orange-600/20"
            }`}
        >
            <Upload size={16} className={`mt-0.5 shrink-0 ${hasFailures ? "text-red-400" : "text-orange-500"}`} />
            <div className="min-w-0 flex-1">
                {summary.error ? (
                    <p className="text-xs font-medium text-red-400">{summary.error}</p>
                ) : (
                    <>
                        <p className={`text-xs font-medium ${hasFailures ? "text-red-400" : "text-orange-400"}`}>
                            {summary.invited} invited
                            {summary.failed.length > 0 ? `, ${summary.failed.length} skipped` : ""} — invite emails
                            sent for each successful row.
                        </p>
                        {summary.failed.length > 0 && (
                            <ul className="mt-1.5 space-y-0.5">
                                {summary.failed.map((f, i) => (
                                    <li key={i} className="text-[11px] text-gray-500">
                                        Row {f.line}: {f.reason}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </>
                )}
            </div>
            <button onClick={onDismiss} className="text-gray-500 hover:text-white transition shrink-0">
                <X size={14} />
            </button>
        </div>
    );
};

/* ---------- Team & Users tab ---------- */

const TeamUsersTab = ({ members, membersLoading, refetchMembers }) => {
    const [search, setSearch] = useState("");
    const [modalOpen, setModalOpen] = useState(false);
    const [activeMember, setActiveMember] = useState(null);
    const [saving, setSaving] = useState(false);
    const [removing, setRemoving] = useState(false);
    const [resending, setResending] = useState(false);
    const [inviteResult, setInviteResult] = useState(null); // { link, message }
    const [importing, setImporting] = useState(false);
    const [importSummary, setImportSummary] = useState(null); // { invited, failed: [{line, reason}], error? }
    const [exportMenuOpen, setExportMenuOpen] = useState(false);
    const fileInputRef = useRef(null);
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    const filtered = members.filter((m) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return `${m.name} ${m.email} ${m.department} ${m.role}`.toLowerCase().includes(q);
    });

    // Back to page 1 whenever the visible set changes shape — otherwise
    // a filter/search/page-size change could leave currentPage pointing
    // past the end (e.g. page 3 of 1) with an empty table showing.
    useEffect(() => {
        setCurrentPage(1);
    }, [search, pageSize, members.length]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

    const closeModal = () => {
        setModalOpen(false);
        setActiveMember(null);
    };

    const handleSubmit = async (form) => {
        setSaving(true);
        const payload = {
            name: form.name.trim(),
            email: form.email.trim(),
            department: form.department,
            role: form.role.trim(),
            status: form.status || "Active",
        };
        try {
            if (activeMember) {
                await apiPatch(`/team-members/${activeMember.id}`, payload);
            } else {
                const res = await apiPost("/team-members", payload);
                const created = res?.data?.[0];
                if (created?.invite_link) {
                    setInviteResult({ link: created.invite_link, message: res.message });
                }
            }
            await refetchMembers();
            closeModal();
        } catch (err) {
            console.error("Failed to save team member:", err);
        } finally {
            setSaving(false);
        }
    };

    const handleRemove = async (member) => {
        if (!window.confirm(`Remove ${member.name} from the team?`)) return;
        setRemoving(true);
        try {
            await apiDelete(`/team-members/${member.id}`);
            await refetchMembers();
            closeModal();
        } catch (err) {
            console.error("Failed to remove team member:", err);
        } finally {
            setRemoving(false);
        }
    };

    const handleResendInvite = async () => {
        if (!activeMember) return;
        setResending(true);
        try {
            const res = await apiPost(`/team-members/${activeMember.id}/resend-invite`, {});
            const updated = res?.data?.[0];
            if (updated?.invite_link) {
                setInviteResult({ link: updated.invite_link, message: res.message });
            }
            await refetchMembers();
            closeModal();
        } catch (err) {
            console.error("Failed to resend invite:", err);
        } finally {
            setResending(false);
        }
    };

    const handleExportCsv = () => {
        const header = ["Name", "Email", "Department", "Role", "Status"];
        const rows = members.map((m) => [m.name, m.email, m.department, m.role, m.status]);
        const csv = buildCsv(header, rows);
        downloadCsv(`team-members-${new Date().toISOString().slice(0, 10)}.csv`, csv);
    };

    const handleExportExcel = () => {
        const header = ["Name", "Email", "Department", "Role", "Status"];
        const rows = members.map((m) => [m.name, m.email, m.department, m.role, m.status]);
        const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
        worksheet["!cols"] = [{ wch: 22 }, { wch: 30 }, { wch: 16 }, { wch: 20 }, { wch: 12 }];
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Team Members");
        XLSX.writeFile(workbook, `team-members-${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const handleImportClick = () => fileInputRef.current?.click();

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = ""; // reset so re-selecting the same file fires onChange again
        if (!file) return;

        // Read as an array-of-arrays either way — same shape whether it
        // came from CSV text or a parsed Excel sheet — so everything
        // below (header detection, row mapping) doesn't care which
        // format the file was.
        let rows;
        try {
            if (/\.(xlsx|xls)$/i.test(file.name)) {
                const buffer = await file.arrayBuffer();
                const workbook = XLSX.read(buffer, { type: "array" });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: "" });
            } else {
                const text = await file.text();
                rows = parseCsvRows(text);
            }
        } catch (err) {
            console.error("Failed to read import file:", err);
            setImportSummary({
                invited: 0,
                failed: [],
                error: "Couldn't read that file — make sure it's a valid .csv or .xlsx file.",
            });
            return;
        }

        rows = (rows || []).filter((r) => r.some((cell) => cellStr(cell) !== ""));
        if (rows.length === 0) {
            setImportSummary({ invited: 0, failed: [], error: "That file doesn't have any rows in it." });
            return;
        }

        // Accept either a header row (Name, Email, Department, Role — any
        // order, case-insensitive) or plain rows in that same order with
        // no header at all.
        const headerCells = rows[0].map((h) => cellStr(h).toLowerCase());
        const headerIdx = {
            name: headerCells.indexOf("name"),
            email: headerCells.indexOf("email"),
            department: headerCells.indexOf("department"),
            role: headerCells.indexOf("role"),
        };
        const hasHeader = headerIdx.name !== -1 && headerIdx.email !== -1;
        const dataRows = hasHeader ? rows.slice(1) : rows;
        const col = hasHeader ? headerIdx : { name: 0, email: 1, department: 2, role: 3 };

        const parsedRows = dataRows.map((r, i) => ({
            line: i + (hasHeader ? 2 : 1), // 1-based, matching what someone would see in a spreadsheet
            name: cellStr(r[col.name]),
            email: cellStr(r[col.email]),
            department: col.department >= 0 ? cellStr(r[col.department]) : "",
            role: col.role >= 0 ? cellStr(r[col.role]) : "",
        }));

        setImporting(true);
        setImportSummary(null);
        const existingEmails = new Set(members.map((m) => cellStr(m.email).toLowerCase()));
        const seenInThisFile = new Set();
        let invited = 0;
        const failed = [];
        for (const row of parsedRows) {
            if (!row.name || !row.email) {
                failed.push({ line: row.line, reason: "Missing name or email" });
                continue;
            }
            const emailKey = row.email.toLowerCase();
            if (existingEmails.has(emailKey)) {
                failed.push({ line: row.line, reason: "Already a team member — skipped" });
                continue;
            }
            if (seenInThisFile.has(emailKey)) {
                failed.push({ line: row.line, reason: "Duplicate email in this file — skipped" });
                continue;
            }
            seenInThisFile.add(emailKey);
            try {
                await apiPost("/team-members", {
                    name: row.name,
                    email: row.email,
                    department: row.department,
                    role: row.role,
                    status: "Invited",
                });
                invited++;
            } catch (err) {
                failed.push({ line: row.line, reason: err.message || "Could not invite this row" });
            }
        }
        await refetchMembers();
        setImporting(false);
        setImportSummary({ invited, failed });
    };

    return (
        <div className="h-full flex flex-col gap-5">
            {inviteResult && <InviteResultBanner result={inviteResult} onDismiss={() => setInviteResult(null)} />}
            {importSummary && <ImportSummaryBanner summary={importSummary} onDismiss={() => setImportSummary(null)} />}

            {/* Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                    <IconBadge icon={Users} tint="#f97316" />
                    <div className="min-w-0">
                        <p className="text-white font-semibold text-base leading-none">Team & Users</p>
                        <p className="text-xs text-gray-500 mt-1.5">Invite members and manage roles & permissions.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                    <div className="relative">
                        <Search size={14} className="text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search members…"
                            className="bg-black/40 border border-white/10 focus:border-orange-500/40 rounded-lg pl-8 pr-3 py-2 text-sm text-gray-200 outline-none w-52 transition"
                        />
                    </div>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                        onChange={handleFileChange}
                        className="hidden"
                    />
                    <button
                        type="button"
                        onClick={handleImportClick}
                        disabled={importing}
                        title="Import members from a CSV or Excel file (columns: Name, Email, Department, Role)"
                        className="flex items-center gap-1.5 text-sm text-gray-300 border border-white/10 hover:border-orange-500/40 hover:text-orange-400 transition px-3 py-2 rounded-lg disabled:opacity-50 shrink-0"
                    >
                        <Upload size={14} />
                        {importing ? "Importing…" : "Import"}
                    </button>

                    <div className="relative shrink-0">
                        <button
                            type="button"
                            onClick={() => setExportMenuOpen((v) => !v)}
                            disabled={members.length === 0}
                            title="Export the current list"
                            className="flex items-center gap-1.5 text-sm text-gray-300 border border-white/10 hover:border-orange-500/40 hover:text-orange-400 transition px-3 py-2 rounded-lg disabled:opacity-40"
                        >
                            <Download size={14} />
                            Export
                            <ChevronDown size={13} className={`transition ${exportMenuOpen ? "rotate-180" : ""}`} />
                        </button>
                        {exportMenuOpen && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setExportMenuOpen(false)} />
                                <div className="absolute right-0 top-full mt-1.5 z-20 w-44 bg-[#161616] border border-white/10 rounded-lg shadow-xl overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            handleExportCsv();
                                            setExportMenuOpen(false);
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-white/5 hover:text-orange-400 transition"
                                    >
                                        <FileText size={13} />
                                        Export as CSV
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            handleExportExcel();
                                            setExportMenuOpen(false);
                                        }}
                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-300 hover:bg-white/5 hover:text-orange-400 transition"
                                    >
                                        <FileSpreadsheet size={13} />
                                        Export as Excel
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    <button
                        type="button"
                        onClick={() => setModalOpen(true)}
                        className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 transition text-white text-sm font-semibold px-3.5 py-2 rounded-lg shrink-0"
                    >
                        <Plus size={15} />
                        Invite Member
                    </button>
                </div>
            </div>

            {/* Show entries */}
            <div className="flex items-center gap-2 text-sm text-gray-400">
                <span>Show</span>
                <div className="relative">
                    <select
                        value={pageSize}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                        className="appearance-none bg-black/40 border border-white/10 hover:border-orange-500/30 focus:border-orange-500/50 focus:outline-none rounded-lg pl-3 pr-7 py-1.5 text-sm text-gray-200 transition cursor-pointer"
                    >
                        {[10, 25, 50, 100].map((n) => (
                            <option key={n} value={n} className="bg-[#111]">
                                {n}
                            </option>
                        ))}
                    </select>
                    <ChevronDown size={13} className="text-gray-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <span>entries</span>
            </div>

            {/* Table — flex-1 so it stretches to fill the panel, which
                pushes the pagination footer down to the bottom of the
                tab (same "Previous / Page X of Y / Next" placement as
                the Lead Management screen) instead of trailing right
                after the last row on a short table. */}
            <div className="flex-1 min-h-0 bg-[#0d0d0d] border border-white/[0.08] rounded-xl overflow-hidden flex flex-col">
                <div className="grid grid-cols-[1.6fr_1.8fr_1fr_1.2fr_0.9fr_auto] gap-3 px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-400 bg-white/[0.03] border-b border-orange-500/10">
                    <span>Name</span>
                    <span>Email</span>
                    <span>Department</span>
                    <span>Role</span>
                    <span>Status</span>
                    <span className="text-right pr-2">Actions</span>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto">
                    {membersLoading ? (
                        <p className="text-sm text-gray-500 text-center py-10">Loading team members…</p>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-14 px-5">
                            <p className="text-sm text-gray-300 font-medium">
                                {members.length === 0 ? "No team members yet" : "No members match your search"}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                                {members.length === 0
                                    ? "Invite your first teammate to give them access to this workspace."
                                    : "Try a different name, email, or department."}
                            </p>
                        </div>
                    ) : (
                        paginated.map((m, i) => {
                            const tint = tintForIndex(i);
                            const statusTint = STATUS_TINTS[m.status] || STATUS_TINTS.Active;
                            return (
                                <div
                                    key={m.id}
                                    className="grid grid-cols-[1.6fr_1.8fr_1fr_1.2fr_0.9fr_auto] gap-3 px-5 py-3.5 items-center border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02] transition"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div
                                            className="h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-semibold shrink-0"
                                            style={{ backgroundColor: `${tint}1f`, color: tint }}
                                        >
                                            {initialsFor(m.name)}
                                        </div>
                                        <span className="text-sm text-gray-200 truncate">{m.name}</span>
                                    </div>
                                    <span className="text-sm text-gray-400 truncate">{m.email}</span>
                                    <span className="text-sm text-gray-400 truncate">{m.department || "—"}</span>
                                    <span className="text-sm text-gray-300 truncate">{m.role || "—"}</span>
                                    <span>
                                        <span
                                            className="inline-flex items-center gap-1.5 text-[11px] font-medium"
                                            style={{ color: statusTint }}
                                        >
                                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusTint }} />
                                            {m.status || "Active"}
                                        </span>
                                    </span>
                                    <div className="flex items-center justify-end gap-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setActiveMember(m);
                                                setModalOpen(true);
                                            }}
                                            className="p-1.5 text-gray-500 hover:text-orange-400 transition"
                                            aria-label={`Edit ${m.name}`}
                                        >
                                            <Pencil size={15} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Pagination footer — sits at the bottom of the panel (the
                table above is flex-1, so it fills the remaining height
                and pushes this down) instead of trailing off right after
                a short table, matching the Lead Management screen. */}
            {!membersLoading && filtered.length > 0 && (
                <div className="shrink-0 pt-4 flex items-center justify-between gap-3 flex-wrap text-sm">
                    <p className="text-gray-500">
                        Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)} of{" "}
                        {filtered.length} member{filtered.length === 1 ? "" : "s"}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={safePage <= 1}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/10 text-gray-300 hover:border-orange-500/40 hover:text-orange-400 transition disabled:opacity-40 disabled:hover:border-white/10 disabled:hover:text-gray-300"
                        >
                            <ChevronLeft size={14} />
                            Previous
                        </button>
                        <span className="px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-semibold">
                            {safePage}
                        </span>
                        <span className="text-gray-500 text-xs">of {totalPages}</span>
                        <button
                            type="button"
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={safePage >= totalPages}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/10 text-gray-300 hover:border-orange-500/40 hover:text-orange-400 transition disabled:opacity-40 disabled:hover:border-white/10 disabled:hover:text-gray-300"
                        >
                            Next
                            <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            )}

            {modalOpen && (
                <TeamMemberFormModal
                    member={activeMember}
                    saving={saving}
                    removing={removing}
                    resending={resending}
                    onClose={closeModal}
                    onSave={handleSubmit}
                    onRemove={handleRemove}
                    onResendInvite={handleResendInvite}
                />
            )}
        </div>
    );
};

/* ---------- AI Knowledge Base tab ----------
   Left: a dropzone that uploads documents to GET/POST /knowledge-documents
   (multipart, scoped to the logged-in company via the JWT like every other
   endpoint here). Right: the resulting library, newest first, each row
   removable. Backend is expected to return { data: [{ id, file_name,
   file_size, uploaded_at }] } from GET and accept a single `file` field on
   POST — adjust the two request shapes below if the real API differs. */

const KnowledgeUploadCard = ({ onFilesSelected, uploading, error }) => {
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef(null);

    const openPicker = () => fileInputRef.current?.click();

    const handleDrop = (e) => {
        e.preventDefault();
        setDragActive(false);
        if (uploading) return;
        onFilesSelected(e.dataTransfer.files);
    };

    return (
        <Card title="Upload Knowledge">
            <p className="text-xs text-gray-500 -mt-2">Upload documents, brochures, FAQs to train your AI.</p>

            <div
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={openPicker}
                role="button"
                tabIndex={0}
                className={`flex flex-col items-center justify-center gap-3 text-center rounded-xl border-2 border-dashed px-5 py-10 cursor-pointer transition ${
                    dragActive
                        ? "border-orange-500/60 bg-orange-500/[0.06]"
                        : "border-white/10 hover:border-orange-500/30 hover:bg-white/[0.02]"
                }`}
            >
                <div className="h-11 w-11 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500">
                    <UploadCloud size={20} />
                </div>
                <div>
                    <p className="text-sm text-gray-300 font-medium">Drag & drop files here</p>
                    <p className="text-[11px] text-gray-600 mt-1">
                        PDF, DOCX, PPT, TXT (Max {KNOWLEDGE_MAX_MB}MB)
                    </p>
                </div>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        openPicker();
                    }}
                    disabled={uploading}
                    className="flex items-center gap-2 bg-orange-500/15 hover:bg-orange-500/25 backdrop-blur-md border border-orange-400/30 shadow-[0_4px_20px_-4px_rgba(249,115,22,0.35)] transition text-orange-300 text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
                >
                    <Upload size={14} />
                    {uploading ? "Uploading…" : "Upload Files"}
                </button>
                <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={KNOWLEDGE_ACCEPT}
                    onChange={(e) => {
                        onFilesSelected(e.target.files);
                        e.target.value = ""; // allow re-selecting the same file
                    }}
                    className="hidden"
                />
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}
        </Card>
    );
};


const AIKnowledgeBaseTab = () => {
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState(null);
    const [deletingId, setDeletingId] = useState(null);
    const [search, setSearch] = useState("");
    const [typeFilter, setTypeFilter] = useState(null); // null | "pdf" | "docx" | "ppt" | "txt"
    const [openMenuId, setOpenMenuId] = useState(null);
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    const loadDocuments = async () => {
        setLoading(true);
        try {
            const res = await apiGet("/knowledge-documents");
            setDocuments(res?.data || []);
        } catch (err) {
            console.error("Failed to load knowledge documents:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDocuments();
    }, []);

    const handleFilesSelected = async (fileList) => {
        const files = Array.from(fileList || []);
        if (!files.length) return;
        setError(null);
        setUploading(true);

        const oversized = files.filter((f) => f.size > KNOWLEDGE_MAX_MB * 1024 * 1024);
        const toUpload = files.filter((f) => f.size <= KNOWLEDGE_MAX_MB * 1024 * 1024);
        if (oversized.length) {
            setError(`${oversized.map((f) => f.name).join(", ")} — over ${KNOWLEDGE_MAX_MB}MB, skipped.`);
        }

        for (const file of toUpload) {
            const formData = new FormData();
            formData.append("file", file);
            try {
                const res = await fetch(`${API_BASE}/knowledge-documents`, {
                    method: "POST",
                    headers: { ...authHeaders() },
                    body: formData,
                });
                if (!res.ok) {
                    // Backend returns {success:false, message:"..."} on errors
                    // (see http_exception_handler in main.py) — surface that
                    // real reason instead of a generic "try again".
                    let reason = `failed (${res.status})`;
                    try {
                        const body = await res.json();
                        if (body?.message) reason = body.message;
                    } catch (_) {
                        // response wasn't JSON (e.g. a proxy/502 page) — keep the generic reason
                    }
                    throw new Error(reason);
                }
            } catch (err) {
                console.error("Failed to upload knowledge document:", err);
                setError(`Couldn't upload "${file.name}" — ${err.message || "try again."}`);
            }
        }

        await loadDocuments();
        setUploading(false);
    };

    const handleDelete = async (doc) => {
        setOpenMenuId(null);
        if (!window.confirm(`Delete "${doc.file_name}"? This can't be undone.`)) return;
        setDeletingId(doc.id);
        try {
            await apiDelete(`/knowledge-documents/${doc.id}`);
            await loadDocuments();
        } catch (err) {
            console.error("Failed to delete knowledge document:", err);
        } finally {
            setDeletingId(null);
        }
    };

    const activeTypeGroup = KNOWLEDGE_TYPE_FILTERS.find((f) => f.key === typeFilter);

    const filtered = documents.filter((d) => {
        const matchesSearch = (d.file_name || "").toLowerCase().includes(search.trim().toLowerCase());
        if (!matchesSearch) return false;
        if (!activeTypeGroup) return true;
        return activeTypeGroup.exts.includes(extensionOf(d.file_name || ""));
    });

    // Back to page 1 whenever the visible set changes shape — same reset
    // TeamUsersTab does, so a search/page-size change never leaves
    // currentPage pointing past the end with an empty table showing.
    useEffect(() => {
        setCurrentPage(1);
    }, [search, typeFilter, pageSize, documents.length]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

    return (
        <div className="h-full flex flex-col gap-5">
            {/* Header */}
            <div className="flex items-center gap-3 min-w-0 shrink-0">
                <IconBadge icon={BookOpen} tint="#f97316" />
                <div className="min-w-0">
                    <p className="text-white font-semibold text-base leading-none">AI Knowledge Base</p>
                    <p className="text-xs text-gray-500 mt-1.5">
                        Upload documents, brochures, FAQs to train your AI.
                    </p>
                </div>
            </div>

            {/* flex-1 so this row stretches to fill the panel; the
                Knowledge Library card (right) then pushes its own
                pagination footer down to the bottom, same placement
                as the Lead Management screen's "Previous / Next". */}
            <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5">
                <div className="self-start">
                    <KnowledgeUploadCard onFilesSelected={handleFilesSelected} uploading={uploading} error={error} />
                </div>

                {/* Knowledge Library */}
                <div className="bg-[#0d0d0d] border border-white/[0.08] rounded-xl flex flex-col min-h-0">
                    <div className="flex items-center justify-between gap-4 flex-wrap px-5 py-4">
                        <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-200">Knowledge Library</p>
                            <p className="text-xs text-gray-500 mt-1">View and manage all uploaded documents</p>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                            <div className="relative">
                                <Search size={14} className="text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search documents…"
                                    className="bg-black/40 border border-white/10 focus:border-orange-500/40 rounded-lg pl-8 pr-3 py-2 text-sm text-gray-200 outline-none w-52 transition"
                                />
                            </div>
                            {!loading && (
                                <span className="text-[11px] text-gray-500 whitespace-nowrap">
                                    {filtered.length} File{filtered.length === 1 ? "" : "s"}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* File-type chips — bigger than plain text, and clickable:
                        tapping one filters this library down to just that file
                        family. Tapping the active chip again clears it. */}
                    {!loading && documents.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap px-5 pb-4">
                            {KNOWLEDGE_TYPE_FILTERS.map((f) => {
                                const active = typeFilter === f.key;
                                return (
                                    <button
                                        key={f.key}
                                        type="button"
                                        onClick={() => setTypeFilter(active ? null : f.key)}
                                        title={`Show only ${f.label} files`}
                                        className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide transition"
                                        style={
                                            active
                                                ? { backgroundColor: `${f.tint}1f`, borderColor: `${f.tint}66`, color: f.tint }
                                                : { backgroundColor: "transparent", borderColor: "rgba(255,255,255,0.1)", color: f.tint }
                                        }
                                    >
                                        <FileText size={15} />
                                        {f.label}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Show entries */}
                    {!loading && documents.length > 0 && (
                        <div className="flex items-center gap-2 text-sm text-gray-400 px-5 pb-3">
                            <span>Show</span>
                            <div className="relative">
                                <select
                                    value={pageSize}
                                    onChange={(e) => setPageSize(Number(e.target.value))}
                                    className="appearance-none bg-black/40 border border-white/10 hover:border-orange-500/30 focus:border-orange-500/50 focus:outline-none rounded-lg pl-3 pr-7 py-1.5 text-sm text-gray-200 transition cursor-pointer"
                                >
                                    {[10, 25, 50, 100].map((n) => (
                                        <option key={n} value={n} className="bg-[#111]">
                                            {n}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown
                                    size={13}
                                    className="text-gray-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                                />
                            </div>
                            <span>entries</span>
                        </div>
                    )}

                    <div className="flex-1 min-h-0 overflow-y-auto rounded-t-xl border-t border-white/[0.06]">
                        <div className="grid grid-cols-[2fr_0.7fr_0.8fr_1fr_auto] gap-3 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-gray-400 bg-white/[0.03] sticky top-0">
                            <span>Name</span>
                            <span>Type</span>
                            <span>Size</span>
                            <span>Uploaded On</span>
                            <span className="text-right pr-1">Actions</span>
                        </div>

                    {loading ? (
                        <p className="text-sm text-gray-500 text-center py-10">Loading knowledge base…</p>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-12 px-5">
                            <p className="text-sm text-gray-300 font-medium">
                                {documents.length === 0
                                    ? "No documents yet"
                                    : activeTypeGroup
                                    ? `No ${activeTypeGroup.label} files`
                                    : "No documents match your search"}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                                {documents.length === 0
                                    ? "Upload a file on the left to start training your AI."
                                    : activeTypeGroup
                                    ? "Try a different file type or clear the filter."
                                    : "Try a different name."}
                            </p>
                        </div>
                    ) : (
                        paginated.map((doc) => {
                            const ext = extensionOf(doc.file_name || "");
                            const tint = tintForExtension(ext);
                            return (
                                <div
                                    key={doc.id}
                                    className="grid grid-cols-[2fr_0.7fr_0.8fr_1fr_auto] gap-3 px-5 py-3.5 items-center border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02] transition"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div
                                            className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                                            style={{ backgroundColor: `${tint}1f`, color: tint }}
                                        >
                                            <FileText size={15} />
                                        </div>
                                        <span className="text-sm text-gray-200 truncate">{doc.file_name}</span>
                                    </div>
                                    <span
                                        className="text-[11px] font-bold uppercase tracking-wide"
                                        style={{ color: tint }}
                                    >
                                        {ext || "file"}
                                    </span>
                                    <span className="text-sm text-gray-400">{formatFileSize(doc.file_size)}</span>
                                    <span className="text-sm text-gray-400 whitespace-nowrap">
                                        {formatUploadedDate(doc.uploaded_at)}
                                    </span>
                                    <div className="flex items-center justify-end gap-1 relative">
                                        <a
                                            href={doc.file_url ? `${API_BASE}${doc.file_url}` : undefined}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => !doc.file_url && e.preventDefault()}
                                            className={`p-1.5 transition ${
                                                doc.file_url
                                                    ? "text-gray-500 hover:text-gray-200"
                                                    : "text-gray-700 cursor-not-allowed"
                                            }`}
                                            aria-label={`View ${doc.file_name}`}
                                        >
                                            <Eye size={15} />
                                        </a>
                                        <button
                                            type="button"
                                            onClick={() => setOpenMenuId(openMenuId === doc.id ? null : doc.id)}
                                            disabled={deletingId === doc.id}
                                            className="p-1.5 text-gray-500 hover:text-gray-200 transition"
                                            aria-label={`More actions for ${doc.file_name}`}
                                        >
                                            <MoreVertical size={15} />
                                        </button>
                                        {openMenuId === doc.id && (
                                            <>
                                                <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                                                <div className="absolute right-0 top-8 z-20 w-32 bg-[#161616] border border-white/10 rounded-lg shadow-xl overflow-hidden">
                                                    <button
                                                        onClick={() => handleDelete(doc)}
                                                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition"
                                                    >
                                                        <Trash2 size={13} />
                                                        {deletingId === doc.id ? "Deleting…" : "Delete"}
                                                    </button>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                    </div>
                </div>
            </div>

            {/* Pagination footer — sits at the bottom of the panel (the
                grid above is flex-1, so it fills the remaining height
                and pushes this down) instead of trailing off right after
                a short table, matching the Lead Management screen. */}
            {!loading && filtered.length > 0 && (
                <div className="shrink-0 pt-4 border-t border-white/10 flex items-center justify-between gap-3 flex-wrap text-sm">
                    <p className="text-gray-500">
                        Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)} of{" "}
                        {filtered.length} file{filtered.length === 1 ? "" : "s"}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={safePage <= 1}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/10 text-gray-300 hover:border-orange-500/40 hover:text-orange-400 transition disabled:opacity-40 disabled:hover:border-white/10 disabled:hover:text-gray-300"
                        >
                            <ChevronLeft size={14} />
                            Previous
                        </button>
                        <span className="px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-semibold">
                            {safePage}
                        </span>
                        <span className="text-gray-500 text-xs">of {totalPages}</span>
                        <button
                            type="button"
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={safePage >= totalPages}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/10 text-gray-300 hover:border-orange-500/40 hover:text-orange-400 transition disabled:opacity-40 disabled:hover:border-white/10 disabled:hover:text-gray-300"
                        >
                            Next
                            <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

/* ---------- placeholder for tabs not built out yet ---------- */

/* ---------- Business Goals: formatters + small building blocks ---------- */

// Presets cover the common goal shapes (count-based, currency, percentage);
// "Custom" lets a company type any other unit label (e.g. "Deals", "Demos").
const GOAL_UNIT_PRESETS = ["Leads", "Clients", "Customers", "Sales", "₹", "%", "Custom"];

const formatGoalTarget = (value, unit) => {
    const n = Number(value) || 0;
    if (unit === "₹") return `₹${n.toLocaleString("en-IN")}`;
    if (unit === "%") return `${n}%`;
    const formatted = n.toLocaleString("en-IN");
    return unit ? `${formatted} ${unit}` : formatted;
};

const GOAL_STATUS_STYLES = {
    "Not Started": "bg-white/10 text-gray-300",
    "In Progress": "bg-orange-500/10 text-orange-400",
    Completed: "bg-green-500/10 text-green-500",
};

const goalStatusFor = (progress) => {
    const p = Number(progress) || 0;
    if (p >= 100) return "Completed";
    if (p <= 0) return "Not Started";
    return "In Progress";
};

const GoalStatusPill = ({ status }) => (
    <span
        className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap ${
            GOAL_STATUS_STYLES[status] || GOAL_STATUS_STYLES["Not Started"]
        }`}
    >
        {status}
    </span>
);

const GoalProgressBar = ({ value }) => {
    const pct = Math.max(0, Math.min(100, Number(value) || 0));
    return (
        <div className="flex items-center gap-2.5 min-w-[140px]">
            <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                    className="h-full rounded-full bg-gradient-to-r from-orange-600 to-orange-400 transition-all"
                    style={{ width: `${pct}%` }}
                />
            </div>
            <span className="text-xs text-gray-300 font-medium w-9 text-right shrink-0">{pct}%</span>
        </div>
    );
};

const emptyGoalForm = { goal_name: "", unitPreset: "Leads", customUnit: "", target_value: "", progress_percent: 0 };

const GoalFormModal = ({ goal, onClose, onSave, onDelete, saving, deleting }) => {
    const [form, setForm] = useState(() => {
        if (!goal) return emptyGoalForm;
        const isPreset = GOAL_UNIT_PRESETS.slice(0, -1).includes(goal.target_unit);
        return {
            goal_name: goal.goal_name || "",
            unitPreset: isPreset ? goal.target_unit : "Custom",
            customUnit: isPreset ? "" : goal.target_unit || "",
            target_value: goal.target_value ?? "",
            progress_percent: goal.progress_percent ?? 0,
        };
    });

    const field = (key) => (e) => setForm((p) => ({ ...p, [key]: e.target.value }));
    const effectiveUnit = form.unitPreset === "Custom" ? form.customUnit.trim() : form.unitPreset;
    const canSave = form.goal_name.trim().length > 0 && effectiveUnit.length > 0 && Number(form.target_value) >= 0;
    const previewStatus = goalStatusFor(form.progress_percent);

    const handleSave = () => {
        if (!canSave) return;
        onSave({
            goal_name: form.goal_name.trim(),
            target_value: Number(form.target_value) || 0,
            target_unit: effectiveUnit,
            progress_percent: Number(form.progress_percent) || 0,
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="absolute inset-0 bg-black/70" onClick={onClose} />
            <div className="relative z-10 w-full max-w-md bg-[#111111] border border-orange-600/20 rounded-xl p-5 shadow-2xl max-h-[85vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-4">
                    <p className="text-white font-semibold">{goal ? "Edit Goal" : "Add Goal"}</p>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition">
                        <X size={18} />
                    </button>
                </div>

                <div className="space-y-3">
                    <div>
                        <label className="text-xs text-gray-500 mb-1 block">Goal Name</label>
                        <input
                            value={form.goal_name}
                            onChange={field("goal_name")}
                            placeholder="e.g. Generate 500 Leads"
                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-orange-500/40"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Target Value</label>
                            <input
                                value={form.target_value}
                                onChange={field("target_value")}
                                type="number"
                                min="0"
                                placeholder="500"
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-orange-500/40"
                            />
                        </div>
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Unit</label>
                            <div className="relative">
                                <select
                                    value={form.unitPreset}
                                    onChange={field("unitPreset")}
                                    className="w-full appearance-none bg-black/40 border border-white/10 rounded-lg pl-3 pr-7 py-2 text-sm text-gray-200 outline-none focus:border-orange-500/40 cursor-pointer"
                                >
                                    {GOAL_UNIT_PRESETS.map((u) => (
                                        <option key={u} value={u} className="bg-[#111]">
                                            {u === "Custom" ? "Custom…" : u}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown size={13} className="text-gray-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    {form.unitPreset === "Custom" && (
                        <div>
                            <label className="text-xs text-gray-500 mb-1 block">Custom Unit Label</label>
                            <input
                                value={form.customUnit}
                                onChange={field("customUnit")}
                                placeholder="e.g. Deals, Demos, Projects"
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-orange-500/40"
                            />
                        </div>
                    )}

                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="text-xs text-gray-500">Progress</label>
                            <span className="text-xs text-orange-400 font-semibold">{Number(form.progress_percent) || 0}%</span>
                        </div>
                        <input
                            value={form.progress_percent}
                            onChange={field("progress_percent")}
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            className="w-full accent-orange-500"
                        />
                        <input
                            value={form.progress_percent}
                            onChange={field("progress_percent")}
                            type="number"
                            min="0"
                            max="100"
                            className="w-full mt-2 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200 outline-none focus:border-orange-500/40"
                        />
                        <div className="flex items-center gap-2 mt-2 bg-black/40 border border-white/10 rounded-lg px-3 py-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-orange-500 shrink-0" />
                            <span className="text-xs text-gray-400">
                                Status will be <span className="text-gray-200 font-medium">{previewStatus}</span>
                            </span>
                        </div>
                    </div>

                    {form.goal_name.trim() && effectiveUnit && (
                        <p className="text-xs text-gray-500">
                            Target preview:{" "}
                            <span className="text-gray-300 font-medium">
                                {formatGoalTarget(form.target_value, effectiveUnit)}
                            </span>
                        </p>
                    )}
                </div>

                <div className="flex items-center justify-between gap-2 mt-5">
                    {goal ? (
                        <button
                            onClick={() => onDelete(goal)}
                            disabled={deleting || saving}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition disabled:opacity-50"
                        >
                            <Trash2 size={14} />
                            {deleting ? "Deleting…" : "Delete"}
                        </button>
                    ) : (
                        <span />
                    )}
                    <div className="flex items-center gap-2">
                        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white transition">
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!canSave || saving || deleting}
                            className="px-4 py-2 rounded-lg text-sm font-semibold bg-orange-500 hover:bg-orange-600 disabled:opacity-50 disabled:hover:bg-orange-500 text-white transition"
                        >
                            {saving ? "Saving…" : goal ? "Save Changes" : "Add Goal"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

/* ---------- Business Goals tab ---------- */

const BusinessGoalsTab = () => {
    const [goals, setGoals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [modalOpen, setModalOpen] = useState(false);
    const [activeGoal, setActiveGoal] = useState(null);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);

    const loadGoals = async () => {
        setLoading(true);
        try {
            const res = await apiGet("/business-goals");
            setGoals(res?.data || []);
        } catch (err) {
            console.error("Failed to load business goals:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadGoals();
    }, []);

    const filtered = goals.filter((g) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return `${g.goal_name} ${g.target_unit} ${g.status}`.toLowerCase().includes(q);
    });

    // Back to page 1 whenever the visible set changes shape — otherwise
    // a search/page-size change could leave currentPage pointing past
    // the end (e.g. page 3 of 1) with an empty table showing.
    useEffect(() => {
        setCurrentPage(1);
    }, [search, pageSize, goals.length]);

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

    const closeModal = () => {
        setModalOpen(false);
        setActiveGoal(null);
    };

    const handleSave = async (payload) => {
        setSaving(true);
        try {
            if (activeGoal) {
                await apiPatch(`/business-goals/${activeGoal.id}`, payload);
            } else {
                await apiPost("/business-goals", payload);
            }
            await loadGoals();
            closeModal();
        } catch (err) {
            console.error("Failed to save goal:", err);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (goal) => {
        if (!window.confirm(`Delete "${goal.goal_name}"? This can't be undone.`)) return;
        setDeletingId(goal.id);
        try {
            await apiDelete(`/business-goals/${goal.id}`);
            await loadGoals();
            closeModal();
        } catch (err) {
            console.error("Failed to delete goal:", err);
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="h-full flex flex-col gap-5">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3 min-w-0">
                    <IconBadge icon={Flag} tint="#f97316" />
                    <div className="min-w-0">
                        <p className="text-white font-semibold text-base leading-none">Business Goals</p>
                        <p className="text-xs text-gray-500 mt-1.5">Set your business goals and track progress.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                    <div className="relative">
                        <Search size={14} className="text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search goals…"
                            className="bg-black/40 border border-white/10 focus:border-orange-500/40 rounded-lg pl-8 pr-3 py-2 text-sm text-gray-200 outline-none w-52 transition"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => setModalOpen(true)}
                        className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 transition text-white text-sm font-semibold px-3.5 py-2 rounded-lg shrink-0"
                    >
                        <Plus size={15} />
                        Add Goal
                    </button>
                </div>
            </div>

            {/* Show entries */}
            <div className="flex items-center gap-2 text-sm text-gray-400">
                <span>Show</span>
                <div className="relative">
                    <select
                        value={pageSize}
                        onChange={(e) => setPageSize(Number(e.target.value))}
                        className="appearance-none bg-black/40 border border-white/10 hover:border-orange-500/30 focus:border-orange-500/50 focus:outline-none rounded-lg pl-3 pr-7 py-1.5 text-sm text-gray-200 transition cursor-pointer"
                    >
                        {[10, 25, 50, 100].map((n) => (
                            <option key={n} value={n} className="bg-[#111]">
                                {n}
                            </option>
                        ))}
                    </select>
                    <ChevronDown size={13} className="text-gray-500 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                <span>entries</span>
            </div>

            {/* Table — flex-1 so it stretches to fill the panel, which
                pushes the pagination footer down to the bottom of the
                tab instead of trailing right after the last row on a
                short table. */}
            <div className="flex-1 min-h-0 bg-[#0d0d0d] border border-white/[0.08] rounded-xl overflow-hidden flex flex-col">
                <div className="grid grid-cols-[1.8fr_1.1fr_1.6fr_1fr_auto] gap-3 px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-400 bg-white/[0.03] border-b border-orange-500/10">
                    <span>Goal</span>
                    <span>Target</span>
                    <span>Progress</span>
                    <span>Status</span>
                    <span className="text-right pr-2">Actions</span>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto">
                    {loading ? (
                        <p className="text-sm text-gray-500 text-center py-10">Loading goals…</p>
                    ) : filtered.length === 0 ? (
                        <div className="text-center py-14 px-5">
                            <p className="text-sm text-gray-300 font-medium">
                                {goals.length === 0 ? "No goals yet" : "No goals match your search"}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                                {goals.length === 0
                                    ? "Add your first goal to start tracking progress toward it."
                                    : "Try a different search term."}
                            </p>
                        </div>
                    ) : (
                        paginated.map((g) => (
                            <div
                                key={g.id}
                                className="grid grid-cols-[1.8fr_1.1fr_1.6fr_1fr_auto] gap-3 px-5 py-3.5 items-center border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02] transition"
                            >
                                <span className="text-sm text-gray-200 truncate">{g.goal_name}</span>
                                <span className="text-sm text-gray-400 truncate">
                                    {formatGoalTarget(g.target_value, g.target_unit)}
                                </span>
                                <GoalProgressBar value={g.progress_percent} />
                                <span>
                                    <GoalStatusPill status={g.status || goalStatusFor(g.progress_percent)} />
                                </span>
                                <div className="flex items-center justify-end gap-1">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setActiveGoal(g);
                                            setModalOpen(true);
                                        }}
                                        className="p-1.5 text-gray-500 hover:text-orange-400 transition"
                                        aria-label={`Edit ${g.goal_name}`}
                                    >
                                        <Pencil size={15} />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDelete(g)}
                                        disabled={deletingId === g.id}
                                        className="p-1.5 text-gray-500 hover:text-red-400 transition disabled:opacity-50"
                                        aria-label={`Delete ${g.goal_name}`}
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Pagination footer — sits at the bottom of the panel (the
                table above is flex-1, so it fills the remaining height
                and pushes this down) instead of trailing off right after
                a short table. */}
            {!loading && filtered.length > 0 && (
                <div className="shrink-0 pt-4 flex items-center justify-between gap-3 flex-wrap text-sm">
                    <p className="text-gray-500">
                        Showing {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)} of{" "}
                        {filtered.length} goal{filtered.length === 1 ? "" : "s"}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={safePage <= 1}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/10 text-gray-300 hover:border-orange-500/40 hover:text-orange-400 transition disabled:opacity-40 disabled:hover:border-white/10 disabled:hover:text-gray-300"
                        >
                            <ChevronLeft size={14} />
                            Previous
                        </button>
                        <span className="px-3 py-1.5 rounded-lg bg-orange-500 text-white text-xs font-semibold">
                            {safePage}
                        </span>
                        <span className="text-gray-500 text-xs">of {totalPages}</span>
                        <button
                            type="button"
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={safePage >= totalPages}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/10 text-gray-300 hover:border-orange-500/40 hover:text-orange-400 transition disabled:opacity-40 disabled:hover:border-white/10 disabled:hover:text-gray-300"
                        >
                            Next
                            <ChevronRight size={14} />
                        </button>
                    </div>
                </div>
            )}

            {modalOpen && (
                <GoalFormModal
                    goal={activeGoal}
                    saving={saving}
                    deleting={deletingId === activeGoal?.id}
                    onClose={closeModal}
                    onSave={handleSave}
                    onDelete={handleDelete}
                />
            )}
        </div>
    );
};

const ComingSoonTab = ({ label, icon: Icon }) => (
    <div className="h-full flex flex-col items-center justify-center text-center gap-2 py-20">
        <div className="h-12 w-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 mb-2">
            <Icon size={20} />
        </div>
        <p className="text-white font-semibold">{label}</p>
        <p className="text-sm text-gray-500 max-w-sm">
            This section isn't set up yet — content for {label.toLowerCase()} will live here.
        </p>
    </div>
);

/* ---------- shell: header + tab bar ---------- */

const BusinessWorkspaceSection = () => {
    const [activeTab, setActiveTab] = useState(TABS[0].label);
    const [data, setData] = useState(DEFAULT_STATE);
    const [showGuide, setShowGuide] = useState(false);
    const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error

    const [targetAudience, setTargetAudience] = useState(DEFAULT_TARGET_AUDIENCE_STATE);
    const [taSaveState, setTaSaveState] = useState("idle"); // idle | saving | saved | error
    // Dropdown options for the 5 "Other"-enabled Target Audience selects —
    // starts as the static fallback lists, then gets any previously-saved
    // custom values folded in once GET /dropdown-options/target_* resolves.
    const [taOptions, setTaOptions] = useState({
        country: COUNTRY_OPTIONS,
        state: STATE_OPTIONS,
        industry: TARGET_INDUSTRY_OPTIONS,
        companySize: COMPANY_SIZE_OPTIONS,
        customerCount: CUSTOMER_COUNT_OPTIONS,
    });

    const [products, setProducts] = useState([]);
    const [productsLoading, setProductsLoading] = useState(true);
    const [planOptions, setPlanOptions] = useState(FALLBACK_PLAN_OPTIONS);

    const [teamMembers, setTeamMembers] = useState([]);
    const [teamMembersLoading, setTeamMembersLoading] = useState(true);

    // Reusable so both the initial load and the Team & Users tab (after
    // invite/edit/remove) can refresh this company's team list.
    const loadTeamMembers = async () => {
        setTeamMembersLoading(true);
        try {
            const res = await apiGet("/team-members");
            setTeamMembers(res?.data || []);
        } catch (err) {
            console.error("Failed to load team members:", err);
        } finally {
            setTeamMembersLoading(false);
        }
    };

    // Reusable so both the initial load and the Products & Services tab
    // (after add/edit/delete) can refresh this company's product list.
    const loadProducts = async () => {
        setProductsLoading(true);
        try {
            const res = await apiGet("/products");
            setProducts(res?.data || []);
        } catch (err) {
            console.error("Failed to load products:", err);
        } finally {
            setProductsLoading(false);
        }
    };

    // Load this company's business info, its own products, and the
    // platform's named subscription plans — all scoped server-side by
    // the JWT, so every login only ever sees its own data.
    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const res = await apiGet("/business-info");
                if (!cancelled && res?.data) {
                    const d = res.data;
                    setData((prev) => ({
                        ...prev,
                        businessModel: d.business_model || prev.businessModel,
                        dealSize: d.deal_size || prev.dealSize,
                        salesCycle: d.sales_cycle || prev.salesCycle,
                        pricingModel: d.pricing_model || prev.pricingModel,
                        // NOTE: "plans" is intentionally NOT loaded/saved here — billing
                        // isn't wired up yet, so there's nothing real to persist. It's
                        // local-only UI state for now (see handleSave below); once
                        // payments exist, the active plan should come from that
                        // system, not from this dropdown.
                        services: d.services?.length ? d.services : prev.services,
                        stages: d.stages?.length ? d.stages : prev.stages,
                    }));
                }
            } catch (err) {
                console.error("Failed to load business info:", err);
            }
        })();

        loadProducts();
        loadTeamMembers();

        (async () => {
            try {
                const res = await apiGet("/dropdown-options/subscription_plan");
                if (!cancelled && res?.data?.length) setPlanOptions(res.data);
            } catch (err) {
                console.error("Failed to load subscription plans:", err);
            }
        })();

        (async () => {
            try {
                const res = await apiGet("/target-audience");
                if (!cancelled && res?.data) {
                    const d = res.data;
                    setTargetAudience((prev) => ({
                        country: d.country || prev.country,
                        state: d.state?.length ? d.state : prev.state,
                        cities: d.cities?.length ? d.cities : prev.cities,
                        industry: d.industry || prev.industry,
                        companySize: d.company_size || prev.companySize,
                        customerCount: d.customer_count || prev.customerCount,
                        decisionMakers: d.decision_makers?.length ? d.decision_makers : prev.decisionMakers,
                        designations: d.designations?.length ? d.designations : prev.designations,
                        painPoints: d.pain_points?.length ? d.pain_points : prev.painPoints,
                        budgetRange: d.budget_range || prev.budgetRange,
                        keywords: d.keywords?.length ? d.keywords : prev.keywords,
                    }));
                }
            } catch (err) {
                console.error("Failed to load target audience:", err);
            }
        })();

        (async () => {
            const fallbacks = {
                country: COUNTRY_OPTIONS,
                state: STATE_OPTIONS,
                industry: TARGET_INDUSTRY_OPTIONS,
                companySize: COMPANY_SIZE_OPTIONS,
                customerCount: CUSTOMER_COUNT_OPTIONS,
            };
            const entries = await Promise.all(
                Object.entries(TARGET_DROPDOWN_FIELD_MAP).map(async ([key, fieldName]) => {
                    try {
                        const res = await apiGet(`/dropdown-options/${fieldName}`);
                        return [key, mergeOptions(fallbacks[key], res?.data || [])];
                    } catch (err) {
                        console.error(`Failed to load custom options for ${fieldName}:`, err);
                        return [key, fallbacks[key]];
                    }
                })
            );
            if (!cancelled) setTaOptions(Object.fromEntries(entries));
        })();

        return () => {
            cancelled = true;
        };
    }, []);

    const handleSave = async () => {
        setSaveState("saving");
        try {
            const { businessModel, dealSize, salesCycle, pricingModel, services, stages } = data;
            // "plans" (Subscription Plan) is deliberately excluded — not persisted
            // until billing/payment is actually wired up, see notes above.
            await apiPut("/business-info", {
                business_model: businessModel,
                deal_size: dealSize,
                sales_cycle: salesCycle,
                pricing_model: pricingModel,
                services,
                stages,
            });
            setSaveState("saved");
        } catch (err) {
            console.error("Failed to save business info:", err);
            setSaveState("error");
        } finally {
            setTimeout(() => setSaveState("idle"), 1800);
        }
    };

    const handleSaveTargetAudience = async () => {
        setTaSaveState("saving");
        try {
            const { country, state, cities, industry, companySize, customerCount, decisionMakers, designations, painPoints, budgetRange, keywords } = targetAudience;
            await apiPut("/target-audience", {
                country,
                state,
                cities,
                industry,
                company_size: companySize,
                customer_count: customerCount,
                decision_makers: decisionMakers,
                designations,
                pain_points: painPoints,
                budget_range: budgetRange,
                keywords,
            });
            setTaSaveState("saved");
        } catch (err) {
            console.error("Failed to save target audience:", err);
            setTaSaveState("error");
        } finally {
            setTimeout(() => setTaSaveState("idle"), 1800);
        }
    };

    // Called from a Target Audience select's "Other" input. Saves the typed
    // value to the shared custom_dropdown_options table (so it's a normal
    // option for every company from now on), folds it into this select's
    // local option list, and applies it as the field's new value — all in
    // one round trip, which is why SelectFieldWithOther is handed a single
    // onAddCustom(value) rather than separate save/select callbacks.
    const handleAddCustomTargetOption = (key, applyValue) => async (value) => {
        const fieldName = TARGET_DROPDOWN_FIELD_MAP[key];
        const res = await apiPost(`/dropdown-options/${fieldName}`, { value });
        setTaOptions((prev) => ({ ...prev, [key]: mergeOptions(prev[key], res?.data || [value]) }));
        applyValue(value);
    };

    const activeMeta = TABS.find((t) => t.label === activeTab);

    return (
        <div className="business-workspace-section h-full flex flex-col">
            {/* Hides the native up/down scrollbar arrow buttons (the little
                triangle buttons at the top/bottom of the scrollbar track,
                shown by default on Windows/Chrome) across this workspace,
                and replaces them with a slim, button-less scrollbar. */}
            <style>{`
                .business-workspace-section ::-webkit-scrollbar {
                    width: 6px;
                    height: 6px;
                }
                .business-workspace-section ::-webkit-scrollbar-button {
                    display: none;
                    width: 0;
                    height: 0;
                }
                .business-workspace-section ::-webkit-scrollbar-track {
                    background: transparent;
                }
                .business-workspace-section ::-webkit-scrollbar-thumb {
                    background-color: rgba(255, 255, 255, 0.12);
                    border-radius: 9999px;
                }
                .business-workspace-section ::-webkit-scrollbar-thumb:hover {
                    background-color: rgba(255, 255, 255, 0.2);
                }
                .business-workspace-section {
                    scrollbar-width: thin;
                    scrollbar-color: rgba(255, 255, 255, 0.12) transparent;
                }
            `}</style>
            {/* Header */}
            <div className="flex items-center justify-between pt-5 pb-4 shrink-0 gap-4">
                <div className="min-w-0">
                    <h1 className="text-xl font-bold text-white leading-none">Business Workspace</h1>
                    <p className="text-xs text-gray-500 mt-1.5">Manage your business data, settings and integrations</p>
                </div>
                {(activeTab === "Business Info" || activeTab === "Target Audience") && (
                    <div className="flex items-center gap-2.5 shrink-0">
                        {activeTab === "Business Info" && (
                            <button
                                type="button"
                                onClick={() => setShowGuide((v) => !v)}
                                className="flex items-center gap-2 border border-white/10 hover:border-orange-500/40 text-gray-300 hover:text-orange-400 text-sm px-3.5 py-2 rounded-lg transition"
                            >
                                <Lightbulb size={15} />
                                Business Info Guide
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={activeTab === "Business Info" ? handleSave : handleSaveTargetAudience}
                            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 transition text-white text-sm font-semibold px-4 py-2 rounded-lg"
                        >
                            <CheckCircle size={15} />
                            {(() => {
                                const s = activeTab === "Business Info" ? saveState : taSaveState;
                                return s === "saving"
                                    ? "Saving…"
                                    : s === "saved"
                                    ? "Saved"
                                    : s === "error"
                                    ? "Couldn't save — retry"
                                    : "Save Changes";
                            })()}
                        </button>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-5 border-b border-orange-600/10 shrink-0 overflow-x-auto">
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.label;
                    return (
                        <button
                            key={tab.label}
                            onClick={() => setActiveTab(tab.label)}
                            className={`relative flex items-center gap-1.5 pb-3 text-sm whitespace-nowrap transition ${
                                active ? "text-orange-500 font-semibold" : "text-gray-400 hover:text-white"
                            }`}
                        >
                            <Icon size={14} />
                            {tab.label}
                            {active && <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-orange-500 rounded-full" />}
                        </button>
                    );
                })}
            </div>

            {/* Tab content */}
            <div className="flex-1 min-h-0 overflow-y-auto py-5 pr-1">
                {activeTab === "Business Info" ? (
                    <BusinessInfoTab
                        data={data}
                        setData={setData}
                        showGuide={showGuide}
                        setShowGuide={setShowGuide}
                        products={products}
                        productsLoading={productsLoading}
                        planOptions={planOptions}
                    />
                ) : activeTab === "Products & Services" ? (
                    <ProductsServicesTab
                        products={products}
                        productsLoading={productsLoading}
                        refetchProducts={loadProducts}
                    />
                ) : activeTab === "Target Audience" ? (
                    <TargetAudienceTab
                        data={targetAudience}
                        setData={setTargetAudience}
                        options={taOptions}
                        onAddCustomOption={handleAddCustomTargetOption}
                    />
                ) : activeTab === "Team & Users" ? (
                    <TeamUsersTab
                        members={teamMembers}
                        membersLoading={teamMembersLoading}
                        refetchMembers={loadTeamMembers}
                    />
                ) : activeTab === "AI Knowledge Base" ? (
                    <AIKnowledgeBaseTab />
                ) : activeTab === "Business Goals" ? (
                    <BusinessGoalsTab />
                ) : (
                    <ComingSoonTab label={activeTab} icon={activeMeta.icon} />
                )}
            </div>
        </div>
    );
};

export default BusinessWorkspaceSection;