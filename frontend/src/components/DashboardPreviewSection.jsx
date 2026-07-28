import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { getGreeting } from "./Greeting";
import { useCustomerData } from "./CustomerDataContext";
import { GROQ_API_KEY, GROQ_MODEL } from "./groqConfig";
import {
    TrendingUp,
    TrendingDown,
    AlertCircle,
    AlertTriangle,
    Target,
    Percent,
    Plus,
    Megaphone,
    Send,
    Handshake,
    Bot,
    Loader2,
    RefreshCw,
    Flame,
    Rocket,
    ShieldAlert,
    Radar,
} from "lucide-react";

/* ==========================================================
   DUMMY DATA — swap for live account data once the backend
   endpoint is wired up. Shape stays flat so this is a
   drop-in replacement later.
========================================================== */

/**
 * Same heuristic used in Lead_Management.jsx's "AI Score" column —
 * duplicated here (not imported) to keep this preview page independent
 * of Lead Management's internal file, same way ReachableChannelsCard
 * keeps its own copy of message templates instead of cross-importing.
 * NOT a real AI model — a stable, deterministic placeholder until a
 * proper scoring pipeline exists.
 */
const computeLeadScore = (lead) => {
    const statusWeights = { Success: 88, "Phone Contacted": 74, "Mail Send": 58, Open: 44, Closed: 28 };
    const base = statusWeights[lead.current_status] ?? 50;
    const jitter = (Number(lead.id) || 0) % 10;
    return Math.min(99, base + jitter);
};

// AI Score is now persisted server-side (lead_generation.ai_score, computed
// in growthos_backend/main.py from the Add Lead form's own fields — source
// quality, GMB status, website, contact completeness, comment detail).
// Use that real value when present; only fall back to the old heuristic
// above for rows saved before that column existed.
const getLeadScore = (lead) =>
    lead.ai_score === null || lead.ai_score === undefined ? computeLeadScore(lead) : Number(lead.ai_score);

// Same growthos_backend endpoint Sales Pipeline reads from — kept as its
// own fetch here (not shared via CustomerDataContext yet) so this preview
// page can show a real, live Pipeline Value instead of a hardcoded number.
const API_BASE_URL = "http://localhost:8000";
const DEALS_ENDPOINT = `${API_BASE_URL}/deals`;

// Same formatting convention as Sales Pipeline's formatCurrency().
const formatCurrency = (num) => {
    const n = Number(num) || 0;
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    return `₹${n.toLocaleString("en-IN")}`;
};

const quickActions = [
    { label: "Add Lead", icon: Plus, path: "/app/campaign-builder", state: { openAddLead: true } },
    { label: "Create Campaign", icon: Megaphone, path: "/app/campaign-automation", state: { openCreateAutomation: true } },
    { label: "Send Follow-up", icon: Send, path: "/app/campaign-builder" },
    { label: "Create Deal", icon: Handshake, path: "/app/sales-pipeline", state: { openCreateDeal: true } },
    { label: "Ask AI Copilot", icon: Bot, path: "/app/ai-assistant" },
];

const toneStyles = {
    up: "text-green-400",
    warn: "text-orange-400",
    neutral: "text-gray-400",
};

/* ==========================================================
   CUSTOM CHART TOOLTIP — themed to match the dark/orange
   design instead of recharts' default white tooltip.
========================================================== */
const RevenueTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    return (
        <div className="bg-[#0a0a0a] border border-orange-600/30 rounded-lg px-3 py-2 text-xs">
            <p className="text-gray-400">{label}</p>
            <p className="text-orange-400 font-semibold mt-0.5">₹{payload[0].value}L</p>
        </div>
    );
};

/* ==========================================================
   DASHBOARD PREVIEW (id="sec-dashboard-preview")
   "Good morning" overview screen — fit-screen layout, fills
   the routed content area exactly, no outer page scroll.
========================================================== */
const DashboardPreviewSection = () => {
    const navigate = useNavigate();
    const { leads, leadsLoading } = useCustomerData();

    // Same formulas as Lead_Management.jsx's header stats, so both pages
    // always agree: total leads, "hot" = AI score ≥ 80, conversion = leads
    // whose current_status is "Success".
    const leadStats = useMemo(() => {
        const total = leads.length;
        const hot = leads.filter((l) => getLeadScore(l) >= 80).length;
        const followUpsDue = leads.filter((l) => !l.is_contacted).length;
        const converted = leads.filter((l) => l.current_status === "Success").length;
        const conversionRate = total > 0 ? ((converted / total) * 100).toFixed(1) : "0.0";
        return { total, hot, followUpsDue, conversionRate };
    }, [leads]);

    // Pipeline Value — fetched straight from isfathena.deals (same table
    // and endpoint Sales Pipeline uses), so this card shows a real,
    // live total instead of the old hardcoded "₹24.8L" placeholder.
    const [deals, setDeals] = useState([]);
    const [dealsLoading, setDealsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch(DEALS_ENDPOINT, { method: "GET" });
                const resp = await res.json();
                if (!cancelled && res.ok && resp.success && Array.isArray(resp.data)) {
                    setDeals(resp.data);
                }
            } catch (err) {
                // Silently keep deals empty on failure — the KPI card below
                // just reads 0 / ₹0 rather than blocking the whole page.
            } finally {
                if (!cancelled) setDealsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    // Same definition Sales Pipeline uses: pipeline value = sum of every
    // deal's value (won + open); "active" = not yet in Closed Won.
    const dealStats = useMemo(() => {
        const pipelineValue = deals.reduce((sum, d) => sum + (Number(d.deal_value) || 0), 0);
        const activeDeals = deals.filter((d) => d.stage !== "Closed Won").length;
        return { pipelineValue, activeDeals };
    }, [deals]);

    // Revenue Overview chart — real cumulative Pipeline Value over time,
    // built from the SAME deals fetched above. Each deal contributes its
    // value on the day it was created; plotting the running total shows
    // how the pipeline has actually grown, not a fabricated trend line.
    const revenueData = useMemo(() => {
        if (!deals.length) return [];
        const byDay = {};
        deals.forEach((d) => {
            if (!d.created_at) return;
            const day = d.created_at.slice(0, 10); // "YYYY-MM-DD"
            byDay[day] = (byDay[day] || 0) + (Number(d.deal_value) || 0);
        });
        const sortedDays = Object.keys(byDay).sort();
        let running = 0;
        return sortedDays.map((day) => {
            running += byDay[day];
            const d = new Date(day);
            return {
                date: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
                revenue: Number((running / 100000).toFixed(2)), // ₹ Lakh, matching the Y-axis label
            };
        });
    }, [deals]);

    /* ==========================================================
       AI INSIGHTS PANEL — everything numeric below is computed
       directly from real leads/deals data (never invented). Groq
       is used later ONLY to phrase short reason/recommendation
       sentences around these numbers — see runAIInsights().
    ========================================================== */
    const TODAY = useMemo(() => new Date(), []);

    // 1) Pipeline growth — sum of new deal value added in the last 7 days
    // vs. the 7 days before that. Needs real day-grouped data on both
    // sides; if there isn't enough history yet, growth is null (shown
    // as "Not enough data yet" rather than a fabricated percentage).
    const pipelineGrowth = useMemo(() => {
        if (!deals.length) return null;
        const byDay = {};
        deals.forEach((d) => {
            if (!d.created_at) return;
            const day = d.created_at.slice(0, 10);
            byDay[day] = (byDay[day] || 0) + (Number(d.deal_value) || 0);
        });
        const days = Object.keys(byDay).sort();
        if (days.length < 2) return null;

        const dayMs = 86400000;
        const cutoff7 = new Date(TODAY.getTime() - 7 * dayMs);
        const cutoff14 = new Date(TODAY.getTime() - 14 * dayMs);

        let recent = 0;
        let prior = 0;
        days.forEach((day) => {
            const d = new Date(day);
            if (d >= cutoff7) recent += byDay[day];
            else if (d >= cutoff14) prior += byDay[day];
        });

        if (prior === 0 && recent === 0) return null;
        if (prior === 0) return { pct: 100, recent, prior };
        const pct = ((recent - prior) / prior) * 100;
        return { pct: Math.round(pct), recent, prior };
    }, [deals, TODAY]);

    // 2) Overdue deals — real: not won, and past their own closing_date.
    const overdueDeals = useMemo(() => {
        return deals
            .filter((d) => !d.is_won && d.closing_date && new Date(d.closing_date) < TODAY)
            .map((d) => ({
                ...d,
                daysOverdue: Math.floor((TODAY - new Date(d.closing_date)) / 86400000),
            }))
            .sort((a, b) => b.daysOverdue - a.daysOverdue);
    }, [deals, TODAY]);

    // 3) Predictive pipeline value — simple linear projection: average
    // daily pipeline growth over available history, projected 30 days
    // out. Confidence is a heuristic based on how many days of real data
    // back it (NOT a statistical model) — capped so it never overclaims.
    const prediction = useMemo(() => {
        if (revenueData.length < 2) return null;
        const first = revenueData[0].revenue;
        const last = revenueData[revenueData.length - 1].revenue;
        const spanDays = Math.max(1, revenueData.length - 1);
        const dailyRate = (last - first) / spanDays;
        const projected = Math.max(last, last + dailyRate * 30);
        const confidence = Math.min(90, 35 + revenueData.length * 5);
        return { projectedLakh: projected, confidence };
    }, [revenueData]);

    // 4) Top opportunity — highest-scoring lead that hasn't already
    // converted. "Probability" is the same 0-99 heuristic ai_score,
    // relabeled — same honesty rule as elsewhere in this app: it's a
    // deterministic readiness estimate, not a real ML probability.
    const topOpportunity = useMemo(() => {
        const open = leads.filter((l) => l.current_status !== "Success");
        if (!open.length) return null;
        const best = open.reduce((top, l) => (getLeadScore(l) > getLeadScore(top) ? l : top), open[0]);
        const score = getLeadScore(best);
        if (score < 70) return null; // nothing worth flagging as an "opportunity"
        const action = score >= 90 ? "Schedule Demo Today" : score >= 80 ? "Call Today" : "Follow Up This Week";
        return { name: best.user_name || "Unnamed lead", score, action };
    }, [leads]);

    // 5) Top risk — the single most overdue open deal.
    const topRisk = useMemo(() => {
        if (!overdueDeals.length) return null;
        const d = overdueDeals[0];
        const level = d.daysOverdue > 10 ? "High" : d.daysOverdue > 3 ? "Medium" : "Low";
        return { company: d.contact_name || d.account_name || "Unnamed deal", daysOverdue: d.daysOverdue, level };
    }, [overdueDeals]);

    // 6) Lead-source performance — real conversion rate per source
    // (Success / total), only for sources with enough volume (3+) to be
    // meaningful. Used for the "Marketing Suggestion" card instead of
    // fabricated channel ROI numbers this app doesn't actually track.
    const sourcePerformance = useMemo(() => {
        const bySource = {};
        leads.forEach((l) => {
            const src = l.lead_source || "Unknown";
            if (!bySource[src]) bySource[src] = { total: 0, converted: 0 };
            bySource[src].total += 1;
            if (l.current_status === "Success") bySource[src].converted += 1;
        });
        const qualified = Object.entries(bySource)
            .filter(([, v]) => v.total >= 3)
            .map(([name, v]) => ({ name, rate: Math.round((v.converted / v.total) * 100), total: v.total }));
        if (qualified.length < 2) return null;
        qualified.sort((a, b) => b.rate - a.rate);
        return { best: qualified[0], worst: qualified[qualified.length - 1] };
    }, [leads]);

    const kpis = [
        { label: "Total Leads", value: leadStats.total.toLocaleString("en-IN"), trend: "Live from Lead Management", tone: "up", icon: Target },
        { label: "Hot Leads", value: String(leadStats.hot), trend: `${leadStats.followUpsDue} need follow-up`, tone: "warn", icon: AlertCircle },
        {
            label: "Pipeline Value",
            value: dealsLoading ? "…" : formatCurrency(dealStats.pipelineValue),
            trend: dealsLoading ? "Loading deals..." : `${dealStats.activeDeals} active deal${dealStats.activeDeals === 1 ? "" : "s"}`,
            tone: "neutral",
            icon: TrendingUp,
        },
        { label: "Conversion Rate", value: `${leadStats.conversionRate}%`, trend: `${leadStats.total} leads tracked`, tone: "up", icon: Percent },
    ];

    /* ---------------- AI Insights Panel copy (Groq) ---------------- */
    // Every NUMBER in the panel below comes from the useMemo blocks above
    // (real leads/deals data). Groq is used here ONLY to phrase short
    // reason/recommendation sentences around those numbers — it's told
    // exactly what's real and instructed to return "" for anything it
    // doesn't have real data for, instead of inventing one.
    const [aiCopy, setAiCopy] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState("");

    const isGroqConfigured =
        Boolean(GROQ_API_KEY) && GROQ_API_KEY !== "PASTE_YOUR_GROQ_API_KEY_HERE";

    const callGroq = async (prompt) => {
        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${GROQ_API_KEY}`,
            },
            body: JSON.stringify({
                model: GROQ_MODEL,
                temperature: 0.4,
                max_tokens: 400,
                response_format: { type: "json_object" },
                messages: [{ role: "user", content: prompt }],
            }),
        });
        if (!res.ok) throw new Error(`Groq responded with ${res.status}`);
        const data = await res.json();
        return data?.choices?.[0]?.message?.content?.trim() || "";
    };

    // Template-based copy used whenever Groq is unavailable/fails, so the
    // panel still works without AI — every sentence still only reflects
    // the real numbers computed above.
    const buildFallbackCopy = () => ({
        revenueReason: pipelineGrowth
            ? `${pipelineGrowth.recent > pipelineGrowth.prior ? "New deal value added" : "Fewer new deals added"} in the last 7 days vs. the week before.`
            : "",
        revenueRecommendation: pipelineGrowth
            ? pipelineGrowth.pct >= 0
                ? "Keep up current follow-up pace to sustain this."
                : "Review recent deals for stalled follow-ups."
            : "",
        opportunityRecommendation: topOpportunity ? topOpportunity.action : "",
        riskRecommendation: topRisk ? "Call the customer to check in and reschedule closing." : "",
        marketingRecommendation: sourcePerformance
            ? `Shift more follow-up time toward ${sourcePerformance.best.name} leads, your best-converting source.`
            : "",
    });

    const runAIInsights = async () => {
        const fallback = buildFallbackCopy();
        if (!isGroqConfigured) {
            setAiError("");
            setAiCopy(fallback);
            return;
        }
        setAiLoading(true);
        setAiError("");
        try {
            const prompt =
                `You are an insights engine for a CRM/marketing dashboard. Using ONLY the real data points below ` +
                `(never invent a name, channel, or figure that isn't given), write very short, concrete copy, each under 18 words.\n\n` +
                `DATA:\n` +
                `- Pipeline value, last 7 days vs prior 7 days: ${pipelineGrowth ? `₹${pipelineGrowth.recent} new vs ₹${pipelineGrowth.prior} prior (${pipelineGrowth.pct}% change)` : "not enough data yet"}\n` +
                `- Top opportunity lead: ${topOpportunity ? `${topOpportunity.name}, AI score ${topOpportunity.score}` : "none right now"}\n` +
                `- Top at-risk deal: ${topRisk ? `${topRisk.company}, ${topRisk.daysOverdue} days past its closing date, risk level ${topRisk.level}` : "none right now"}\n` +
                `- Best lead source: ${sourcePerformance ? `${sourcePerformance.best.name} at ${sourcePerformance.best.rate}% conversion` : "not enough data yet"}\n` +
                `- Worst lead source: ${sourcePerformance ? `${sourcePerformance.worst.name} at ${sourcePerformance.worst.rate}% conversion` : "not enough data yet"}\n\n` +
                `Return ONLY a JSON object with exactly these keys (all string values):\n` +
                `{"revenueReason": "", "revenueRecommendation": "", "opportunityRecommendation": "", "riskRecommendation": "", "marketingRecommendation": ""}\n` +
                `If a data point above says "not enough data yet" or "none right now", return "" for that field's key(s) instead of guessing.`;

            const text = await callGroq(prompt);
            const cleaned = text.replace(/```json|```/g, "").trim();
            const parsed = JSON.parse(cleaned);
            setAiCopy({ ...fallback, ...parsed });
        } catch (err) {
            setAiError("Couldn't reach the AI right now — showing basic recommendations instead.");
            setAiCopy(fallback);
        } finally {
            setAiLoading(false);
        }
    };

    // Run once real lead AND deal data have finished loading (not
    // immediately on mount, when every computed signal above would still
    // read as empty/zero).
    useEffect(() => {
        if (!leadsLoading && !dealsLoading) runAIInsights();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [leadsLoading, dealsLoading]);

    return (
        <div id="sec-dashboard-preview" className="h-full flex flex-col py-6">
            {/* Header */}
            <div className="shrink-0">
                <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
                    {getGreeting()} <span>👋</span>
                </h1>
                <p className="text-gray-400 mt-1.5 text-sm">
                    Here's what's happening with your business today.
                </p>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mt-6 shrink-0">
                {kpis.map((kpi, index) => {
                    const Icon = kpi.icon;
                    return (
                        <div key={index} className="bg-black border border-orange-600/30 rounded-2xl p-4 sm:p-5">
                            <div className="flex items-center justify-between">
                                <p className="text-gray-400 text-[11px] font-semibold uppercase tracking-wide">
                                    {kpi.label}
                                </p>
                                <Icon size={15} className="text-orange-500 shrink-0" />
                            </div>
                            <h3 className="text-xl sm:text-2xl font-bold text-white mt-2">{kpi.value}</h3>
                            <p className={`text-xs mt-1 ${toneStyles[kpi.tone]}`}>{kpi.trend}</p>
                        </div>
                    );
                })}
            </div>

            {/* Revenue chart + AI Daily Brief */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 mt-5 flex-1 min-h-0">
                {/* Revenue Overview — now real cumulative Pipeline Value from deals */}
                <div className="lg:col-span-2 bg-black border border-orange-600/30 rounded-2xl p-4 sm:p-5 flex flex-col min-h-0">
                    <div className="flex items-center justify-between shrink-0">
                        <h3 className="text-base sm:text-lg font-bold text-white">Pipeline Value Overview</h3>
                        <span className="bg-white/5 border border-white/10 text-gray-300 text-xs px-3 py-1.5 rounded-lg">
                            Cumulative, all time
                        </span>
                    </div>
                    <p className="text-gray-500 text-xs mt-1 shrink-0">Pipeline Value (₹ Lakh) — from Sales Pipeline deals</p>

                    <div className="flex-1 min-h-0 mt-3">
                        {dealsLoading ? (
                            <div className="h-full flex items-center justify-center text-gray-500 text-xs">Loading...</div>
                        ) : revenueData.length === 0 ? (
                            <div className="h-full flex items-center justify-center text-gray-500 text-xs text-center px-4">
                                No deals yet — add some in Sales Pipeline to see this chart.
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={revenueData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#f97316" stopOpacity={0.35} />
                                            <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid stroke="#f97316" strokeOpacity={0.12} strokeDasharray="4 4" vertical={false} />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fill: "#6b7280", fontSize: 11 }}
                                        axisLine={{ stroke: "#f9731633" }}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        tickFormatter={(v) => `${v}L`}
                                        tick={{ fill: "#6b7280", fontSize: 11 }}
                                        axisLine={false}
                                        tickLine={false}
                                        width={36}
                                    />
                                    <Tooltip content={<RevenueTooltip />} />
                                    <Area
                                        type="monotone"
                                        dataKey="revenue"
                                        stroke="#f97316"
                                        strokeWidth={3}
                                        fill="url(#revenueFill)"
                                        dot={{ r: 4, fill: "#f97316", stroke: "#000000", strokeWidth: 2 }}
                                        activeDot={{ r: 6, fill: "#f97316", stroke: "#000000", strokeWidth: 2 }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* AI Insights Panel — every number below is real (computed
                    from leads/deals above); Groq only supplies the short
                    reason/recommendation phrasing around them. */}
                <div className="bg-black border border-orange-600/30 rounded-2xl p-4 sm:p-5 flex flex-col min-h-0">
                    <div className="flex items-center justify-between shrink-0">
                        <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                            <span className="h-8 w-8 rounded-lg bg-orange-500/15 border border-orange-500/30 text-orange-400 flex items-center justify-center shrink-0">
                                <Bot size={16} />
                            </span>
                            AI Insights Panel
                        </h3>
                        <button
                            onClick={runAIInsights}
                            disabled={aiLoading}
                            title="Regenerate"
                            className="text-gray-500 hover:text-orange-400 transition disabled:opacity-50"
                        >
                            <RefreshCw size={14} className={aiLoading ? "animate-spin" : ""} />
                        </button>
                    </div>
                    <p className="text-gray-500 text-xs mt-1 shrink-0">What's happening, why, and what to do next</p>

                    <div className="mt-3.5 overflow-y-auto min-h-0 flex-1 space-y-2.5 pr-0.5">
                        {aiLoading && !aiCopy ? (
                            <div className="flex items-center gap-2 text-gray-400 text-sm p-3">
                                <Loader2 size={14} className="animate-spin" /> Analyzing today's data...
                            </div>
                        ) : (
                            <>
                                {aiError && <p className="text-red-400 text-xs px-0.5">{aiError}</p>}

                                {/* 1. Revenue / Pipeline insight */}
                                <div className="bg-black border border-orange-600/20 rounded-xl p-3.5">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-bold text-white">Pipeline Value</p>
                                        {pipelineGrowth ? (
                                            <span
                                                className={`flex items-center gap-1 text-xs font-bold ${
                                                    pipelineGrowth.pct >= 0 ? "text-green-400" : "text-red-400"
                                                }`}
                                            >
                                                {pipelineGrowth.pct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                                                {pipelineGrowth.pct >= 0 ? "+" : ""}
                                                {pipelineGrowth.pct}%
                                            </span>
                                        ) : (
                                            <span className="text-xs text-gray-500">No trend yet</span>
                                        )}
                                    </div>
                                    {pipelineGrowth ? (
                                        <>
                                            {aiCopy?.revenueReason && (
                                                <p className="text-xs text-gray-400 mt-1.5">
                                                    <span className="text-gray-500 font-semibold">Reason: </span>
                                                    {aiCopy.revenueReason}
                                                </p>
                                            )}
                                            {aiCopy?.revenueRecommendation && (
                                                <p className="text-xs text-orange-400 mt-1">
                                                    <span className="font-semibold">Recommendation: </span>
                                                    {aiCopy.revenueRecommendation}
                                                </p>
                                            )}
                                        </>
                                    ) : (
                                        <p className="text-xs text-gray-500 mt-1.5">
                                            Not enough deal history yet — check back after a few days of activity.
                                        </p>
                                    )}
                                </div>

                                {/* 2. Daily recommendations — compact chip list */}
                                <div className="bg-black border border-orange-600/20 rounded-xl p-3.5 space-y-2">
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Daily Recommendations</p>
                                    {leadStats.hot > 0 && (
                                        <div className="flex items-center gap-2 text-xs text-gray-300">
                                            <Flame size={13} className="text-orange-400 shrink-0" />
                                            <span>
                                                <span className="text-white font-semibold">{leadStats.hot} Hot Lead{leadStats.hot === 1 ? "" : "s"}</span> — Call Today
                                            </span>
                                        </div>
                                    )}
                                    {overdueDeals.length > 0 && (
                                        <div className="flex items-center gap-2 text-xs text-gray-300">
                                            <AlertTriangle size={13} className="text-red-400 shrink-0" />
                                            <span>
                                                <span className="text-white font-semibold">{overdueDeals.length} Deal{overdueDeals.length === 1 ? "" : "s"}</span> — Overdue Follow-up
                                            </span>
                                        </div>
                                    )}
                                    {prediction && (
                                        <div className="flex items-center gap-2 text-xs text-gray-300">
                                            <TrendingUp size={13} className="text-green-400 shrink-0" />
                                            <span>
                                                Pipeline may reach <span className="text-white font-semibold">₹{prediction.projectedLakh.toFixed(1)}L</span> this month
                                            </span>
                                        </div>
                                    )}
                                    <button
                                        onClick={() =>
                                            navigate("/app/campaign-automation", { state: { openCreateAutomation: true } })
                                        }
                                        className="flex items-center gap-2 text-xs text-orange-400 hover:text-orange-300 transition"
                                    >
                                        <Rocket size={13} className="shrink-0" />
                                        <span className="font-semibold">Launch a New Campaign</span>
                                    </button>
                                </div>

                                {/* 3. Predictive insight */}
                                {prediction && (
                                    <div className="bg-black border border-orange-600/20 rounded-xl p-3.5">
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Predictive Insight</p>
                                        <div className="flex items-end justify-between mt-1.5">
                                            <div>
                                                <p className="text-[11px] text-gray-500">Expected Pipeline Value</p>
                                                <p className="text-lg font-bold text-white">₹{prediction.projectedLakh.toFixed(1)}L</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[11px] text-gray-500">Confidence</p>
                                                <p className="text-sm font-bold text-orange-400">{prediction.confidence}%</p>
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-gray-600 mt-1.5">
                                            Based on recent deal-value trend — a simple projection, not a guarantee.
                                        </p>
                                    </div>
                                )}

                                {/* 4. Opportunity alert */}
                                {topOpportunity && (
                                    <div className="bg-black border border-green-600/20 rounded-xl p-3.5">
                                        <p className="text-xs font-bold text-green-400 uppercase tracking-wide flex items-center gap-1.5">
                                            <Radar size={13} /> Opportunity
                                        </p>
                                        <p className="text-sm font-semibold text-white mt-1.5">{topOpportunity.name}</p>
                                        <div className="flex items-center gap-4 mt-1">
                                            <p className="text-[11px] text-gray-500">
                                                Lead Score <span className="text-white font-bold">{topOpportunity.score}</span>
                                            </p>
                                        </div>
                                        {aiCopy?.opportunityRecommendation ? (
                                            <p className="text-xs text-green-400 mt-1.5 font-semibold">
                                                Recommended: {aiCopy.opportunityRecommendation}
                                            </p>
                                        ) : (
                                            <p className="text-xs text-green-400 mt-1.5 font-semibold">
                                                Recommended: {topOpportunity.action}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* 5. Risk alert */}
                                {topRisk && (
                                    <div className="bg-black border border-red-600/20 rounded-xl p-3.5">
                                        <p className="text-xs font-bold text-red-400 uppercase tracking-wide flex items-center gap-1.5">
                                            <ShieldAlert size={13} /> Risk Alert
                                        </p>
                                        <p className="text-sm font-semibold text-white mt-1.5">{topRisk.company}</p>
                                        <p className="text-[11px] text-gray-500 mt-0.5">
                                            Risk: <span className="text-red-400 font-semibold">{topRisk.level}</span>
                                        </p>
                                        <p className="text-xs text-gray-400 mt-1">
                                            <span className="text-gray-500 font-semibold">Reason: </span>
                                            {topRisk.daysOverdue} day{topRisk.daysOverdue === 1 ? "" : "s"} past its closing date
                                        </p>
                                        <p className="text-xs text-red-400 mt-1 font-semibold">
                                            Recommendation: {aiCopy?.riskRecommendation || "Call Customer"}
                                        </p>
                                    </div>
                                )}

                                {/* 6. Marketing suggestion — based on real per-source conversion rates */}
                                {sourcePerformance && (
                                    <div className="bg-black border border-orange-600/20 rounded-xl p-3.5">
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                                            <Megaphone size={13} className="text-orange-400" /> Marketing Suggestion
                                        </p>
                                        <div className="flex items-center justify-between mt-1.5 text-xs">
                                            <span className="text-gray-400">
                                                {sourcePerformance.worst.name} <TrendingDown size={11} className="inline text-red-400 mx-0.5" />
                                                {sourcePerformance.worst.rate}%
                                            </span>
                                            <span className="text-gray-400">
                                                {sourcePerformance.best.name} <TrendingUp size={11} className="inline text-green-400 mx-0.5" />
                                                {sourcePerformance.best.rate}%
                                            </span>
                                        </div>
                                        <p className="text-xs text-orange-400 mt-1.5 font-semibold">
                                            {aiCopy?.marketingRecommendation ||
                                                `Shift more follow-up time toward ${sourcePerformance.best.name}.`}
                                        </p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    <button
                        onClick={() => navigate("/app/ai-assistant")}
                        className="shrink-0 mt-4 w-full border border-orange-500 text-orange-500 rounded-lg py-2.5 text-sm font-semibold hover:bg-orange-500 hover:text-white transition"
                    >
                        Continue in AI Assistant
                    </button>
                </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-black border border-orange-600/30 rounded-2xl p-4 sm:p-5 mt-5 shrink-0">
                <h3 className="text-sm font-bold text-white mb-3">Quick Actions</h3>
                <div className="flex flex-wrap gap-3">
                    {quickActions.map((action, index) => {
                        const Icon = action.icon;
                        return (
                            <button
                                key={index}
                                onClick={() => navigate(action.path, action.state ? { state: action.state } : undefined)}
                                className="flex items-center gap-2 border border-white/10 bg-white/5 text-gray-300 px-4 py-2.5 rounded-lg text-sm hover:border-orange-600/40 hover:text-white transition"
                            >
                                <Icon size={14} className="text-orange-500" />
                                {action.label}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default DashboardPreviewSection;