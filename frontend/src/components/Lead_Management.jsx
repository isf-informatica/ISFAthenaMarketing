import React, { useState, useMemo, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import {
    ChevronDown,
    ExternalLink,
    Pencil,
    Check,
    Plus,
    X,
    Loader2,
    Search,
    Upload,
    Download,
    Radar,
    Flame,
    Globe,
    MessageCircle,
    Share2,
    Briefcase,
    Camera,
    Mail,
    Users,
    AlertTriangle,
    Bot,
    Sparkles,
    RefreshCw,
} from "lucide-react";
import { useCustomerData } from "./CustomerDataContext";
import ReachableChannelsCard from "./ReachableChannelsCard";
import { GROQ_API_KEY, GROQ_MODEL } from "./groqConfig";

/* ==========================================================
   FIELD CONFIG (mirrors prospectus.php "Add Lead Generation" form)
========================================================== */
const countryOptions = [
    "India",
    "United States of America",
    "Canada",
    "United Kingdom",
    "Australia",
    "United Arab Emirates",
    "Singapore",
    "Germany",
    "France",
    "Other",
];
const gmbStatusOptions = ["Claimed", "Unclaimed", "Uncategorized"];
const assignedOptions = ["Tapan", "Andrew", "Surej", "Uncategorized"];
const statusOptions = ["Open", "Mail Send", "Phone Contacted", "Success", "Closed"];

// NEW — lead source list for the form's "Source" field. Each also
// drives the icon shown in the SOURCE column of the table below.
const sourceOptions = [
    { value: "Website", icon: Globe },
    { value: "WhatsApp", icon: MessageCircle },
    { value: "Facebook", icon: Share2 },
    { value: "Google Ads", icon: Search },
    { value: "Referral", icon: Users },
    { value: "LinkedIn", icon: Briefcase },
    { value: "Instagram", icon: Camera },
    { value: "Email Campaign", icon: Mail },
];
const sourceIconMap = Object.fromEntries(sourceOptions.map((s) => [s.value, s.icon]));

const initialFormState = {
    product_id: "",
    country: "",
    user_name: "",
    user_address: "",
    gmb_status: "",
    web_url: "",
    user_num: "",
    user_email: "",
    assigned_prospect: "",
    comment: "",
    lead_source: "",
    current_status: "Open",
};

// Pre-selects whichever product this dashboard is currently for, so the
// common case (adding a lead for the product you're already looking at)
// needs zero extra clicks — the user can still change it in the dropdown.
const getInitialFormState = () => ({
    ...initialFormState,
    product_id: localStorage.getItem(ACTIVE_PRODUCT_KEY) || "",
});

/* Validation helpers ported from prospectus.php */
const isValidName = (name) => /^([a-zA-Z]+\s)*[a-zA-Z]+$/.test(name) && name.length >= 2 && name.length < 50;
const isValidNumber = (num) => /^[0-9]{10}$/.test(num);
const isValidEmail = (email) => /\S+@\S+\.\S+/.test(email);
const isValidUrl = (value) =>
    /^(?!mailto:)(?:(?:http|https|ftp):\/\/)(?:\S+(?::\S*)?@)?(?:(?:(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[0-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\u00a1-\uffff0-9]+-?)*[a-z\u00a1-\uffff0-9]+)(?:\.(?:[a-z\u00a1-\uffff0-9]+-?)*[a-z\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\u00a1-\uffff]{2,})))|localhost)(?::\d{2,5})?(?:(\/|\?|#)[^\s]*)?$/.test(
        value.trim()
    );

// Columns expected in an imported/exported CSV — matches the Lead model
// fields in growthos_backend/main.py exactly (order doesn't matter for
// import; header names are matched case-insensitively).
const CSV_FIELDS = [
    "user_name", "user_email", "user_mobile_number", "country",
    "user_address", "gmb_status", "web_url", "assigned_prospect",
    "current_status", "prospect_comment", "lead_source",
];

// Minimal RFC4180-ish CSV parser — handles quoted fields (with embedded
// commas/newlines) and "" escaped quotes, no external library needed.
const parseCSV = (text) => {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const next = text[i + 1];

        if (inQuotes) {
            if (char === '"' && next === '"') {
                field += '"';
                i++;
            } else if (char === '"') {
                inQuotes = false;
            } else {
                field += char;
            }
        } else if (char === '"') {
            inQuotes = true;
        } else if (char === ",") {
            row.push(field);
            field = "";
        } else if (char === "\n" || char === "\r") {
            if (char === "\r" && next === "\n") i++;
            row.push(field);
            rows.push(row);
            row = [];
            field = "";
        } else {
            field += char;
        }
    }
    if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
    }
    return rows.filter((r) => r.some((c) => c.trim() !== ""));
};

// Turns parsed CSV rows into lead payload objects, matching against
// CSV_FIELDS by header name (case-insensitive, ignores unknown columns).
const csvRowsToLeadPayloads = (rows) => {
    if (rows.length < 2) return [];
    const headers = rows[0].map((h) => h.trim().toLowerCase());
    return rows.slice(1).map((cells) => {
        const payload = {};
        CSV_FIELDS.forEach((field) => {
            const idx = headers.indexOf(field);
            payload[field] = idx !== -1 ? (cells[idx] || "").trim() : "";
        });
        return payload;
    });
};

// CSV-escapes a single cell value for export.
const csvEscape = (value) => {
    const str = String(value ?? "");
    if (/[",\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
};

const leadsToCSV = (leads) => {
    const header = CSV_FIELDS.join(",");
    const lines = leads.map((lead) => CSV_FIELDS.map((f) => csvEscape(lead[f])).join(","));
    return [header, ...lines].join("\n");
};

const downloadCSV = (csvText, filename) => {
    const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

/* Reusable themed field wrapper */
const Field = ({ label, children, error, colSpan = "", required = false }) => (
    <div className={colSpan}>
        <label className="block text-xs font-semibold tracking-wider text-gray-400 uppercase mb-2">
            {label}
            {required && <span className="text-orange-500 ml-1">*</span>}
        </label>
        {children}
        {error && <p className="mt-1.5 text-xs text-red-400">{error}</p>}
    </div>
);

const inputClasses = (hasError) =>
    `w-full bg-black/60 border ${
        hasError ? "border-red-500/70" : "border-white/10"
    } rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 outline-none focus:border-orange-500/70 focus:ring-1 focus:ring-orange-500/40 transition duration-200`;

const SelectField = ({ id, value, onChange, options, hasError, placeholder = "Select" }) => (
    <div className="relative">
        <select
            id={id}
            value={value}
            onChange={onChange}
            className={`${inputClasses(hasError)} appearance-none pr-10 cursor-pointer`}
        >
            <option value="" disabled>
                {placeholder}
            </option>
            {options.map((opt) => (
                <option key={opt} value={opt} className="bg-black text-white">
                    {opt}
                </option>
            ))}
        </select>
        <ChevronDown
            size={16}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
        />
    </div>
);

// Like SelectField, but lets the user either pick from the list or
// type a value that isn't in it (e.g. a country not on the list).
const ComboboxField = ({ id, value, onChange, options, hasError, placeholder = "Select or type" }) => (
    <>
        <input
            id={id}
            list={`${id}-options`}
            type="text"
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            autoComplete="off"
            className={inputClasses(hasError)}
        />
        <datalist id={`${id}-options`}>
            {options.map((opt) => (
                <option key={opt} value={opt} />
            ))}
        </datalist>
    </>
);

/* ==========================================================
   API CONFIG (insert only — the list is now owned by
   CustomerDataContext so Customer 360 can share it)

   This now points at the new project's own FastAPI backend
   (growthos_backend/main.py), which writes ONLY into
   isfathena.lead_generation. It does NOT touch the old
   EasyLearn database — that connection is kept completely
   separate (see fetch_easylearn_leads() in main.py, used only
   for read-only merging on GET /leads/all if you choose to
   wire that up in CustomerDataContext).
========================================================== */
// TODO: point this at wherever growthos_backend is actually deployed
// (matches ALLOWED_ORIGINS / the app's host in main.py).
const API_BASE_URL = "http://localhost:8000";
const INSERT_PROSPECT_ENDPOINT = `${API_BASE_URL}/leads`;
const editLeadEndpoint = (leadId) => `${API_BASE_URL}/leads/${leadId}`;
const ASSIGN_LEADS_ENDPOINT = `${API_BASE_URL}/leads/assign`;
const SEND_EMAIL_ENDPOINT = `${API_BASE_URL}/send-email`;
const VERIFY_URL_ENDPOINT = `${API_BASE_URL}/verify-url`;
const PRODUCTS_ENDPOINT = `${API_BASE_URL}/products`;
const markContactedEndpoint = (leadId) => `${API_BASE_URL}/leads/${leadId}/mark-contacted`;

// /leads, /leads/assign, and /leads/{id}/mark-contacted are all
// company-scoped server-side now — every call needs this, or the
// backend rejects it outright.
const authHeaders = () => {
    const token = localStorage.getItem("growthos_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
};

// Same key Home.jsx/PricingPage.jsx/Growthosdashboard.jsx/
// LeadGenerationSection.jsx all read and write — whichever product's
// dashboard this is, new leads default to (and get scoped to) that
// product unless the user picks a different one from the dropdown.
const ACTIVE_PRODUCT_KEY = "growthos_active_product_id";

const EMAIL_SUBJECT = "Thank you for your interest in GrowthOS AI";
const emailBodyTemplate = (name) =>
    `Dear ${name},\n\nThank you for showing interest in GrowthOS AI.\nWe have successfully received your request.\n\nOur AI platform is designed to help businesses with:\n• Lead Generation\n• CRM Management\n• AI Marketing Automation\n• WhatsApp Campaigns\n• Email Campaigns\n• Customer Analytics\n\nOne of our experts will contact you shortly to understand your business requirements and schedule a personalized demo.\n\nIf you have any questions, simply reply to this email.\n\nThank you for choosing GrowthOS AI.\n\nBest Regards,\nGrowthOS AI Team\nAutonomous Revenue Platform\nhttps://isfathena.com/`;

// The STATUS column shows whether this lead has actually been reached out
// to yet (via the Reachable Channels card — Email/SMS/WhatsApp/Call),
// not the "current_status" form field (Open/Mail Send/etc — that one
// still drives the Status filter and nextActionLabel below).
const contactBadgeClasses = (isContacted) =>
    isContacted
        ? "bg-green-500/10 text-green-400 border-green-500/30"
        : "bg-red-500/10 text-red-400 border-red-500/30";

// What the NEXT ACTION button says for each status — all of them
// currently open the same working "contact this lead" flow below
// (WhatsApp / Email / SMS / Call via ReachableChannelsCard).
const nextActionLabel = (status) => {
    const map = {
        Open: "Contact Now",
        "Mail Send": "Follow Up",
        "Phone Contacted": "Follow Up",
        Success: "Create Deal",
        Closed: "Re-engage",
    };
    return map[status] || "Contact Now";
};

/**
 * Simple heuristic lead score (0–99) — NOT a real AI model. Until
 * a proper scoring pipeline exists, this gives a stable, deterministic
 * number per lead (based on status + id) so the AI SCORE column has
 * something meaningful to sort/filter on instead of being blank.
 */
const computeLeadScore = (lead) => {
    const statusWeights = { Success: 88, "Phone Contacted": 74, "Mail Send": 58, Open: 44, Closed: 28 };
    const base = statusWeights[lead.current_status] ?? 50;
    const jitter = (Number(lead.id) || 0) % 10;
    return Math.min(99, base + jitter);
};

// AI Score is now persisted server-side (lead_generation.ai_score,
// computed in growthos_backend/main.py at insert time). Use that value
// when it's present; only fall back to the old client-side heuristic
// for rows saved before this column existed (ai_score is null/undefined).
const getLeadScore = (lead) =>
    lead.ai_score === null || lead.ai_score === undefined ? computeLeadScore(lead) : Number(lead.ai_score);

const scoreVisual = (score) => {
    if (score >= 80) return { icon: Flame, className: "text-orange-500" };
    if (score >= 50) return { icon: Radar, className: "text-amber-400" };
    return { icon: Radar, className: "text-gray-500" };
};

const initials = (name) =>
    (name || "?")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join("") || "?";

// Website URLs on AI Search leads are AI-inferred, not real, live-verified
// data — the domain frequently doesn't exist. This checks it for real,
// right when clicked, instead of opening a dead tab.
const VerifiedWebsiteLink = ({ url }) => {
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
        <span className="inline-flex flex-col min-w-0">
            <button
                type="button"
                onClick={handleClick}
                disabled={checking}
                className="text-orange-400 hover:text-orange-300 flex items-center gap-1 min-w-0"
            >
                <span className="truncate">{url}</span>
                {checking ? (
                    <Loader2 size={11} className="shrink-0 animate-spin" />
                ) : (
                    <ExternalLink size={11} className="shrink-0" />
                )}
            </button>
            {unreachable && <span className="text-red-400 text-[10px]">Unreachable</span>}
        </span>
    );
};

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 10;

/* ==========================================================
   LEAD MANAGEMENT (id="sec-campaign-builder")
========================================================== */
const CampaignBuilderSection = () => {
    const [form, setForm] = useState(getInitialFormState);
    const [products, setProducts] = useState([]);
    const [productsLoading, setProductsLoading] = useState(true);
    // Page-level product switcher (header) — the whole table is scoped to
    // this product, same key Home.jsx/PricingPage.jsx/Growthosdashboard.jsx/
    // LeadGenerationSection.jsx read and write.
    const [selectedProductId, setSelectedProductId] = useState(
        () => localStorage.getItem(ACTIVE_PRODUCT_KEY) || ""
    );
    const [errors, setErrors] = useState({});
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [showFormModal, setShowFormModal] = useState(false);
    const [editingLead, setEditingLead] = useState(null); // null = Add mode; a lead object = Edit mode

    // Arrived here via Dashboard's "Add Lead" Quick Action? Open the form
    // automatically, then clear the nav state so a refresh/back doesn't
    // reopen it.
    const location = useLocation();
    const navigate = useNavigate();
    useEffect(() => {
        if (location.state?.openAddLead) {
            setShowFormModal(true);
            navigate(location.pathname, { replace: true, state: {} });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.state]);

    // Row clicked in the leads table — opens the Reachable Channels
    // + AI chat card for that lead. This is what makes "Contact Now"
    // (and every other NEXT ACTION button) actually workable.
    const [channelsLead, setChannelsLead] = useState(null);

    // Toolbar / filter state
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [sourceFilter, setSourceFilter] = useState("All");
    const [assignedFilter, setAssignedFilter] = useState("All");
    const [selectedIds, setSelectedIds] = useState([]);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

    // AI Lead Agent
    const [agentModalOpen, setAgentModalOpen] = useState(false);
    const [agentLoading, setAgentLoading] = useState(false);
    const [agentError, setAgentError] = useState("");
    const [agentResult, setAgentResult] = useState("");
    const [agentRecommended, setAgentRecommended] = useState([]);

    // CSV import
    const fileInputRef = useRef(null);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState(null); // { success, failed, errors: [] }

    // Bulk "Assign" (multi-select bar)
    const [assignModalOpen, setAssignModalOpen] = useState(false);
    const [assignTarget, setAssignTarget] = useState("");
    const [assigning, setAssigning] = useState(false);
    const [assignError, setAssignError] = useState("");

    // Bulk "Send Email" (multi-select bar)
    const [bulkEmailModalOpen, setBulkEmailModalOpen] = useState(false);
    const [bulkEmailSending, setBulkEmailSending] = useState(false);
    const [bulkEmailResult, setBulkEmailResult] = useState(null); // { success, failed, errors: [] }

    // Leads come from the shared context (fetched once at the
    // dashboard level) instead of a local fetch — Customer 360 reads
    // the exact same list.
    const { leads, leadsLoading, leadsError, fetchLeads } = useCustomerData();

    // Header's page-level Product switcher — changes which product's
    // leads the WHOLE table (and every other CustomerDataContext
    // consumer, e.g. Customer 360) shows.
    const handleSwitchProduct = (id) => {
        setSelectedProductId(id);
        localStorage.setItem(ACTIVE_PRODUCT_KEY, id);
        setForm((f) => ({ ...f, product_id: id })); // keep Add Lead's default in sync
        fetchLeads();
    };

    // Powers both the header's page-level Product switcher AND the "Add
    // Lead" form's Product dropdown — every lead now belongs to one of
    // the company's products.
    useEffect(() => {
        (async () => {
            setProductsLoading(true);
            try {
                const res = await fetch(PRODUCTS_ENDPOINT, { method: "GET", headers: authHeaders() });
                const resp = await res.json().catch(() => null);
                const list = res.ok && resp?.success && Array.isArray(resp.data) ? resp.data : [];
                setProducts(list);
                // Nothing active yet (e.g. arrived here directly, not via a
                // product card on Home) — default to the first product so
                // the page always has a definite product context.
                let neededFallback = false;
                setSelectedProductId((prev) => {
                    if (prev && list.some((p) => String(p.id) === String(prev))) return prev;
                    const fallback = list.length ? String(list[0].id) : "";
                    if (fallback) {
                        localStorage.setItem(ACTIVE_PRODUCT_KEY, fallback);
                        neededFallback = true;
                    }
                    return fallback;
                });
                // CustomerDataContext's own initial fetch may have already
                // run before this default was set — refresh now so the
                // table is properly product-scoped from the start.
                if (neededFallback) fetchLeads();
            } catch (err) {
                setProducts([]);
            } finally {
                setProductsLoading(false);
            }
        })();
    }, []);

    React.useEffect(() => {
        if (showFormModal || submitted || channelsLead) {
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = originalOverflow;
            };
        }
    }, [showFormModal, submitted, channelsLead]);

    const handleChange = (field) => (e) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const nextErrors = {};

        if (!form.product_id) nextErrors.product_id = "Select which product this lead is for";
        if (!isValidName(form.user_name.trim())) nextErrors.user_name = "Enter a valid name";
        if (form.web_url.trim() && !isValidUrl(form.web_url)) nextErrors.web_url = "Website URL is invalid";
        if (!isValidNumber(form.user_num)) nextErrors.user_num = "Enter a valid 10-digit number";
        if (!isValidEmail(form.user_email)) nextErrors.user_email = "Invalid email address";
        if (!form.country) nextErrors.country = "Select a country";
        if (!form.lead_source) nextErrors.lead_source = "Select where this lead came from";

        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) return;

        // Payload matches main.py's `Lead` pydantic model exactly.
        // user_type / connected_date are gone (dropped from the table).
        // In Edit mode, current_status comes from the form (the person can
        // change it); in Add mode every new lead still starts as "Open".
        const payload = {
            product_id: Number(form.product_id),
            country: form.country,
            user_name: form.user_name,
            user_address: form.user_address,
            gmb_status: form.gmb_status,
            web_url: form.web_url,
            user_mobile_number: form.user_num,
            user_email: form.user_email,
            assigned_prospect: form.assigned_prospect,
            current_status: editingLead ? form.current_status : "Open",
            prospect_comment: form.comment,
            lead_source: form.lead_source,
        };

        setSubmitting(true);
        try {
            const res = await fetch(
                editingLead ? editLeadEndpoint(editingLead.id) : INSERT_PROSPECT_ENDPOINT,
                {
                    method: editingLead ? "PATCH" : "POST",
                    headers: { "Content-Type": "application/json", ...authHeaders() },
                    body: JSON.stringify(payload),
                }
            );
            const resp = await res.json();

            if (res.ok && resp.success) {
                setSubmitted(!editingLead); // "Lead added!" confirmation only makes sense for Add
                setForm(getInitialFormState());
                setEditingLead(null);
                setShowFormModal(false);
                fetchLeads(); // refresh the shared list — Customer 360 updates too
            } else {
                setErrors({ submit: resp.message || resp.detail || "Could not save this lead. Please try again." });
            }
        } catch (err) {
            setErrors({ submit: "Network error — please check your connection and try again." });
        } finally {
            setSubmitting(false);
        }
    };

    const closeFormModal = () => {
        setShowFormModal(false);
        setEditingLead(null);
        setErrors({});
    };

    // Pre-fills the same Add/Edit modal from an existing lead's current
    // DB values — field names mapped from the DB shape (user_mobile_number,
    // prospect_comment) to the form's shape (user_num, comment).
    const openEditLead = (lead) => {
        setForm({
            product_id: lead.product_id != null ? String(lead.product_id) : "",
            country: lead.country || "",
            user_name: lead.user_name || "",
            user_address: lead.user_address || "",
            gmb_status: lead.gmb_status || "",
            web_url: lead.web_url || "",
            user_num: lead.user_mobile_number || "",
            user_email: lead.user_email || "",
            assigned_prospect: lead.assigned_prospect || "",
            comment: lead.prospect_comment || "",
            lead_source: lead.lead_source || "",
            current_status: lead.current_status || "Open",
        });
        setErrors({});
        setEditingLead(lead);
        setShowFormModal(true);
    };

    /* ---------------- CSV import / export ---------------- */

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleImportFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = ""; // allow re-selecting the same file next time
        if (!file) return;

        setImporting(true);
        setImportResult(null);
        try {
            const text = await file.text();
            const rows = parseCSV(text);
            const payloads = csvRowsToLeadPayloads(rows);

            if (payloads.length === 0) {
                setImportResult({ success: 0, failed: 0, errors: ["No rows found — check the CSV has a header row plus at least one data row."] });
                return;
            }

            let success = 0;
            const errors = [];

            // Sequential, not Promise.all — keeps error attribution simple
            // and avoids hammering the backend with a huge burst of inserts.
            // CSV rows don't carry a per-row product — every imported lead
            // is tagged with whichever product this dashboard is currently
            // for (same default the manual Add Lead form uses).
            const activeProductId = localStorage.getItem(ACTIVE_PRODUCT_KEY);

            for (let i = 0; i < payloads.length; i++) {
                const payload = { ...payloads[i], product_id: activeProductId ? Number(activeProductId) : null };
                if (!payload.user_name) {
                    errors.push(`Row ${i + 2}: missing user_name — skipped`);
                    continue;
                }
                try {
                    const res = await fetch(INSERT_PROSPECT_ENDPOINT, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", ...authHeaders() },
                        body: JSON.stringify(payload),
                    });
                    const resp = await res.json().catch(() => null);
                    if (res.ok && resp?.success) {
                        success++;
                    } else {
                        errors.push(`Row ${i + 2} (${payload.user_name}): ${resp?.message || resp?.detail || "failed"}`);
                    }
                } catch (err) {
                    errors.push(`Row ${i + 2} (${payload.user_name}): network error`);
                }
            }

            setImportResult({ success, failed: errors.length, errors });
            if (success > 0) fetchLeads(); // refresh the shared list once, after all rows are done
        } catch (err) {
            setImportResult({ success: 0, failed: 0, errors: ["Could not read that file — make sure it's a valid .csv file."] });
        } finally {
            setImporting(false);
        }
    };

    const handleExportCSV = () => {
        const csv = leadsToCSV(filteredLeads.length ? filteredLeads : leads);
        const stamp = new Date().toISOString().slice(0, 10);
        downloadCSV(csv, `leads-export-${stamp}.csv`);
    };

    /* ---------------- AI Lead Agent ---------------- */
    const isGroqConfigured =
        Boolean(GROQ_API_KEY) && GROQ_API_KEY !== "PASTE_YOUR_GROQ_API_KEY_HERE";

    const runLeadAgent = async () => {
        setAgentModalOpen(true);
        setAgentLoading(true);
        setAgentError("");

        // Priority list computed directly from real data, in JS — not
        // asked from the model — so it's always exactly right, never a
        // hallucinated subset. "Priority" = due (not contacted) AND
        // score >= 70, sorted hottest first.
        const priority = leads
            .filter((l) => !l.is_contacted && getLeadScore(l) >= 70)
            .sort((a, b) => getLeadScore(b) - getLeadScore(a))
            .slice(0, 15);
        setAgentRecommended(priority);

        const unassigned = leads.filter((l) => !l.assigned_prospect || l.assigned_prospect === "Uncategorized").length;
        const due = leads.filter((l) => !l.is_contacted).length;
        const hot = leads.filter((l) => getLeadScore(l) >= 80).length;
        const sourceCounts = {};
        leads.forEach((l) => {
            const k = l.lead_source?.trim() || "Not specified";
            sourceCounts[k] = (sourceCounts[k] || 0) + 1;
        });
        const sourceLine = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]).map(([s, c]) => `${s}: ${c}`).join(", ") || "no data";

        if (!isGroqConfigured) {
            setAgentError("AI agent unavailable — Groq API key not configured.");
            setAgentLoading(false);
            return;
        }

        try {
            const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
                body: JSON.stringify({
                    model: GROQ_MODEL,
                    temperature: 0.5,
                    max_tokens: 350,
                    messages: [
                        {
                            role: "user",
                            content:
                                `You are the AI Lead Management Agent for a CRM. Real data: ${leads.length} total leads, ${hot} hot (score 80+), ` +
                                `${due} not yet contacted, ${unassigned} with nobody assigned. Lead sources: ${sourceLine}. ` +
                                `${priority.length} leads are both hot and uncontacted — the top priority list.\n\n` +
                                `Based ONLY on these real numbers, write a short 3-4 bullet summary of what needs attention today. ` +
                                `Don't invent any numbers not given above. Keep each bullet under 15 words.`,
                        },
                    ],
                }),
            });
            if (!res.ok) throw new Error(`Groq responded with ${res.status}`);
            const data = await res.json();
            setAgentResult(data?.choices?.[0]?.message?.content?.trim() || "No response.");
        } catch (err) {
            setAgentError("Couldn't reach the AI right now — try again in a moment.");
        } finally {
            setAgentLoading(false);
        }
    };

    // Hands off to the EXISTING bulk-action bar (Assign / Send Email) —
    // this is the actual "automation": the agent decides WHO matters,
    // the already-real send/assign flow does the WORK.
    const selectAgentRecommended = () => {
        setSelectedIds(agentRecommended.map((l) => l.id));
        setAgentModalOpen(false);
    };

    /* ---------------- bulk: Assign ---------------- */

    const openAssignModal = () => {
        setAssignTarget("");
        setAssignError("");
        setAssignModalOpen(true);
    };

    const confirmBulkAssign = async () => {
        if (!assignTarget) {
            setAssignError("Pick who to assign these leads to.");
            return;
        }
        setAssigning(true);
        setAssignError("");
        try {
            const res = await fetch(ASSIGN_LEADS_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeaders() },
                body: JSON.stringify({ lead_ids: selectedIds, assigned_prospect: assignTarget }),
            });
            const resp = await res.json().catch(() => null);
            if (!res.ok || !resp?.success) {
                throw new Error(resp?.error || "assign failed");
            }
            fetchLeads();
            setAssignModalOpen(false);
            setSelectedIds([]);
        } catch (err) {
            setAssignError("Could not assign these leads. Please try again.");
        } finally {
            setAssigning(false);
        }
    };

    /* ---------------- bulk: Send Email ---------------- */

    const selectedLeadsWithEmail = () => leads.filter((l) => selectedIds.includes(l.id) && l.user_email);

    const openBulkEmailModal = () => {
        setBulkEmailResult(null);
        setBulkEmailModalOpen(true);
    };

    const confirmBulkSendEmail = async () => {
        const targets = selectedLeadsWithEmail();
        setBulkEmailSending(true);
        setBulkEmailResult(null);

        let success = 0;
        const errors = [];

        for (const lead of targets) {
            try {
                const res = await fetch(SEND_EMAIL_ENDPOINT, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        to_email: lead.user_email,
                        to_name: lead.user_name || "there",
                        subject: EMAIL_SUBJECT,
                        message: emailBodyTemplate(lead.user_name || "there"),
                    }),
                });
                const resp = await res.json().catch(() => null);
                if (res.ok && resp?.success) {
                    success++;
                    // Flip this lead from "Due" to "Contacted" — same as the
                    // individual Reachable Channels flow does after a send.
                    try {
                        await fetch(markContactedEndpoint(lead.id), { method: "POST", headers: authHeaders() });
                    } catch (err) {
                        console.error(`mark-contacted failed for lead ${lead.id}:`, err);
                    }
                } else {
                    errors.push(`${lead.user_name || lead.user_email}: send failed`);
                }
            } catch (err) {
                errors.push(`${lead.user_name || lead.user_email}: network error`);
            }
        }

        const skipped = selectedIds.length - targets.length;
        if (skipped > 0) errors.push(`${skipped} lead(s) skipped — no email address on file`);

        setBulkEmailResult({ success, failed: errors.length, errors });
        setBulkEmailSending(false);
        if (success > 0) {
            setSelectedIds([]);
            fetchLeads(); // refresh so the STATUS column shows "Contacted" immediately
        }
    };

    /* ---------------- derived: stats, filtering, pagination ---------------- */

    const stats = useMemo(() => {
        const total = leads.length;
        const hot = leads.filter((l) => getLeadScore(l) >= 80).length;
        const followUpsDue = leads.filter((l) => !l.is_contacted).length;
        const converted = leads.filter((l) => l.current_status === "Success").length;
        const conversionRate = total > 0 ? ((converted / total) * 100).toFixed(1) : "0.0";
        return { total, hot, followUpsDue, conversionRate };
    }, [leads]);

    const filteredLeads = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return leads.filter((lead) => {
            if (q) {
                const haystack = `${lead.user_name || ""} ${lead.user_email || ""}`.toLowerCase();
                if (!haystack.includes(q)) return false;
            }
            if (statusFilter !== "All" && lead.current_status !== statusFilter) return false;
            if (sourceFilter !== "All" && lead.lead_source !== sourceFilter) return false;
            if (assignedFilter !== "All" && lead.assigned_prospect !== assignedFilter) return false;
            return true;
        });
    }, [leads, searchQuery, statusFilter, sourceFilter, assignedFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredLeads.length / pageSize));
    const currentPage = Math.min(page, totalPages);
    const pageLeads = filteredLeads.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const allPageSelected = pageLeads.length > 0 && pageLeads.every((l) => selectedIds.includes(l.id));
    const toggleSelectAllOnPage = () => {
        if (allPageSelected) {
            setSelectedIds((prev) => prev.filter((id) => !pageLeads.some((l) => l.id === id)));
        } else {
            setSelectedIds((prev) => Array.from(new Set([...prev, ...pageLeads.map((l) => l.id)])));
        }
    };
    const toggleSelectOne = (id) => {
        setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };

    return (
        <>
            <section id="sec-campaign-builder" className="h-full flex flex-col overflow-hidden relative z-10 py-4 sm:py-5">
                <div className="w-full h-full flex flex-col min-h-0 px-4 sm:px-6 lg:px-8">
                    {/* Header */}
                    <div className="flex flex-wrap items-start justify-between gap-4 shrink-0">
                        <div>
                            <h2 className="text-2xl sm:text-3xl font-bold text-white">Lead Management</h2>
                            <p className="text-gray-400 text-sm mt-1">Capture, prioritize and convert leads with AI.</p>
                            {products.length > 0 && (
                                <div className="relative inline-block mt-3">
                                    <select
                                        value={selectedProductId}
                                        onChange={(e) => handleSwitchProduct(e.target.value)}
                                        disabled={productsLoading}
                                        className="appearance-none bg-black border border-orange-600/30 text-white text-sm rounded-lg pl-3.5 pr-9 py-2 outline-none focus:border-orange-500/60 cursor-pointer disabled:opacity-60"
                                    >
                                        {products.map((p) => (
                                            <option key={p.id} value={p.id} className="bg-black text-white">
                                                {p.product_name}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown
                                        size={14}
                                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                                    />
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2.5">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".csv,text/csv"
                                onChange={handleImportFile}
                                className="hidden"
                            />
                            <button
                                type="button"
                                onClick={handleImportClick}
                                disabled={importing}
                                className="flex items-center gap-2 border border-white/10 hover:border-white/30 text-gray-300 px-3.5 py-2.5 rounded-lg text-sm font-medium transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {importing ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                                {importing ? "Importing..." : "Import CSV"}
                            </button>
                            <button
                                type="button"
                                onClick={handleExportCSV}
                                className="flex items-center gap-2 border border-white/10 hover:border-white/30 text-gray-300 px-3.5 py-2.5 rounded-lg text-sm font-medium transition duration-200"
                            >
                                <Download size={15} />
                                Export CSV
                            </button>
                            <button
                                type="button"
                                className="flex items-center gap-2 border border-white/10 hover:border-white/30 text-gray-300 px-3.5 py-2.5 rounded-lg text-sm font-medium transition duration-200"
                            >
                                <Radar size={15} />
                                Capture Sources
                            </button>
                            <button
                                type="button"
                                onClick={runLeadAgent}
                                className="flex items-center gap-2 border border-orange-500/40 hover:border-orange-500 text-orange-400 hover:text-orange-300 px-3.5 py-2.5 rounded-lg text-sm font-medium transition duration-200"
                            >
                                <Bot size={15} />
                                AI Lead Agent
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setForm(getInitialFormState());
                                    setEditingLead(null);
                                    setErrors({});
                                    setShowFormModal(true);
                                }}
                                className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 hover:shadow-[0_0_25px_rgba(249,115,22,0.35)] text-white px-4 py-2.5 rounded-lg font-semibold text-sm transition duration-300"
                            >
                                <Plus size={16} />
                                Add Lead
                            </button>
                        </div>
                    </div>

                    {/* Stat cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-5 shrink-0">
                        <div className="bg-black border border-white/10 rounded-2xl p-4">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Leads</p>
                            <p className="text-2xl font-extrabold text-white mt-1">{stats.total}</p>
                        </div>
                        <div className="bg-black border border-white/10 rounded-2xl p-4">
                            <p className="text-xs font-semibold text-orange-400 uppercase tracking-wide flex items-center gap-1">
                                <Flame size={12} /> Hot Leads
                            </p>
                            <p className="text-2xl font-extrabold text-white mt-1">{stats.hot}</p>
                        </div>
                        <div className="bg-black border border-white/10 rounded-2xl p-4">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Follow-ups Due</p>
                            <p className="text-2xl font-extrabold text-white mt-1">{stats.followUpsDue}</p>
                        </div>
                        <div className="bg-black border border-white/10 rounded-2xl p-4">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Conversion Rate</p>
                            <p className="text-2xl font-extrabold text-white mt-1">{stats.conversionRate}%</p>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="flex flex-wrap items-center gap-2.5 mt-4 shrink-0">
                        <div className="flex items-center gap-2 shrink-0">
                            <span className="text-sm text-gray-400 whitespace-nowrap">Show</span>
                            <div className="relative">
                                <select
                                    value={pageSize}
                                    onChange={(e) => {
                                        setPageSize(Number(e.target.value));
                                        setPage(1);
                                    }}
                                    className="bg-black/60 border border-white/10 rounded-lg pl-3 pr-8 py-2 text-sm text-gray-300 outline-none focus:border-orange-500/60 appearance-none cursor-pointer"
                                >
                                    {PAGE_SIZE_OPTIONS.map((size) => (
                                        <option key={size} value={size} className="bg-black text-white">
                                            {size}
                                        </option>
                                    ))}
                                </select>
                                <ChevronDown
                                    size={14}
                                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500"
                                />
                            </div>
                            <span className="text-sm text-gray-400 whitespace-nowrap">entries</span>
                        </div>

                        <div className="relative flex-1 min-w-[200px]">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                    setPage(1);
                                }}
                                placeholder="Search leads..."
                                className="w-full bg-black/60 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-orange-500/60"
                            />
                        </div>

                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value);
                                setPage(1);
                            }}
                            className="bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none focus:border-orange-500/60"
                        >
                            <option value="All">Status: All</option>
                            {statusOptions.map((s) => (
                                <option key={s} value={s}>
                                    {s}
                                </option>
                            ))}
                        </select>

                        <select
                            value={sourceFilter}
                            onChange={(e) => {
                                setSourceFilter(e.target.value);
                                setPage(1);
                            }}
                            className="bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none focus:border-orange-500/60"
                        >
                            <option value="All">Source: All</option>
                            {sourceOptions.map((s) => (
                                <option key={s.value} value={s.value}>
                                    {s.value}
                                </option>
                            ))}
                        </select>

                        <select
                            value={assignedFilter}
                            onChange={(e) => {
                                setAssignedFilter(e.target.value);
                                setPage(1);
                            }}
                            className="bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-300 outline-none focus:border-orange-500/60"
                        >
                            <option value="All">Assigned To: All</option>
                            {assignedOptions.map((a) => (
                                <option key={a} value={a}>
                                    {a}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Leads table — no "Last Activity" / "Actions" columns.
                        Keeps its own internal scroll, which is expected UX
                        for a data table with many rows. */}
                    <div className="mt-4 flex-1 min-h-0 overflow-auto rounded-2xl border border-white/10">
                        <table className="min-w-full text-sm">
                            <thead className="sticky top-0 z-10">
                                <tr className="bg-orange-500/10 border-b border-orange-600/30">
                                    <th className="px-4 py-3 bg-[#0a0a0a] w-10">
                                        <input
                                            type="checkbox"
                                            checked={allPageSelected}
                                            onChange={toggleSelectAllOnPage}
                                            className="accent-orange-500"
                                        />
                                    </th>
                                    <th className="text-left px-4 py-3 font-semibold text-orange-400 uppercase text-xs tracking-wider whitespace-nowrap bg-[#0a0a0a]">
                                        Lead
                                    </th>
                                    <th className="text-left px-4 py-3 font-semibold text-orange-400 uppercase text-xs tracking-wider whitespace-nowrap bg-[#0a0a0a]">
                                        Source
                                    </th>
                                    <th className="text-left px-4 py-3 font-semibold text-orange-400 uppercase text-xs tracking-wider whitespace-nowrap bg-[#0a0a0a]">
                                        Status
                                    </th>
                                    <th className="text-left px-4 py-3 font-semibold text-orange-400 uppercase text-xs tracking-wider whitespace-nowrap bg-[#0a0a0a]">
                                        AI Score
                                    </th>
                                    <th className="text-left px-4 py-3 font-semibold text-orange-400 uppercase text-xs tracking-wider whitespace-nowrap bg-[#0a0a0a]">
                                        Website
                                    </th>
                                    <th className="text-left px-4 py-3 font-semibold text-orange-400 uppercase text-xs tracking-wider whitespace-nowrap bg-[#0a0a0a]">
                                        Decision Maker
                                    </th>
                                    <th className="text-left px-4 py-3 font-semibold text-orange-400 uppercase text-xs tracking-wider whitespace-nowrap bg-[#0a0a0a]">
                                        Designation
                                    </th>
                                    <th className="text-left px-4 py-3 font-semibold text-orange-400 uppercase text-xs tracking-wider whitespace-nowrap bg-[#0a0a0a]">
                                        Phone
                                    </th>
                                    <th className="text-left px-4 py-3 font-semibold text-orange-400 uppercase text-xs tracking-wider whitespace-nowrap bg-[#0a0a0a]">
                                        LinkedIn
                                    </th>
                                    <th className="text-left px-4 py-3 font-semibold text-orange-400 uppercase text-xs tracking-wider whitespace-nowrap bg-[#0a0a0a]">
                                        Location
                                    </th>
                                    <th className="text-left px-4 py-3 font-semibold text-orange-400 uppercase text-xs tracking-wider whitespace-nowrap bg-[#0a0a0a]">
                                        Industry
                                    </th>
                                    <th className="text-left px-4 py-3 font-semibold text-orange-400 uppercase text-xs tracking-wider whitespace-nowrap bg-[#0a0a0a]">
                                        Company Size
                                    </th>
                                    <th className="text-left px-4 py-3 font-semibold text-orange-400 uppercase text-xs tracking-wider whitespace-nowrap bg-[#0a0a0a]">
                                        Estimated Scale
                                    </th>
                                    <th className="text-left px-4 py-3 font-semibold text-orange-400 uppercase text-xs tracking-wider whitespace-nowrap bg-[#0a0a0a]">
                                        Technology Used
                                    </th>
                                    <th className="text-left px-4 py-3 font-semibold text-orange-400 uppercase text-xs tracking-wider whitespace-nowrap bg-[#0a0a0a]">
                                        Pain Points
                                    </th>
                                    <th className="text-left px-4 py-3 font-semibold text-orange-400 uppercase text-xs tracking-wider whitespace-nowrap bg-[#0a0a0a]">
                                        Reason
                                    </th>
                                    <th className="text-left px-4 py-3 font-semibold text-orange-400 uppercase text-xs tracking-wider whitespace-nowrap bg-[#0a0a0a]">
                                        Next Action
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {leadsLoading && (
                                    <tr>
                                        <td colSpan={18} className="px-4 py-10 text-center text-gray-400">
                                            <div className="flex items-center justify-center gap-2">
                                                <Loader2 size={16} className="animate-spin" />
                                                Loading leads...
                                            </div>
                                        </td>
                                    </tr>
                                )}

                                {!leadsLoading && leadsError && (
                                    <tr>
                                        <td colSpan={18} className="px-4 py-10 text-center text-red-400">
                                            {leadsError}
                                        </td>
                                    </tr>
                                )}

                                {!leadsLoading && !leadsError && pageLeads.length === 0 && (
                                    <tr>
                                        <td colSpan={18} className="px-4 py-10 text-center text-gray-400">
                                            No leads match these filters.
                                        </td>
                                    </tr>
                                )}

                                {!leadsLoading &&
                                    !leadsError &&
                                    pageLeads.map((lead) => {
                                        const score = getLeadScore(lead);
                                        const { icon: ScoreIcon, className: scoreClass } = scoreVisual(score);
                                        const SourceIcon = sourceIconMap[lead.lead_source] || Globe;

                                        return (
                                            <tr
                                                key={lead.id}
                                                className="border-b border-white/5 hover:bg-orange-500/5 transition duration-150"
                                            >
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedIds.includes(lead.id)}
                                                        onChange={() => toggleSelectOne(lead.id)}
                                                        className="accent-orange-500"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-8 w-8 rounded-full bg-orange-500/15 border border-orange-600/30 text-orange-400 text-xs font-bold flex items-center justify-center shrink-0">
                                                            {initials(lead.user_name)}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <p className="text-white font-medium truncate">{lead.user_name || "—"}</p>
                                                            <p className="text-gray-500 text-xs truncate">{lead.user_email || "—"}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className="flex items-center gap-2 text-gray-300">
                                                        <SourceIcon size={14} className="text-gray-500" />
                                                        {lead.lead_source || "—"}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span
                                                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold border ${contactBadgeClasses(
                                                            lead.is_contacted
                                                        )}`}
                                                    >
                                                        {lead.is_contacted ? "Contacted" : "Due"}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className={`flex items-center gap-1 font-semibold ${scoreClass}`}>
                                                        <ScoreIcon size={13} />
                                                        {score}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap max-w-[160px] truncate">
                                                    {lead.web_url ? (
                                                        <VerifiedWebsiteLink url={lead.web_url} />
                                                    ) : (
                                                        <span className="text-gray-500">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-gray-300">{lead.decision_maker || "—"}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-gray-300">{lead.designation || "—"}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-gray-300">{lead.user_mobile_number || "—"}</td>
                                                <td className="px-4 py-3 whitespace-nowrap max-w-[160px] truncate">
                                                    {lead.linkedin_url ? (
                                                        <VerifiedWebsiteLink url={lead.linkedin_url} />
                                                    ) : (
                                                        <span className="text-gray-500">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-gray-300 max-w-[140px] truncate">{lead.user_address || "—"}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-gray-300">{lead.industry || "—"}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-gray-300">{lead.company_size || "—"}</td>
                                                <td className="px-4 py-3 whitespace-nowrap text-gray-300">{lead.estimated_scale || "—"}</td>
                                                <td className="px-4 py-3 text-gray-300 max-w-[180px] truncate" title={lead.technology_used || ""}>
                                                    {lead.technology_used || "—"}
                                                </td>
                                                <td className="px-4 py-3 text-gray-300 max-w-[180px] truncate" title={lead.pain_points || ""}>
                                                    {lead.pain_points || "—"}
                                                </td>
                                                <td className="px-4 py-3 text-gray-300 max-w-[220px] truncate" title={lead.reason || ""}>
                                                    {lead.reason || "—"}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setChannelsLead(lead)}
                                                            className="flex items-center gap-1.5 border border-orange-500/40 text-orange-400 hover:bg-orange-500 hover:text-white hover:border-orange-500 px-3 py-1.5 rounded-lg text-xs font-semibold transition duration-200"
                                                        >
                                                            {nextActionLabel(lead.current_status)}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => openEditLead(lead)}
                                                            title="Edit lead"
                                                            className="flex items-center justify-center h-8 w-8 border border-white/10 text-gray-400 hover:text-white hover:border-white/30 rounded-lg transition duration-200 shrink-0"
                                                        >
                                                            <Pencil size={13} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination + bulk action bar */}
                    <div className="shrink-0 mt-3 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-gray-500">
                            {filteredLeads.length === 0
                                ? "0 leads"
                                : `Showing ${(currentPage - 1) * pageSize + 1} to ${Math.min(
                                      currentPage * pageSize,
                                      filteredLeads.length
                                  )} of ${filteredLeads.length} leads`}
                        </p>

                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                disabled={currentPage <= 1}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:border-white/30 transition"
                            >
                                Previous
                            </button>
                            <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-orange-500 text-white">
                                {currentPage}
                            </span>
                            <span className="text-xs text-gray-500">of {totalPages}</span>
                            <button
                                type="button"
                                disabled={currentPage >= totalPages}
                                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:border-white/30 transition"
                            >
                                Next
                            </button>
                        </div>
                    </div>

                    {selectedIds.length > 0 && (
                        <div className="shrink-0 mt-3 flex flex-wrap items-center justify-between gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                            <p className="text-sm text-gray-300 font-medium">{selectedIds.length} leads selected</p>
                            <div className="flex flex-wrap items-center gap-2">
                                <button
                                    type="button"
                                    onClick={openAssignModal}
                                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-gray-300 hover:border-orange-500/50 hover:text-white transition"
                                >
                                    Assign
                                </button>
                                <button className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-gray-400 cursor-not-allowed" disabled title="Not wired up yet">
                                    Send WhatsApp
                                </button>
                                <button
                                    type="button"
                                    onClick={openBulkEmailModal}
                                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-gray-300 hover:border-orange-500/50 hover:text-white transition"
                                >
                                    Send Email
                                </button>
                                <button className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-gray-400 cursor-not-allowed" disabled title="Not wired up yet">
                                    Change Status
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedIds([])}
                                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-500/40 text-red-400 hover:bg-red-500 hover:text-white transition"
                                >
                                    Clear Selection
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </section>

            {/* Add Lead modal — rendered via portal to escape any
                transformed ancestor that would otherwise break position:fixed */}
            {showFormModal && createPortal(
                (
                    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black px-4 py-8 overflow-y-auto">
                        <div className="bg-black border border-orange-600/30 rounded-[32px] p-6 sm:p-8 lg:p-10 max-w-3xl w-full my-auto relative shadow-[0_0_60px_rgba(0,0,0,0.9)]">
                            <button
                                type="button"
                                onClick={closeFormModal}
                                aria-label="Close"
                                className="absolute top-6 right-6 sm:top-8 sm:right-8 text-gray-400 hover:text-white transition duration-200"
                            >
                                <X size={22} />
                            </button>

                            <h3 className="font-bold text-2xl text-white">{editingLead ? "Edit Lead" : "Add Lead"}</h3>
                            <p className="text-gray-400 text-sm mt-2">
                                {editingLead ? `Update ${editingLead.user_name || "this lead"}'s information.` : "Capture a new lead and where it came from."}
                            </p>

                            <form onSubmit={handleSubmit} className="mt-8">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <Field label="Product" error={errors.product_id} colSpan="md:col-span-2" required>
                                        <div className="relative">
                                            <select
                                                id="product_id"
                                                value={form.product_id}
                                                onChange={handleChange("product_id")}
                                                disabled={productsLoading}
                                                className={`${inputClasses(!!errors.product_id)} appearance-none pr-10 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed`}
                                            >
                                                <option value="" disabled>
                                                    {productsLoading
                                                        ? "Loading your products..."
                                                        : products.length
                                                        ? "Which product is this lead for?"
                                                        : "No products yet — add one from Home first"}
                                                </option>
                                                {products.map((p) => (
                                                    <option key={p.id} value={p.id} className="bg-black text-white">
                                                        {p.product_name}
                                                    </option>
                                                ))}
                                            </select>
                                            <ChevronDown
                                                size={16}
                                                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                                            />
                                        </div>
                                    </Field>

                                    <Field label="Source" error={errors.lead_source} colSpan="md:col-span-2" required>
                                        <SelectField
                                            id="lead_source"
                                            value={form.lead_source}
                                            onChange={handleChange("lead_source")}
                                            options={sourceOptions.map((s) => s.value)}
                                            hasError={!!errors.lead_source}
                                            placeholder="Where did this lead come from?"
                                        />
                                    </Field>

                                    <Field label="Country" error={errors.country} required>
                                        <ComboboxField
                                            id="country"
                                            value={form.country}
                                            onChange={handleChange("country")}
                                            options={countryOptions}
                                            hasError={!!errors.country}
                                            placeholder="Select or type your country"
                                        />
                                    </Field>

                                    <Field label="User Name" error={errors.user_name} colSpan="md:col-span-2" required>
                                        <input
                                            id="user_name"
                                            type="text"
                                            placeholder="Enter the name"
                                            value={form.user_name}
                                            onChange={handleChange("user_name")}
                                            className={inputClasses(!!errors.user_name)}
                                        />
                                    </Field>

                                    <Field label="User Address">
                                        <textarea
                                            id="user_address"
                                            rows={3}
                                            placeholder="Enter address"
                                            value={form.user_address}
                                            onChange={handleChange("user_address")}
                                            className={inputClasses(false)}
                                        />
                                    </Field>

                                    <Field label="User GMB Status">
                                        <SelectField
                                            id="gmb_status"
                                            value={form.gmb_status}
                                            onChange={handleChange("gmb_status")}
                                            options={gmbStatusOptions}
                                            hasError={false}
                                        />
                                    </Field>

                                    <Field label="User Website" error={errors.web_url}>
                                        <input
                                            id="web_url"
                                            type="text"
                                            placeholder="Enter website"
                                            value={form.web_url}
                                            onChange={handleChange("web_url")}
                                            className={inputClasses(!!errors.web_url)}
                                        />
                                    </Field>

                                    <Field label="User Mobile Number" error={errors.user_num} required>
                                        <input
                                            id="user_num"
                                            type="text"
                                            placeholder="Enter mobile number"
                                            value={form.user_num}
                                            onChange={handleChange("user_num")}
                                            className={inputClasses(!!errors.user_num)}
                                        />
                                    </Field>

                                    <Field label="User Email Id" error={errors.user_email} required>
                                        <input
                                            id="user_email"
                                            type="text"
                                            placeholder="Enter email id"
                                            value={form.user_email}
                                            onChange={handleChange("user_email")}
                                            className={inputClasses(!!errors.user_email)}
                                        />
                                    </Field>

                                    <Field label="Prospects Assigned To">
                                        <SelectField
                                            id="assigned_prospect"
                                            value={form.assigned_prospect}
                                            onChange={handleChange("assigned_prospect")}
                                            options={assignedOptions}
                                            hasError={false}
                                        />
                                    </Field>

                                    {editingLead && (
                                        <Field label="Status">
                                            <SelectField
                                                id="current_status"
                                                value={form.current_status}
                                                onChange={handleChange("current_status")}
                                                options={statusOptions}
                                                hasError={false}
                                            />
                                        </Field>
                                    )}

                                    <Field label="Comment" colSpan="md:col-span-2">
                                        <textarea
                                            id="comment"
                                            rows={3}
                                            placeholder="Prospect comment"
                                            value={form.comment}
                                            onChange={handleChange("comment")}
                                            className={inputClasses(false)}
                                        />
                                    </Field>
                                </div>

                                {errors.submit && (
                                    <p className="text-center text-red-400 text-sm font-medium mt-8">{errors.submit}</p>
                                )}

                                <div className="flex items-center justify-center gap-4 mt-10">
                                    <button
                                        type="button"
                                        onClick={closeFormModal}
                                        className="px-8 py-4 rounded-lg font-semibold text-gray-300 border border-white/10 hover:border-white/30 transition duration-300"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={submitting}
                                        className="bg-orange-500 hover:bg-orange-600 hover:shadow-[0_0_30px_rgba(249,115,22,0.35)] disabled:opacity-60 disabled:cursor-not-allowed text-white px-10 py-4 rounded-lg font-bold transition duration-300"
                                    >
                                        {submitting ? (editingLead ? "Saving..." : "Submitting...") : editingLead ? "Save Changes" : "Submit"}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                ),
                document.body
            )}

            {/* Success popup — also rendered via portal for the same reason */}
            {submitted && createPortal(
                (
                    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black px-4">
                        <div className="bg-black border border-orange-500/40 rounded-2xl p-8 max-w-sm w-full text-center shadow-[0_0_60px_rgba(0,0,0,0.9)]">
                            <div className="w-14 h-14 mx-auto rounded-full bg-green-500/10 border border-green-500/40 flex items-center justify-center">
                                <Check className="text-green-400" size={26} />
                            </div>
                            <h4 className="text-white font-bold text-xl mt-5">Successfully Submitted</h4>
                            <button
                                type="button"
                                onClick={() => setSubmitted(false)}
                                className="mt-7 bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-lg font-semibold transition duration-300"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                ),
                document.body
            )}

            {/* Reachable Channels modal — this is what "Contact Now" (and
                every other NEXT ACTION button) actually opens */}
            {channelsLead && createPortal(
                (
                    <div className="fixed inset-0 z-[1997] flex items-center justify-center bg-black/80 px-4 py-6">
                        <div className="bg-black border border-orange-600/30 rounded-[28px] p-5 sm:p-6 max-w-xl w-full h-[85vh] max-h-[760px] flex flex-col relative shadow-[0_0_60px_rgba(0,0,0,0.9)]">
                            <div className="flex items-center justify-between mb-4 shrink-0">
                                <div>
                                    <p className="text-[11px] text-gray-500 uppercase tracking-wide">Contact Lead</p>
                                    <h3 className="text-white font-bold text-lg">{channelsLead.user_name || "Unnamed Lead"}</h3>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setChannelsLead(null)}
                                    aria-label="Close"
                                    className="text-gray-400 hover:text-white transition duration-200"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex-1 min-h-0">
                                <ReachableChannelsCard lead={channelsLead} />
                            </div>
                        </div>
                    </div>
                ),
                document.body
            )}

            {/* AI Lead Agent modal */}
            {agentModalOpen && createPortal(
                (
                    <div className="fixed inset-0 z-[1997] flex items-center justify-center bg-black/80 px-4">
                        <div className="bg-black border border-orange-600/30 rounded-2xl p-7 max-w-2xl w-full h-[85vh] flex flex-col shadow-[0_0_60px_rgba(0,0,0,0.9)]">
                            <div className="flex items-center justify-between mb-4 shrink-0">
                                <h4 className="text-white font-bold text-lg flex items-center gap-2">
                                    <span className="h-8 w-8 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center">
                                        <Bot size={16} />
                                    </span>
                                    AI Lead Agent
                                </h4>
                                <button onClick={() => setAgentModalOpen(false)} className="text-gray-400 hover:text-white transition">
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="overflow-y-auto flex-1 min-h-0 space-y-3">
                                {agentLoading ? (
                                    <div className="flex items-center gap-2 text-gray-400 text-sm p-3">
                                        <Loader2 size={14} className="animate-spin" /> Analyzing your leads...
                                    </div>
                                ) : agentError ? (
                                    <p className="text-red-400 text-sm">{agentError}</p>
                                ) : (
                                    <div className="bg-white/5 border border-orange-600/20 rounded-xl p-3.5 text-sm text-gray-200 whitespace-pre-wrap leading-relaxed">
                                        {agentResult}
                                    </div>
                                )}

                                {!agentLoading && agentRecommended.length > 0 && (
                                    <div>
                                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                                            Priority leads (hot + not yet contacted) — {agentRecommended.length}
                                        </p>
                                        <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                                            {agentRecommended.map((l) => (
                                                <div key={l.id} className="flex items-center justify-between bg-white/[0.03] border border-white/5 rounded-lg px-3 py-2 text-xs">
                                                    <span className="text-white font-medium truncate">{l.user_name || "Unnamed"}</span>
                                                    <span className="text-orange-400 font-semibold shrink-0 ml-2">{getLeadScore(l)}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-3 mt-4 shrink-0">
                                <button
                                    onClick={runLeadAgent}
                                    disabled={agentLoading}
                                    className="flex-1 flex items-center justify-center gap-1.5 border border-white/10 hover:border-orange-500/40 text-gray-300 hover:text-white rounded-lg py-2.5 text-xs font-semibold transition disabled:opacity-50"
                                >
                                    <RefreshCw size={13} className={agentLoading ? "animate-spin" : ""} /> Regenerate
                                </button>
                                <button
                                    onClick={selectAgentRecommended}
                                    disabled={agentLoading || agentRecommended.length === 0}
                                    className="flex-1 flex items-center justify-center gap-1.5 bg-orange-500 hover:bg-orange-600 text-black text-xs font-bold py-2.5 rounded-lg transition disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <Sparkles size={13} /> Select These {agentRecommended.length} Leads
                                </button>
                            </div>
                            <p className="text-[10px] text-gray-500 mt-2 text-center shrink-0">
                                Selecting opens the bulk action bar below — use Assign or Send Email from there.
                            </p>
                        </div>
                    </div>
                ),
                document.body
            )}

            {/* CSV import result summary */}
            {importResult && createPortal(
                (
                    <div className="fixed inset-0 z-[1997] flex items-center justify-center bg-black/80 px-4">
                        <div className="bg-black border border-orange-600/30 rounded-2xl p-6 max-w-md w-full shadow-[0_0_60px_rgba(0,0,0,0.9)]">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-white font-bold text-lg">CSV Import Result</h4>
                                <button
                                    type="button"
                                    onClick={() => setImportResult(null)}
                                    className="text-gray-400 hover:text-white transition duration-200"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-xl px-3 py-2">
                                    <Check size={16} className="text-green-400" />
                                    <span className="text-sm text-white font-semibold">{importResult.success} added</span>
                                </div>
                                {importResult.failed > 0 && (
                                    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
                                        <AlertTriangle size={16} className="text-red-400" />
                                        <span className="text-sm text-white font-semibold">{importResult.failed} failed</span>
                                    </div>
                                )}
                            </div>

                            {importResult.errors.length > 0 && (
                                <div className="mt-4 max-h-48 overflow-y-auto space-y-1.5">
                                    {importResult.errors.map((err, i) => (
                                        <p key={i} className="text-xs text-red-300 bg-red-500/5 border border-red-500/20 rounded-lg px-2.5 py-1.5">
                                            {err}
                                        </p>
                                    ))}
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={() => setImportResult(null)}
                                className="mt-5 w-full bg-orange-500 hover:bg-orange-600 text-black font-semibold py-2.5 rounded-xl text-sm transition"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                ),
                document.body
            )}

            {/* Bulk "Assign" modal */}
            {assignModalOpen && createPortal(
                (
                    <div className="fixed inset-0 z-[1997] flex items-center justify-center bg-black/80 px-4">
                        <div className="bg-black border border-orange-600/30 rounded-2xl p-6 max-w-sm w-full shadow-[0_0_60px_rgba(0,0,0,0.9)]">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-white font-bold text-lg">Assign Leads</h4>
                                <button
                                    type="button"
                                    onClick={() => setAssignModalOpen(false)}
                                    disabled={assigning}
                                    className="text-gray-400 hover:text-white transition duration-200"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            <p className="text-sm text-gray-400 mb-4">
                                Assign {selectedIds.length} selected lead{selectedIds.length !== 1 ? "s" : ""} to:
                            </p>

                            <div className="relative">
                                <select
                                    value={assignTarget}
                                    onChange={(e) => setAssignTarget(e.target.value)}
                                    className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-orange-500/70 appearance-none pr-10 cursor-pointer"
                                >
                                    <option value="" disabled>Select</option>
                                    {assignedOptions.map((a) => (
                                        <option key={a} value={a} className="bg-black text-white">{a}</option>
                                    ))}
                                </select>
                                <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
                            </div>

                            {assignError && <p className="mt-2 text-xs text-red-400">{assignError}</p>}

                            <div className="flex items-center gap-3 mt-5">
                                <button
                                    type="button"
                                    onClick={() => setAssignModalOpen(false)}
                                    disabled={assigning}
                                    className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-gray-300 border border-white/10 hover:border-white/30 transition disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={confirmBulkAssign}
                                    disabled={assigning}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold bg-orange-500 hover:bg-orange-600 text-black transition disabled:opacity-60"
                                >
                                    {assigning ? (
                                        <>
                                            <Loader2 size={13} className="animate-spin" /> Assigning...
                                        </>
                                    ) : (
                                        "Assign"
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                ),
                document.body
            )}

            {/* Bulk "Send Email" modal */}
            {bulkEmailModalOpen && createPortal(
                (
                    <div className="fixed inset-0 z-[1997] flex items-center justify-center bg-black/80 px-4">
                        <div className="bg-black border border-orange-600/30 rounded-2xl p-8 max-w-2xl w-full shadow-[0_0_60px_rgba(0,0,0,0.9)]">
                        <div className="flex items-center justify-between mb-6">
                            <h4 className="text-white font-bold text-lg">Send Email</h4>
                            <button
                                type="button"
                                onClick={() => setBulkEmailModalOpen(false)}
                                disabled={bulkEmailSending}
                                className="text-gray-400 hover:text-white transition duration-200"
                            >
                                <X size={22} />
                            </button>
                        </div>

                        {!bulkEmailResult ? (
                            <>
                                <p className="text-sm text-gray-400">
                                    This will send the standard GrowthOS intro email to{" "}
                                    <span className="text-white font-semibold">{selectedLeadsWithEmail().length}</span>{" "}
                                    of your {selectedIds.length} selected lead{selectedIds.length !== 1 ? "s" : ""}
                                    {selectedLeadsWithEmail().length !== selectedIds.length && " (the rest have no email on file)"}.
                                </p>

                                <div className="mt-4 max-h-64 overflow-y-auto space-y-2">
                                    {selectedLeadsWithEmail().map((l) => (
                                        <p key={l.id} className="text-sm text-gray-300 bg-white/5 rounded-lg px-4 py-3 truncate">
                                            {l.user_name || "Unnamed"} — {l.user_email}
                                        </p>
                                    ))}
                                </div>

                                <div className="flex items-center gap-4 mt-6">
                                    <button
                                        type="button"
                                        onClick={() => setBulkEmailModalOpen(false)}
                                        disabled={bulkEmailSending}
                                        className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-300 border border-white/10 hover:border-white/30 transition disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="button"
                                        onClick={confirmBulkSendEmail}
                                        disabled={bulkEmailSending || selectedLeadsWithEmail().length === 0}
                                        className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-orange-500 hover:bg-orange-600 text-black transition disabled:opacity-60"
                                    >
                                        {bulkEmailSending ? (
                                            <>
                                                <Loader2 size={16} className="animate-spin" /> Sending...
                                            </>
                                        ) : (
                                            `Send to ${selectedLeadsWithEmail().length}`
                                        )}
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3">
                                        <Check size={16} className="text-green-400" />
                                        <span className="text-sm text-white font-semibold">{bulkEmailResult.success} sent</span>
                                    </div>
                                    {bulkEmailResult.failed > 0 && (
                                        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                                            <AlertTriangle size={16} className="text-red-400" />
                                            <span className="text-sm text-white font-semibold">{bulkEmailResult.failed} failed</span>
                                        </div>
                                    )}
                                </div>

                                {bulkEmailResult.errors.length > 0 && (
                                    <div className="mt-4 max-h-64 overflow-y-auto space-y-2">
                                        {bulkEmailResult.errors.map((err, i) => (
                                            <p key={i} className="text-sm text-red-300 bg-red-500/5 border border-red-500/20 rounded-lg px-4 py-3">
                                                {err}
                                            </p>
                                        ))}
                                    </div>
                                )}

                                <button
                                    type="button"
                                    onClick={() => setBulkEmailModalOpen(false)}
                                    className="mt-6 w-full bg-orange-500 hover:bg-orange-600 text-black font-semibold py-3 rounded-xl text-sm transition"
                                >
                                    Close
                                </button>
                            </>
                        )}
                    </div>
                    </div>
                ),
                document.body
            )}
        </>
    );
};

export default CampaignBuilderSection;