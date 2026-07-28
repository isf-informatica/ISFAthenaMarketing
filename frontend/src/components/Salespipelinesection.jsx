import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
    BarChart3,
    IndianRupee,
    Briefcase,
    CalendarDays,
    Target,
    Clock,
    Search,
    ChevronDown,
    Filter,
    LayoutGrid,
    List as ListIcon,
    Download,
    Settings,
    Plus,
    Flame,
    Star,
    Radar,
    TrendingUp,
    TrendingDown,
    X,
    Loader2,
    User,
    Check,
    Undo2,
    Sparkles,
} from "lucide-react";

/* ==========================================================
   SALES PIPELINE (id="sec-sales-pipeline")

   DESIGN NOTE — simplified on purpose. Earlier pass leaned on
   glassmorphism, multiple glows, noise texture, sparklines and
   a pulsing dot per column; it read as busy rather than
   premium. This version keeps ONE signature element (the
   colored left border + label per stage — it's the thing that
   actually carries information, since it tells you the stage
   at a glance) and keeps everything else calm: flat cards,
   one consistent hover treatment, no decorative overlays.

   Dummy seed data — same pattern as the Overview dashboard
   mock — but "Create Deal" is fully functional: it adds a real
   card to the board and stage/pipeline totals recompute from
   actual deal values. No backend yet (no `deals` table
   exists), so state lives in this component; wiring to
   growthos_backend later just means swapping setStages for a
   POST + refetch.
========================================================== */

const CARD = "bg-[#0d0d10] border border-white/10 rounded-2xl";

const chipColors = {
    orange: "bg-orange-500/15 border-orange-500/30 text-orange-400",
    blue: "bg-blue-500/15 border-blue-500/30 text-blue-400",
    green: "bg-green-500/15 border-green-500/30 text-green-400",
    purple: "bg-purple-500/15 border-purple-500/30 text-purple-400",
    rose: "bg-rose-500/15 border-rose-500/30 text-rose-400",
};

const Chip = ({ color, icon: Icon, size = 15 }) => (
    <div className={`h-9 w-9 rounded-lg border flex items-center justify-center shrink-0 ${chipColors[color]}`}>
        <Icon size={size} />
    </div>
);

const STAGE_NAMES = ["New Leads", "Qualified", "Proposal", "Negotiation", "Closed Won"];
const ASSIGNED_OPTIONS = ["Tapan", "Andrew", "Surej"];

// One signature per stage: a border color + text color. That's it —
// no background tint, no glow, no animation. Simple and legible.
const stageAccents = {
    "New Leads": { text: "text-blue-400", chip: "bg-blue-500/15 border-blue-500/30 text-blue-400" },
    Qualified: { text: "text-purple-400", chip: "bg-purple-500/15 border-purple-500/30 text-purple-400" },
    Proposal: { text: "text-fuchsia-400", chip: "bg-fuchsia-500/15 border-fuchsia-500/30 text-fuchsia-400" },
    Negotiation: { text: "text-orange-400", chip: "bg-orange-500/15 border-orange-500/30 text-orange-400" },
    "Closed Won": { text: "text-green-400", chip: "bg-green-500/15 border-green-500/30 text-green-400" },
};

const API_BASE_URL = "http://localhost:8000";
const DEALS_ENDPOINT = `${API_BASE_URL}/deals`;

const formatTimeAgo = (dbTimestamp) => {
    if (!dbTimestamp) return "";
    const then = new Date(dbTimestamp.replace(" ", "T"));
    const diffMs = Date.now() - then.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days} day${days > 1 ? "s" : ""} ago`;
    return then.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

// Maps a raw isfathena.deals row to the shape the board/cards use.
// No `score` field anymore — the backend doesn't store one.
const transformDeal = (row) => ({
    id: row.id,
    company: row.contact_name,
    sub: row.account_name || "—",
    valueNum: Number(row.deal_value) || 0,
    stage: row.stage,
    assignedTo: row.assigned_to || "",
    closingDate: row.closing_date || "",
    won: !!row.is_won,
    time: formatTimeAgo(row.created_at),
    createdAt: row.created_at || null,
});

const groupIntoStages = (flatDeals) =>
    STAGE_NAMES.map((name) => ({
        name,
        won: name === "Closed Won",
        deals: flatDeals.filter((d) => d.stage === name),
    }));

const formatCurrency = (num) => {
    const n = Number(num) || 0;
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    return `₹${n.toLocaleString("en-IN")}`;
};

const csvEscape = (value) => {
    const str = String(value ?? "");
    if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
    return str;
};

const downloadDealsCSV = (stages) => {
    const header = ["Deal", "Account", "Stage", "Value", "Score", "Updated"].join(",");
    const rows = stages.flatMap((stage) =>
        stage.deals.map((deal) =>
            [deal.company, deal.sub, stage.name, deal.valueNum, deal.won ? "Won" : (deal.score ?? ""), deal.time]
                .map(csvEscape)
                .join(",")
        )
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sales-pipeline-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// Today is fixed to match the app's "current date" context.
// Real current date — deals now come from a live database with real
// timestamps, so "this month" / "overdue" need to compare against actual
// wall-clock time, not a fixed narrative date.
const TODAY = new Date();

const isSameMonth = (dateStr, monthOffset = 0) => {
    const d = new Date(dateStr);
    const ref = new Date(TODAY.getFullYear(), TODAY.getMonth() + monthOffset, 1);
    return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
};

const isOverdue = (dateStr, won) => !won && new Date(dateStr) < TODAY;

const matchesValueFilter = (valueNum, filter) => {
    if (filter === "under50k") return valueNum < 50000;
    if (filter === "50k-200k") return valueNum >= 50000 && valueNum <= 200000;
    if (filter === "above200k") return valueNum > 200000;
    return true;
};

const matchesClosingFilter = (deal, filter) => {
    if (filter === "thisMonth") return isSameMonth(deal.closingDate, 0);
    if (filter === "nextMonth") return isSameMonth(deal.closingDate, 1);
    if (filter === "overdue") return isOverdue(deal.closingDate, deal.won);
    return true;
};

const initialFilters = { search: "", stage: "All", assignedTo: "All", value: "All", closing: "All" };
const initialForm = { company: "", sub: "", value: "", stage: "New Leads", assignedTo: "Tapan", closingDate: "" };

const scoreVisual = (score) => {
    if (score >= 85) return { icon: Flame, className: "text-orange-400", chip: "bg-orange-500/15 border-orange-500/30 text-orange-400" };
    if (score >= 70) return { icon: Star, className: "text-amber-400", chip: "bg-amber-500/15 border-amber-500/30 text-amber-400" };
    return { icon: Radar, className: "text-gray-400", chip: "bg-white/5 border-white/10 text-gray-400" };
};

/* ----------------------------------------------------------
   AI SUGGESTIONS — heuristic, not a live model call.

   We don't have activity tracking yet (page visits, email opens,
   WhatsApp replies aren't columns on `deals`), so this reads the
   signals that DO exist: stage, days since created, and closing-date
   proximity/overdue status. It's deterministic on purpose — same
   deal state always gives the same recommendation, so it won't
   flicker on every re-render.

   Swap the body of getAiSuggestion() for a real API call (e.g. a
   POST to an /ai/suggest endpoint that returns { action, confidence })
   once engagement data exists — the card and queue UI below don't
   need to change, they just consume { action, confidence }.
---------------------------------------------------------- */
const getAiSuggestion = (deal) => {
    if (deal.won) return null;

    const now = TODAY;
    const created = deal.createdAt ? new Date(deal.createdAt.replace(" ", "T")) : null;
    const daysSinceCreated = created ? Math.floor((now - created) / 86400000) : null;
    const overdue = deal.closingDate ? isOverdue(deal.closingDate, deal.won) : false;
    const daysToClose = deal.closingDate
        ? Math.ceil((new Date(deal.closingDate) - now) / 86400000)
        : null;

    let action = "";
    let confidence = 70;
    let reason = "";

    if (overdue) {
        action = "Follow-up — Overdue";
        confidence = 92;
        reason = "Closing date has passed with no movement";
    } else if (daysSinceCreated !== null && daysSinceCreated >= 10 && ["New Leads", "Qualified"].includes(deal.stage)) {
        action = "Mark as Cold Lead";
        confidence = 80;
        reason = `No stage movement in ${daysSinceCreated} days`;
    } else if (daysToClose !== null && daysToClose >= 0 && daysToClose <= 3) {
        action = "Call Today";
        confidence = 94;
        reason = daysToClose === 0 ? "Closing today" : `Closing in ${daysToClose} day${daysToClose > 1 ? "s" : ""}`;
    } else if (deal.stage === "Proposal") {
        action = "Follow-up on Proposal";
        confidence = 85;
        reason = "Deal sitting in Proposal stage";
    } else if (deal.stage === "Negotiation") {
        action = "Schedule Call to Close";
        confidence = 88;
        reason = "Close to won — needs a final push";
    } else if (deal.stage === "Qualified") {
        action = "Schedule Demo";
        confidence = 75;
        reason = "Qualified and ready for next step";
    } else {
        action = "Send WhatsApp";
        confidence = 68;
        reason = "New lead, needs first contact";
    }

    // Higher-value deals get a small confidence/priority nudge so the
    // queue below doesn't rank a ₹5K lead above a ₹5L one on urgency alone.
    if (deal.valueNum > 200000) confidence = Math.min(98, confidence + 4);

    const priorityScore = confidence + (overdue ? 20 : 0) + Math.min(15, deal.valueNum / 100000);

    return { action, confidence, reason, priorityScore };
};

const formatShortDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

const initials = (name) =>
    (name || "?")
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase())
        .join("") || "?";

const SalesPipelineSection = () => {
    const [view, setView] = useState("kanban"); // "kanban" | "list"
    const [rawDeals, setRawDeals] = useState([]);
    const [dealsLoading, setDealsLoading] = useState(true);
    const [dealsError, setDealsError] = useState("");
    const [filters, setFilters] = useState(initialFilters);

    const stages = groupIntoStages(rawDeals);

    const [formOpen, setFormOpen] = useState(false);
    const [form, setForm] = useState(initialForm);
    const [formError, setFormError] = useState("");
    const [creatingDeal, setCreatingDeal] = useState(false);

    const fetchDeals = async () => {
        setDealsLoading(true);
        setDealsError("");
        try {
            const res = await fetch(DEALS_ENDPOINT, { method: "GET" });
            const resp = await res.json();
            if (res.ok && resp.success && Array.isArray(resp.data)) {
                setRawDeals(resp.data.map(transformDeal));
            } else {
                setRawDeals([]);
                setDealsError(resp.message || "Couldn't load deals.");
            }
        } catch (err) {
            setRawDeals([]);
            setDealsError("Couldn't load deals. Check your connection and try again.");
        } finally {
            setDealsLoading(false);
        }
    };

    /* ---------------- drag-and-drop between stage columns ---------------- */
    const [draggedId, setDraggedId] = useState(null);
    const [dragOverStage, setDragOverStage] = useState(null);
    const [moveError, setMoveError] = useState("");
    const [lastMove, setLastMove] = useState(null); // { dealId, dealName, fromStage, toStage }

    const handleDragStart = (dealId) => (e) => {
        setDraggedId(dealId);
        e.dataTransfer.effectAllowed = "move";
        // Some browsers require data to be set for drag to work at all.
        e.dataTransfer.setData("text/plain", String(dealId));
    };

    const handleDragEnd = () => {
        setDraggedId(null);
        setDragOverStage(null);
    };

    const handleColumnDragOver = (stageName) => (e) => {
        e.preventDefault(); // required to allow dropping
        e.dataTransfer.dropEffect = "move";
        if (dragOverStage !== stageName) setDragOverStage(stageName);
    };

    const handleColumnDragLeave = (stageName) => () => {
        setDragOverStage((prev) => (prev === stageName ? null : prev));
    };

    // Shared by both an actual drag-drop and the "Undo" button — moves a
    // deal to targetStage, optimistically, then persists it. On failure it
    // rolls back to whatever stage it was in before THIS call.
    const moveDeal = async (dealId, targetStage) => {
        const current = rawDeals.find((d) => d.id === dealId);
        if (!current || current.stage === targetStage) return;

        const previousStage = current.stage;
        setRawDeals((prev) =>
            prev.map((d) =>
                d.id === dealId ? { ...d, stage: targetStage, won: targetStage === "Closed Won" } : d
            )
        );
        setMoveError("");

        try {
            const res = await fetch(`${DEALS_ENDPOINT}/${dealId}/stage`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ stage: targetStage }),
            });
            const resp = await res.json().catch(() => null);
            if (!res.ok || !resp?.success) throw new Error(resp?.error || "move failed");
            return previousStage; // caller uses this to offer Undo
        } catch (err) {
            // Roll back on failure so the board never silently disagrees with the DB.
            setRawDeals((prev) =>
                prev.map((d) =>
                    d.id === dealId ? { ...d, stage: previousStage, won: previousStage === "Closed Won" } : d
                )
            );
            setMoveError("Couldn't move that deal — please try again.");
            setTimeout(() => setMoveError(""), 3000);
            return null;
        }
    };

    const showUndoToast = (dealId, dealName, fromStage, toStage) => {
        setLastMove({ dealId, dealName, fromStage, toStage });
    };

    const handleDrop = (stageName) => async (e) => {
        e.preventDefault();
        const dealId = draggedId ?? Number(e.dataTransfer.getData("text/plain"));
        setDraggedId(null);
        setDragOverStage(null);
        if (!dealId) return;

        const dealName = rawDeals.find((d) => d.id === dealId)?.company || "Deal";
        const previousStage = await moveDeal(dealId, stageName);
        if (previousStage) showUndoToast(dealId, dealName, previousStage, stageName);
    };

    const handleUndo = async () => {
        if (!lastMove) return;
        const { dealId, fromStage } = lastMove;
        setLastMove(null);
        await moveDeal(dealId, fromStage); // send it back where it came from — no new Undo offered for an undo
    };

    useEffect(() => {
        fetchDeals();
    }, []);

    const handleChange = (field) => (e) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }));
    };

    const openCreateDeal = (stageName) => {
        setForm({ ...initialForm, stage: stageName || "New Leads" });
        setFormError("");
        setFormOpen(true);
    };

    // Arrived here via Dashboard's "Create Deal" Quick Action? Open the
    // form automatically, then clear the nav state so a refresh/back
    // doesn't reopen it.
    const location = useLocation();
    const navigate = useNavigate();
    useEffect(() => {
        if (location.state?.openCreateDeal) {
            openCreateDeal();
            navigate(location.pathname, { replace: true, state: {} });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.state]);

    const closeCreateDeal = () => {
        setFormOpen(false);
        setFormError("");
    };

    // Saves to isfathena.deals via main.py — no more local-only state.
    const handleCreateDeal = async (e) => {
        e.preventDefault();
        const company = form.company.trim();
        const valueNum = Number(form.value);

        if (!company) {
            setFormError("Enter a contact or company name.");
            return;
        }
        if (!valueNum || valueNum <= 0) {
            setFormError("Enter a valid deal value.");
            return;
        }

        const isWon = form.stage === "Closed Won";
        setCreatingDeal(true);
        setFormError("");
        try {
            const res = await fetch(DEALS_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    contact_name: company,
                    account_name: form.sub.trim(),
                    deal_value: valueNum,
                    stage: form.stage,
                    assigned_to: form.assignedTo,
                    closing_date: form.closingDate || null,
                    is_won: isWon ? 1 : 0,
                }),
            });
            const resp = await res.json().catch(() => null);
            if (!res.ok || !resp?.success) {
                throw new Error(resp?.message || "Could not save deal");
            }
            setFormOpen(false);
            setForm(initialForm);
            fetchDeals(); // refresh from the DB so the board shows the real saved row
        } catch (err) {
            setFormError("Could not save this deal. Please try again.");
        } finally {
            setCreatingDeal(false);
        }
    };

    // Pipeline-wide stats derived from actual deal data.
    const allDeals = stages.flatMap((s) => s.deals);
    const pipelineValue = allDeals.reduce((sum, d) => sum + d.valueNum, 0);
    const wonCount = allDeals.filter((d) => d.won).length;
    const winRate = allDeals.length ? ((wonCount / allDeals.length) * 100).toFixed(1) : "0.0";

    // "This month" measured against the real, current calendar month.
    const closingThisMonthDeals = allDeals.filter((d) => d.closingDate && isSameMonth(d.closingDate, 0));
    const closingThisMonthValue = closingThisMonthDeals.reduce((sum, d) => sum + d.valueNum, 0);

    // Sales cycle = days between a deal being created and its closing date,
    // averaged across WON deals only (the only ones with a real "closed" outcome).
    // Deals missing either date are skipped rather than guessed at.
    const cycleLengths = allDeals
        .filter((d) => d.won && d.createdAt && d.closingDate)
        .map((d) => {
            const created = new Date(d.createdAt.replace(" ", "T"));
            const closed = new Date(d.closingDate);
            const days = Math.round((closed - created) / (1000 * 60 * 60 * 24));
            return days;
        })
        .filter((days) => Number.isFinite(days) && days >= 0);
    const avgSalesCycle =
        cycleLengths.length > 0 ? Math.round(cycleLengths.reduce((s, d) => s + d, 0) / cycleLengths.length) : null;

    // AI Priority Queue — who to contact first today, ranked by the
    // heuristic engine above. Pipeline-wide (like the stat cards), so it
    // isn't affected by the board's search/filter state below.
    const aiQueue = allDeals
        .filter((d) => !d.won)
        .map((d) => ({ ...d, ai: getAiSuggestion(d) }))
        .sort((a, b) => b.ai.priorityScore - a.ai.priorityScore)
        .slice(0, 5);

    const stats = [
        { label: "Pipeline Value", value: formatCurrency(pipelineValue), trend: "Sum of all open + won deals", up: null, icon: IndianRupee, color: "orange" },
        { label: "Active Deals", value: String(allDeals.length - wonCount), trend: `${allDeals.length} total deals`, up: null, icon: Briefcase, color: "purple" },
        {
            label: "Closing This Month",
            value: String(closingThisMonthDeals.length),
            trend: closingThisMonthDeals.length > 0 ? `${formatCurrency(closingThisMonthValue)} expected` : "None scheduled",
            up: null,
            icon: CalendarDays,
            color: "purple",
        },
        { label: "Win Rate", value: `${winRate}%`, trend: `${wonCount} of ${allDeals.length} deals won`, up: null, icon: Target, color: "green" },
        {
            label: "Avg. Sales Cycle",
            value: avgSalesCycle !== null ? `${avgSalesCycle} Days` : "—",
            trend: avgSalesCycle !== null ? `Based on ${cycleLengths.length} won deal${cycleLengths.length !== 1 ? "s" : ""}` : "No won deals yet",
            up: null,
            icon: Clock,
            color: "blue",
        },
    ];

    // Applies every active filter to every stage's deal list. Stat cards
    // above stay based on the FULL pipeline (overall KPIs); only the
    // Kanban board and List view below narrow down.
    const q = filters.search.trim().toLowerCase();
    const filteredStages = stages.map((stage) => ({
        ...stage,
        deals: stage.deals.filter((deal) => {
            if (filters.stage !== "All" && stage.name !== filters.stage) return false;
            if (filters.assignedTo !== "All" && deal.assignedTo !== filters.assignedTo) return false;
            if (!matchesValueFilter(deal.valueNum, filters.value)) return false;
            if (!matchesClosingFilter(deal, filters.closing)) return false;
            if (q && !`${deal.company} ${deal.sub}`.toLowerCase().includes(q)) return false;
            return true;
        }),
    }));

    const activeFilterCount = Object.entries(filters).filter(
        ([key, val]) => (key === "search" ? val.trim() !== "" : val !== "All")
    ).length;

    const clearFilters = () => setFilters(initialFilters);
    const setFilter = (key) => (e) => setFilters((prev) => ({ ...prev, [key]: e.target.value }));

    return (
        <section id="sec-sales-pipeline" className="h-full flex flex-col overflow-hidden relative z-10 py-3 sm:py-4">
            <div className="w-full h-full flex flex-col min-h-0 px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="flex flex-wrap items-start justify-between gap-4 shrink-0">
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
                            Sales Pipeline <BarChart3 size={20} className="text-orange-500" />
                        </h2>
                        <p className="text-gray-400 text-sm mt-1">
                            Track and manage your deals across all stages. Close more deals with AI.
                        </p>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <div className="relative">
                            <select className="bg-black border border-white/10 rounded-lg pl-3 pr-8 py-2.5 text-sm text-white outline-none focus:border-orange-500/60 appearance-none cursor-pointer">
                                <option>Default Pipeline</option>
                            </select>
                            <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                        </div>

                        {lastMove && !moveError && (
                            <div className="flex items-center gap-2 bg-black border border-orange-500/30 rounded-lg pl-3 pr-1.5 py-1.5 text-xs">
                                <span className="text-gray-300">
                                    Moved <span className="text-white font-semibold">{lastMove.dealName}</span> to{" "}
                                    <span className="text-orange-400 font-semibold">{lastMove.toStage}</span>
                                </span>
                                <button
                                    onClick={handleUndo}
                                    className="flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-black font-bold px-2.5 py-1 rounded-md transition"
                                >
                                    <Undo2 size={12} /> Undo
                                </button>
                            </div>
                        )}
                        <button
                            type="button"
                            className="h-[42px] w-[42px] flex items-center justify-center border border-white/10 hover:border-white/30 text-gray-300 rounded-lg transition duration-200"
                            title="Pipeline settings"
                        >
                            <Settings size={16} />
                        </button>
                        <button
                            type="button"
                            onClick={() => openCreateDeal()}
                            className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-4 py-2.5 rounded-lg font-semibold text-sm transition duration-200"
                        >
                            <Plus size={16} />
                            Create Deal
                        </button>
                    </div>
                </div>

                {/* Stat cards */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-4 shrink-0">
                    {stats.map(({ label, value, trend, up, icon, color }, i) => (
                        <div key={i} className={`${CARD} p-3.5`}>
                            <div className="flex items-start justify-between">
                                <p className="text-[11px] text-gray-400 font-medium">{label}</p>
                                <Chip color={color} icon={icon} size={14} />
                            </div>
                            <p className="text-xl font-bold mt-1.5 text-white">{value}</p>
                            <p
                                className={`flex items-center gap-1 text-[11px] mt-1 ${
                                    up === null ? "text-gray-500" : up ? "text-green-400" : "text-red-400"
                                }`}
                            >
                                {up === null ? null : up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                                {trend}
                            </p>
                        </div>
                    ))}
                </div>

                {/* AI Priority Queue */}
                {aiQueue.length > 0 && (
                    <div className={`${CARD} p-3.5 mt-4 shrink-0`}>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                                <Sparkles size={14} className="text-orange-400" /> AI Priority Queue
                            </h3>
                            <span className="text-[11px] text-gray-500">Ranked by urgency, value &amp; engagement</span>
                        </div>
                        <div className="flex gap-2.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                            {aiQueue.map((deal, i) => (
                                <div
                                    key={deal.id}
                                    className="flex items-center gap-2.5 bg-black border border-white/10 hover:border-orange-500/40 rounded-xl px-3 py-2.5 shrink-0 min-w-[200px] transition"
                                    title={deal.ai.reason}
                                >
                                    <span className="h-6 w-6 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 text-[11px] font-bold flex items-center justify-center shrink-0">
                                        {i + 1}
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold text-white truncate leading-tight">{deal.company}</p>
                                        <p className="text-[10px] text-gray-500 truncate">{deal.ai.action}</p>
                                    </div>
                                    <span className="ml-auto text-xs font-bold text-green-400 shrink-0">
                                        {Math.round(deal.ai.confidence)}%
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Toolbar */}
                <div className="flex flex-wrap items-center gap-2.5 mt-4 shrink-0">
                    <div className="relative flex-1 min-w-[180px]">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        <input
                            type="text"
                            value={filters.search}
                            onChange={setFilter("search")}
                            placeholder="Search deals..."
                            className="w-full bg-black border border-white/10 rounded-lg pl-9 pr-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-orange-500/60"
                        />
                    </div>

                    <div className="relative">
                        <select
                            value={filters.stage}
                            onChange={setFilter("stage")}
                            className="bg-black border border-white/10 rounded-lg pl-3 pr-8 py-2.5 text-xs text-gray-300 outline-none focus:border-orange-500/60 appearance-none cursor-pointer"
                        >
                            <option value="All">Stage: All</option>
                            {STAGE_NAMES.map((s) => (
                                <option key={s} value={s}>Stage: {s}</option>
                            ))}
                        </select>
                        <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                    </div>

                    <div className="relative">
                        <select
                            value={filters.assignedTo}
                            onChange={setFilter("assignedTo")}
                            className="bg-black border border-white/10 rounded-lg pl-3 pr-8 py-2.5 text-xs text-gray-300 outline-none focus:border-orange-500/60 appearance-none cursor-pointer"
                        >
                            <option value="All">Assigned To: All</option>
                            {ASSIGNED_OPTIONS.map((a) => (
                                <option key={a} value={a}>Assigned To: {a}</option>
                            ))}
                        </select>
                        <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                    </div>

                    <div className="relative">
                        <select
                            value={filters.value}
                            onChange={setFilter("value")}
                            className="bg-black border border-white/10 rounded-lg pl-3 pr-8 py-2.5 text-xs text-gray-300 outline-none focus:border-orange-500/60 appearance-none cursor-pointer"
                        >
                            <option value="All">Deal Value: All</option>
                            <option value="under50k">Under ₹50K</option>
                            <option value="50k-200k">₹50K – ₹2L</option>
                            <option value="above200k">Above ₹2L</option>
                        </select>
                        <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                    </div>

                    <div className="relative">
                        <select
                            value={filters.closing}
                            onChange={setFilter("closing")}
                            className="bg-black border border-white/10 rounded-lg pl-3 pr-8 py-2.5 text-xs text-gray-300 outline-none focus:border-orange-500/60 appearance-none cursor-pointer"
                        >
                            <option value="All">Closing: All</option>
                            <option value="thisMonth">Closing: This Month</option>
                            <option value="nextMonth">Closing: Next Month</option>
                            <option value="overdue">Closing: Overdue</option>
                        </select>
                        <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
                    </div>

                    <button
                        type="button"
                        onClick={clearFilters}
                        disabled={activeFilterCount === 0}
                        className="flex items-center gap-1.5 border border-white/10 hover:border-white/30 text-gray-300 px-3 py-2.5 rounded-lg text-xs font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
                        title={activeFilterCount ? "Clear all filters" : "No filters active"}
                    >
                        <Filter size={13} /> Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
                    </button>

                    <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-lg p-1 ml-auto">
                        <button
                            onClick={() => setView("kanban")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                                view === "kanban" ? "bg-orange-500 text-white" : "text-gray-400 hover:text-white"
                            }`}
                        >
                            <LayoutGrid size={13} /> Kanban
                        </button>
                        <button
                            onClick={() => setView("list")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                                view === "list" ? "bg-orange-500 text-white" : "text-gray-400 hover:text-white"
                            }`}
                        >
                            <ListIcon size={13} /> List
                        </button>
                    </div>
                </div>

                {/* Deals loading / error */}
                {dealsLoading && (
                    <div className={`${CARD} flex-1 min-h-0 mt-4 flex items-center justify-center text-gray-400 text-sm`}>
                        Loading deals...
                    </div>
                )}
                {!dealsLoading && dealsError && (
                    <div className={`${CARD} flex-1 min-h-0 mt-4 flex items-center justify-center text-red-400 text-sm`}>
                        {dealsError}
                    </div>
                )}

                {/* Empty state */}
                {!dealsLoading && !dealsError && (
                    filteredStages.every((s) => s.deals.length === 0) ? (
                    <div className={`${CARD} flex-1 min-h-0 mt-4 flex flex-col items-center justify-center gap-2`}>
                        <p className="text-gray-400 text-sm">No deals match these filters.</p>
                        <button type="button" onClick={clearFilters} className="text-orange-400 hover:text-orange-300 text-xs font-semibold">
                            Clear filters
                        </button>
                    </div>
                ) : view === "kanban" ? (
                    /* Kanban board */
                    <div className="flex-1 min-h-0 mt-4 overflow-x-auto overflow-y-hidden pb-2">
                        <div className="flex gap-3 h-full min-w-max">
                            {filteredStages.map((stage) => {
                                const stageTotal = stage.deals.reduce((sum, d) => sum + d.valueNum, 0);
                                const accent = stageAccents[stage.name];
                                return (
                                    <div
                                        key={stage.name}
                                        onDragOver={handleColumnDragOver(stage.name)}
                                        onDragLeave={handleColumnDragLeave(stage.name)}
                                        onDrop={handleDrop(stage.name)}
                                        className={`w-72 shrink-0 h-full flex flex-col bg-[#0d0d10] border rounded-2xl p-3 transition-colors ${
                                            dragOverStage === stage.name
                                                ? "border-orange-500/60 bg-orange-500/[0.04]"
                                                : "border-white/10"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between shrink-0 px-1">
                                            <div className="flex items-center gap-2">
                                                <h3 className={`text-sm font-bold ${accent.text}`}>{stage.name}</h3>
                                                <span className={`text-[10px] rounded-full px-2 py-0.5 font-bold border ${accent.chip}`}>
                                                    {stage.deals.length}
                                                </span>
                                            </div>
                                            <span className="text-xs font-bold text-white">{formatCurrency(stageTotal)}</span>
                                        </div>

                                        <div className="flex-1 min-h-0 overflow-y-auto mt-3 space-y-2.5 pr-0.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                                            {stage.deals.map((deal) => {
                                                const sv = !deal.won && typeof deal.score === "number" && scoreVisual(deal.score);
                                                const ai = getAiSuggestion(deal);
                                                return (
                                                    <div
                                                        key={deal.id}
                                                        draggable={Boolean(deal.id)}
                                                        onDragStart={handleDragStart(deal.id)}
                                                        onDragEnd={handleDragEnd}
                                                        className={`bg-black border border-white/10 hover:border-orange-500/40 rounded-xl p-3 transition cursor-grab active:cursor-grabbing ${
                                                            draggedId === deal.id ? "opacity-40" : ""
                                                        }`}
                                                    >
                                                        <div className="flex items-start justify-between gap-2">
                                                            <div className="flex items-center gap-2.5 min-w-0">
                                                                <div className="h-8 w-8 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 text-[11px] font-bold flex items-center justify-center shrink-0">
                                                                    {initials(deal.company)}
                                                                </div>
                                                                <div className="min-w-0">
                                                                    <p className="text-sm font-semibold text-white truncate leading-tight">{deal.company}</p>
                                                                    <p className="text-[11px] text-gray-500 truncate">{deal.sub}</p>
                                                                </div>
                                                            </div>

                                                            {deal.won ? (
                                                                <span className="flex items-center gap-1 text-[10px] bg-green-500/15 border border-green-500/30 text-green-400 rounded-full px-2 py-0.5 font-bold shrink-0">
                                                                    <Check size={10} /> Won
                                                                </span>
                                                            ) : (
                                                                sv && (
                                                                    <span className={`flex items-center gap-1 text-[11px] font-bold rounded-full px-2 py-0.5 border shrink-0 ${sv.chip}`}>
                                                                        <sv.icon size={11} /> {deal.score}
                                                                    </span>
                                                                )
                                                            )}
                                                        </div>

                                                        <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-white/5">
                                                            <p className="text-sm font-bold text-white">{formatCurrency(deal.valueNum)}</p>
                                                            <span className="text-[10px] text-gray-500">{deal.time}</span>
                                                        </div>

                                                        {(deal.assignedTo || deal.closingDate) && (
                                                            <div className="flex items-center justify-between mt-2 text-[10px]">
                                                                {deal.assignedTo ? (
                                                                    <span className="flex items-center gap-1 text-gray-400">
                                                                        <User size={10} /> {deal.assignedTo}
                                                                    </span>
                                                                ) : <span />}
                                                                {deal.closingDate && (
                                                                    <span
                                                                        className={`flex items-center gap-1 ${
                                                                            isOverdue(deal.closingDate, deal.won) ? "text-red-400" : "text-gray-500"
                                                                        }`}
                                                                    >
                                                                        <CalendarDays size={10} /> {formatShortDate(deal.closingDate)}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}

                                                        {ai && (
                                                            <div
                                                                className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-white/5 text-[10px]"
                                                                title={ai.reason}
                                                            >
                                                                <span className="flex items-center gap-1 text-cyan-400 font-semibold truncate min-w-0">
                                                                    <Sparkles size={10} className="shrink-0" />
                                                                    <span className="truncate">{ai.action}</span>
                                                                </span>
                                                                <span className="text-gray-500 font-medium shrink-0">{ai.confidence}%</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => openCreateDeal(stage.name)}
                                            className={`shrink-0 mt-2.5 flex items-center justify-center gap-1.5 text-xs font-semibold rounded-lg py-2 border transition ${
                                                stage.won
                                                    ? "border-green-500/30 text-green-400 hover:bg-green-500/10"
                                                    : "border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                                            }`}
                                        >
                                            <Plus size={13} /> Add Deal
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ) : (
                    /* List view */
                    <div className={`${CARD} flex-1 min-h-0 mt-4 overflow-y-auto p-4`}>
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-[11px] text-gray-500 uppercase border-b border-white/10">
                                    <th className="pb-2 font-semibold">Deal</th>
                                    <th className="pb-2 font-semibold">Stage</th>
                                    <th className="pb-2 font-semibold">Value</th>
                                    <th className="pb-2 font-semibold">Score</th>
                                    <th className="pb-2 font-semibold">Updated</th>
                                    <th className="pb-2 font-semibold text-right">
                                        <button
                                            type="button"
                                            onClick={() => downloadDealsCSV(filteredStages)}
                                            title="Download list as CSV"
                                            className="inline-flex items-center gap-1.5 border border-white/10 hover:border-orange-500/50 hover:text-orange-400 text-gray-300 px-2.5 py-1.5 rounded-lg normal-case font-medium transition"
                                        >
                                            <Download size={12} /> Download
                                        </button>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredStages.flatMap((stage) =>
                                    stage.deals.map((deal, i) => (
                                        <tr key={`${stage.name}-${i}`} className="border-b border-white/5 hover:bg-white/[0.03]">
                                            <td className="py-2.5">
                                                <p className="text-white font-medium">{deal.company}</p>
                                                <p className="text-gray-500 text-xs">{deal.sub}</p>
                                            </td>
                                            <td className="py-2.5 text-gray-300">{stage.name}</td>
                                            <td className="py-2.5 text-white font-semibold">{formatCurrency(deal.valueNum)}</td>
                                            <td className="py-2.5 text-gray-300">{deal.won ? "Won" : (deal.score ?? "—")}</td>
                                            <td className="py-2.5 text-gray-500 text-xs">{deal.time}</td>
                                            <td className="py-2.5"></td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                ))}
            </div>

            {/* Drag-drop move error */}
            {moveError && (
                <div className="fixed bottom-6 right-6 z-[1999] flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium shadow-lg border bg-red-500/15 border-red-500/40 text-red-400">
                    {moveError}
                </div>
            )}

            {/* Create Deal modal */}
            {formOpen && (
                <div className="fixed inset-0 z-[1997] flex items-center justify-center bg-black/80 px-4">
                    <div className="bg-black border border-orange-600/30 rounded-2xl p-6 max-w-md w-full shadow-[0_0_60px_rgba(0,0,0,0.9)]">
                        <div className="flex items-center justify-between mb-5">
                            <h4 className="text-white font-bold text-lg">Create Deal</h4>
                            <button type="button" onClick={closeCreateDeal} className="text-gray-400 hover:text-white transition duration-200">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateDeal} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold tracking-wider text-gray-400 uppercase mb-1.5">
                                    Contact / Company Name
                                </label>
                                <input
                                    type="text"
                                    value={form.company}
                                    onChange={handleChange("company")}
                                    placeholder="e.g. Rahul Patil"
                                    className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-orange-500/70 focus:ring-1 focus:ring-orange-500/40 transition"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold tracking-wider text-gray-400 uppercase mb-1.5">
                                    Account / Business Name
                                </label>
                                <input
                                    type="text"
                                    value={form.sub}
                                    onChange={handleChange("sub")}
                                    placeholder="e.g. Dream Homes"
                                    className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-orange-500/70 focus:ring-1 focus:ring-orange-500/40 transition"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold tracking-wider text-gray-400 uppercase mb-1.5">
                                        Deal Value (₹)
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={form.value}
                                        onChange={handleChange("value")}
                                        placeholder="80000"
                                        className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-orange-500/70 focus:ring-1 focus:ring-orange-500/40 transition"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold tracking-wider text-gray-400 uppercase mb-1.5">
                                        Stage
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={form.stage}
                                            onChange={handleChange("stage")}
                                            className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-orange-500/70 appearance-none pr-9 cursor-pointer"
                                        >
                                            {STAGE_NAMES.map((s) => (
                                                <option key={s} value={s} className="bg-black text-white">{s}</option>
                                            ))}
                                        </select>
                                        <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold tracking-wider text-gray-400 uppercase mb-1.5">
                                        Assigned To
                                    </label>
                                    <div className="relative">
                                        <select
                                            value={form.assignedTo}
                                            onChange={handleChange("assignedTo")}
                                            className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-orange-500/70 appearance-none pr-9 cursor-pointer"
                                        >
                                            {ASSIGNED_OPTIONS.map((a) => (
                                                <option key={a} value={a} className="bg-black text-white">{a}</option>
                                            ))}
                                        </select>
                                        <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-semibold tracking-wider text-gray-400 uppercase mb-1.5">
                                        Expected Closing
                                    </label>
                                    <input
                                        type="date"
                                        value={form.closingDate}
                                        onChange={handleChange("closingDate")}
                                        className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white outline-none focus:border-orange-500/70 focus:ring-1 focus:ring-orange-500/40 transition [color-scheme:dark]"
                                    />
                                </div>
                            </div>

                            {formError && <p className="text-xs text-red-400">{formError}</p>}

                            <div className="flex items-center gap-3 pt-1">
                                <button
                                    type="button"
                                    onClick={closeCreateDeal}
                                    disabled={creatingDeal}
                                    className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-gray-300 border border-white/10 hover:border-white/30 transition disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={creatingDeal}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold bg-orange-500 hover:bg-orange-600 text-black transition disabled:opacity-60"
                                >
                                    {creatingDeal ? (
                                        <>
                                            <Loader2 size={13} className="animate-spin" /> Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Plus size={13} /> Create Deal
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </section>
    );
};

export default SalesPipelineSection;