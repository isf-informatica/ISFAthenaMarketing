import React, { useState, useMemo, useEffect } from "react";
import { useCustomerData } from "./CustomerDataContext";
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import {
    Search,
    ChevronDown,
    Download,
    IndianRupee,
    Wallet,
    TrendingUp,
    Percent,
    Sparkles,
    AlertCircle,
    CheckCircle2,
    Check,
} from "lucide-react";

/* ==========================================================
   DUMMY DATA — swap for live account data once the backend
   endpoint is wired up. Shape stays flat so this is a
   drop-in replacement later.
========================================================== */
// Revenue, Marketing Spend, ROI and Conversion are all computed live now —
// see closedWonRevenue, totalMarketingSpend, and the kpis useMemo below.

// ₹ formatter matching Sales Pipeline's "₹X.XL" style (lakhs, 1 decimal).
const formatCurrency = (num) => {
    const n = Number(num) || 0;
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    return `₹${n.toLocaleString("en-IN")}`;
};

// Revenue Trend is now computed live from isfathena.deals — see
// revenueTrendData below.

// Color per lead_source value — matches the options used in Lead
// Management's "Source" field (see Campaign_Automation/Lead_Management's
// CHANNEL_OPTIONS-style source list). "Not specified" covers leads saved
// without a source (e.g. rows added before this field existed).
const sourceColorMap = {
    Website: "#f97316",
    WhatsApp: "#22c55e",
    Facebook: "#818cf8",
    "Google Ads": "#f59e0b",
    Referral: "#ec4899",
    LinkedIn: "#0ea5e9",
    Instagram: "#e879f9",
    "Email Campaign": "#facc15",
    "Not specified": "#64748b",
};

// Same 5 stages used in Sales Pipeline — the funnel below reads real
// counts per stage from the same isfathena.deals table that page writes to.
const FUNNEL_STAGES = ["New Leads", "Qualified", "Proposal", "Negotiation", "Closed Won"];

const API_BASE_URL = "http://localhost:8000";
const DEALS_ENDPOINT = `${API_BASE_URL}/deals`;
const AUTOMATIONS_ENDPOINT = `${API_BASE_URL}/automations`;

// AI Analytics panel now generates its reasons/actions live from real
// leads/deals/automations data — see aiInsights useMemo inside the component.

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
   ANALYTICS & BI (id="sec-analytics-bi")
   Fit-screen dashboard: KPI row, three-chart row (revenue
   trend / lead source / lead funnel), then channel table +
   AI Analytics panel side by side.
========================================================== */
const AnalyticsBI = () => {
    const [applied, setApplied] = useState(false);
    const { leads, leadsLoading } = useCustomerData();

    // Groups real leads by their `lead_source` field (isfathena.lead_generation,
    // via growthos_backend) into percentages for the pie chart + legend.
    const leadSources = useMemo(() => {
        if (!leads.length) return [];
        const counts = {};
        leads.forEach((l) => {
            const key = l.lead_source && l.lead_source.trim() ? l.lead_source.trim() : "Not specified";
            counts[key] = (counts[key] || 0) + 1;
        });
        const total = leads.length;
        return Object.entries(counts)
            .map(([name, count]) => ({
                name,
                count,
                value: Math.round((count / total) * 100),
                color: sourceColorMap[name] || "#64748b",
            }))
            .sort((a, b) => b.count - a.count);
    }, [leads]);

    // Channel Performance table — Channel + Leads + Conversion are real,
    // grouped by lead_source the same way as the pie chart above. Spend
    // and ROI are NOT computable: there's no ad-spend/budget table
    // anywhere in the schema (not in lead_generation, not in
    // campaign_automations), so they're shown as honestly untracked
    // instead of a made-up number.
    const channelPerformance = useMemo(() => {
        if (!leads.length) return [];
        const groups = {};
        leads.forEach((l) => {
            const key = l.lead_source && l.lead_source.trim() ? l.lead_source.trim() : "Not specified";
            if (!groups[key]) groups[key] = { total: 0, converted: 0 };
            groups[key].total += 1;
            if (l.current_status === "Success") groups[key].converted += 1;
        });
        return Object.entries(groups)
            .map(([channel, g]) => ({
                channel,
                leads: g.total,
                conversion: g.total > 0 ? `${((g.converted / g.total) * 100).toFixed(1)}%` : "0.0%",
            }))
            .sort((a, b) => b.leads - a.leads);
    }, [leads]);

    // Lead Funnel — "Total Leads" comes from isfathena.lead_generation
    // (same source as Lead Management), the 5 stage counts come from
    // isfathena.deals (same source as Sales Pipeline).
    const [deals, setDeals] = useState([]);
    const [dealsLoading, setDealsLoading] = useState(true);

    useEffect(() => {
        const fetchDeals = async () => {
            setDealsLoading(true);
            try {
                const res = await fetch(DEALS_ENDPOINT, { method: "GET" });
                const resp = await res.json();
                if (res.ok && resp.success && Array.isArray(resp.data)) {
                    setDeals(resp.data);
                } else {
                    setDeals([]);
                }
            } catch (err) {
                setDeals([]);
            } finally {
                setDealsLoading(false);
            }
        };
        fetchDeals();
    }, []);

    // Marketing Spend card — sum of the `budget` field across every workflow
    // in isfathena.campaign_automations (same table/endpoint Campaign
    // Automation itself reads/writes).
    const [automations, setAutomations] = useState([]);
    const [automationsLoading, setAutomationsLoading] = useState(true);

    useEffect(() => {
        const fetchAutomations = async () => {
            setAutomationsLoading(true);
            try {
                const res = await fetch(AUTOMATIONS_ENDPOINT, { method: "GET" });
                const resp = await res.json();
                if (res.ok && resp.success && Array.isArray(resp.data)) {
                    setAutomations(resp.data);
                } else {
                    setAutomations([]);
                }
            } catch (err) {
                setAutomations([]);
            } finally {
                setAutomationsLoading(false);
            }
        };
        fetchAutomations();
    }, []);

    // Kept separate from the chart data on purpose — Total Leads counts
    // people (lead_generation), the 5 stages count deals (deals table).
    // Mixing them into one bar chart badly skews the scale since Total
    // Leads is a different, usually much larger, unit.
    const funnelChartData = useMemo(() => {
        const totalLeadsCount = leads.length;
        return FUNNEL_STAGES.map((stage) => {
            const count = deals.filter((d) => d.stage === stage).length;
            const pct = totalLeadsCount > 0 ? ((count / totalLeadsCount) * 100).toFixed(1) : "0.0";
            return {
                stage,
                value: count,
                display: `${count.toLocaleString("en-IN")} (${pct}%)`,
            };
        });
    }, [leads, deals]);

    const leadFunnel = useMemo(() => {
        const totalLeadsCount = leads.length;
        return [
            { stage: "Total Leads", value: totalLeadsCount, display: totalLeadsCount.toLocaleString("en-IN") },
            ...funnelChartData,
        ];
    }, [leads, funnelChartData]);

    const funnelLoading = leadsLoading || dealsLoading;

    // Revenue card — sum of deal_value for every deal in isfathena.deals
    // whose stage is "Closed Won" (same field/value Sales Pipeline uses).
    const { closedWonRevenue, closedWonCount } = useMemo(() => {
        const won = deals.filter((d) => d.stage === "Closed Won");
        return {
            closedWonRevenue: won.reduce((sum, d) => sum + (Number(d.deal_value) || 0), 0),
            closedWonCount: won.length,
        };
    }, [deals]);

    const totalMarketingSpend = useMemo(
        () => automations.reduce((sum, a) => sum + (Number(a.budget) || 0), 0),
        [automations]
    );

    // ROI — Closed Won revenue ÷ Marketing Spend, as a multiplier (e.g. 5.7x).
    // Undefined (not zero) when nothing's been spent yet, since revenue over
    // zero spend isn't a meaningful ratio — shown as "—" instead of "∞".
    const roiMultiplier = totalMarketingSpend > 0 ? closedWonRevenue / totalMarketingSpend : null;

    // Overall Conversion — % of total leads that became a Closed Won deal.
    // Deliberately NOT based on leads.current_status: that field has no
    // reliable "won" concept, only isfathena.deals does (stage/is_won).
    // Reuses the same closedWonCount already computed for the Revenue card.
    const conversionRate = leads.length > 0 ? (closedWonCount / leads.length) * 100 : 0;

    const analyticsLoading = dealsLoading || automationsLoading;

    // Revenue Trend — Closed Won deals grouped by month, using won_at (the
    // real timestamp the backend stamps the moment a deal's stage becomes
    // "Closed Won" — see update_deal_stage / insert_local_deal in main.py).
    // NOT closing_date, which is just the target/expected close date typed
    // into the form and can be in the past or future relative to when the
    // deal actually closed.
    const revenueTrendAllMonths = useMemo(() => {
        const wonDeals = deals.filter((d) => d.stage === "Closed Won");
        if (!wonDeals.length) return [];
        const byMonth = {};
        wonDeals.forEach((d) => {
            const raw = d.won_at || d.closing_date || d.created_at;
            const dt = raw ? new Date(raw) : null;
            if (!dt || isNaN(dt.getTime())) return;
            const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
            if (!byMonth[key]) byMonth[key] = { sortKey: key, date: dt, year: dt.getFullYear(), month: dt.getMonth(), total: 0 };
            byMonth[key].total += Number(d.deal_value) || 0;
        });
        return Object.values(byMonth)
            .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
            .map((m) => ({
                date: m.date.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
                year: m.year,
                month: m.month, // 0 = Jan ... 11 = Dec
                monthName: m.date.toLocaleDateString("en-IN", { month: "long" }),
                revenue: Math.round((m.total / 100000) * 100) / 100,
            }));
    }, [deals]);

    // Years that actually have Closed Won revenue, newest first — populates
    // the Year dropdown. "All" is always available as the default view.
    const revenueTrendYears = useMemo(() => {
        const years = new Set(revenueTrendAllMonths.map((m) => m.year));
        return Array.from(years).sort((a, b) => b - a);
    }, [revenueTrendAllMonths]);

    const [revenueYearFilter, setRevenueYearFilter] = useState("all");
    const [revenueMonthFilter, setRevenueMonthFilter] = useState("all");

    // Month dropdown options depend on the current Year selection — only
    // months that actually have data (within that year, or across all years
    // when Year = "All") show up, same rule as the Year dropdown.
    const revenueTrendMonthOptions = useMemo(() => {
        const scoped =
            revenueYearFilter === "all"
                ? revenueTrendAllMonths
                : revenueTrendAllMonths.filter((m) => String(m.year) === revenueYearFilter);
        const seen = new Map();
        scoped.forEach((m) => seen.set(m.month, m.monthName));
        return Array.from(seen.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([month, monthName]) => ({ month, monthName }));
    }, [revenueTrendAllMonths, revenueYearFilter]);

    // Changing Year can invalidate the current Month pick (e.g. that month
    // has no data in the newly picked year) — reset it back to "All" then.
    const handleYearFilterChange = (value) => {
        setRevenueYearFilter(value);
        setRevenueMonthFilter("all");
    };

    const revenueTrendData = useMemo(() => {
        return revenueTrendAllMonths.filter((m) => {
            const yearOk = revenueYearFilter === "all" || String(m.year) === revenueYearFilter;
            const monthOk = revenueMonthFilter === "all" || String(m.month) === revenueMonthFilter;
            return yearOk && monthOk;
        });
    }, [revenueTrendAllMonths, revenueYearFilter, revenueMonthFilter]);

    // AI Analytics panel — rule-based, generated live from the same real
    // data already computed above (no external AI call). Each check only
    // adds a reason/action when the underlying numbers actually indicate
    // something worth flagging, so the panel can legitimately come back
    // empty when the pipeline looks healthy — it doesn't force a narrative.
    const aiInsights = useMemo(() => {
        const reasons = [];
        const actions = [];

        // 1. Month-over-month revenue movement (Closed Won deals only,
        // unfiltered by the Revenue Trend card's own year/month picker)
        if (revenueTrendAllMonths.length >= 2) {
            const last = revenueTrendAllMonths[revenueTrendAllMonths.length - 1];
            const prev = revenueTrendAllMonths[revenueTrendAllMonths.length - 2];
            if (prev.revenue > 0) {
                const change = ((last.revenue - prev.revenue) / prev.revenue) * 100;
                if (change <= -5) {
                    reasons.push(`Revenue fell ${Math.abs(change).toFixed(0)}% from ${prev.date} to ${last.date}`);
                    actions.push(`Compare deals closed in ${prev.date} vs ${last.date} to see what changed`);
                } else if (change >= 5) {
                    reasons.push(`Revenue grew ${change.toFixed(0)}% from ${prev.date} to ${last.date}`);
                }
            }
        }

        // 2. Deals past their expected closing_date and still not won
        const today = new Date();
        const overdueDeals = deals.filter((d) => {
            if (d.stage === "Closed Won" || !d.closing_date) return false;
            const cd = new Date(d.closing_date);
            return !isNaN(cd.getTime()) && cd < today;
        });
        if (overdueDeals.length > 0) {
            reasons.push(
                `${overdueDeals.length} deal${overdueDeals.length === 1 ? " is" : "s are"} past its expected closing date and still open`
            );
            actions.push(`Follow up on ${overdueDeals.length} overdue deal${overdueDeals.length === 1 ? "" : "s"}`);
        }

        // 3. Pipeline bottleneck — mid-funnel stage holding the most deals
        const bottleneck = ["Qualified", "Proposal", "Negotiation"]
            .map((stage) => ({ stage, count: deals.filter((d) => d.stage === stage).length }))
            .reduce((max, s) => (s.count > max.count ? s : max), { stage: null, count: 0 });
        if (bottleneck.count > 0) {
            reasons.push(`${bottleneck.count} deal${bottleneck.count === 1 ? " is" : "s are"} sitting in "${bottleneck.stage}"`);
            actions.push(`Review the ${bottleneck.count} deal${bottleneck.count === 1 ? "" : "s"} stuck in "${bottleneck.stage}" and push them forward`);
        }

        // 4. Weakest lead source — lowest conversion among sources with real volume
        const weakest = channelPerformance
            .filter((c) => c.leads >= 2)
            .map((c) => ({ ...c, conversionNum: parseFloat(c.conversion) }))
            .sort((a, b) => a.conversionNum - b.conversionNum)[0];
        if (weakest && weakest.conversionNum < 20) {
            reasons.push(`"${weakest.channel}" converts lowest at ${weakest.conversion} across ${weakest.leads} leads`);
            actions.push(`Investigate lead quality or follow-up speed for "${weakest.channel}"`);
        }

        // 5. ROI below break-even
        if (roiMultiplier !== null && roiMultiplier < 1) {
            reasons.push(`Marketing ROI is ${roiMultiplier.toFixed(1)}x — spend hasn't broken even yet`);
            actions.push(`Reassess budget across automations until ROI clears 1x`);
        }

        return { reasons, actions };
    }, [revenueTrendAllMonths, deals, channelPerformance, roiMultiplier]);

    const insightsLoading = dealsLoading || leadsLoading || automationsLoading;

    // No historical snapshot exists yet to compute a real period-over-period
    // trend, so every card shows a real count/basis instead of a made-up %.
    const kpis = useMemo(
        () => [
            {
                label: "Revenue",
                value: dealsLoading ? "…" : formatCurrency(closedWonRevenue),
                trend: dealsLoading ? "Loading…" : `${closedWonCount} deal${closedWonCount === 1 ? "" : "s"} won`,
                icon: IndianRupee,
            },
            {
                label: "Marketing Spend",
                value: automationsLoading ? "…" : formatCurrency(totalMarketingSpend),
                trend: automationsLoading
                    ? "Loading…"
                    : `Across ${automations.length} workflow${automations.length === 1 ? "" : "s"}`,
                icon: Wallet,
            },
            {
                label: "ROI",
                value: analyticsLoading ? "…" : roiMultiplier === null ? "—" : `${roiMultiplier.toFixed(1)}x`,
                trend: analyticsLoading
                    ? "Loading…"
                    : roiMultiplier === null
                    ? "No spend recorded yet"
                    : `${formatCurrency(closedWonRevenue)} ÷ ${formatCurrency(totalMarketingSpend)}`,
                icon: TrendingUp,
            },
            {
                label: "Conversion",
                value: leadsLoading ? "…" : `${conversionRate.toFixed(1)}%`,
                trend: leadsLoading ? "Loading…" : `${closedWonCount} won of ${leads.length} leads`,
                icon: Percent,
            },
        ],
        [
            dealsLoading,
            closedWonRevenue,
            closedWonCount,
            automationsLoading,
            totalMarketingSpend,
            automations.length,
            analyticsLoading,
            roiMultiplier,
            leadsLoading,
            conversionRate,
            leads.length,
        ]
    );

    return (
        <div id="sec-analytics-bi" className="h-full flex flex-col py-6 overflow-y-auto">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 w-full sm:w-64">
                    <Search size={14} className="text-gray-500 shrink-0" />
                    <input
                        type="text"
                        placeholder="Search Analytics Dashboard..."
                        className="bg-transparent outline-none text-xs text-white placeholder:text-gray-500 w-full"
                    />
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <button className="flex items-center gap-1.5 bg-white/5 border border-white/10 text-gray-300 text-xs px-3 py-2 rounded-lg hover:border-orange-600/40 transition">
                        Last 30 Days <ChevronDown size={13} />
                    </button>
                    <button className="flex items-center gap-1.5 bg-white/5 border border-white/10 text-gray-300 text-xs px-3 py-2 rounded-lg hover:border-orange-600/40 transition">
                        All Channels <ChevronDown size={13} />
                    </button>
                    <button className="flex items-center gap-1.5 bg-orange-500 text-white text-xs font-semibold px-3.5 py-2 rounded-lg hover:bg-orange-600 transition">
                        <Download size={13} />
                        Export Report
                    </button>
                </div>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-5 shrink-0">
                {kpis.map((kpi, index) => {
                    const Icon = kpi.icon;
                    return (
                        <div key={index} className="bg-black border border-orange-600/30 rounded-2xl p-4">
                            <div className="flex items-center justify-between">
                                <p className="text-gray-400 text-[11px] font-semibold uppercase tracking-wide">
                                    {kpi.label}
                                </p>
                                <Icon size={14} className="text-orange-500 shrink-0" />
                            </div>
                            <h3 className="text-xl sm:text-2xl font-bold text-white mt-2">{kpi.value}</h3>
                            <p className={`text-xs mt-1 ${kpi.trend.startsWith("+") ? "text-green-400" : "text-gray-500"}`}>
                                {kpi.trend.startsWith("+") ? `↑ ${kpi.trend}` : kpi.trend}
                            </p>
                        </div>
                    );
                })}
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-5 shrink-0">
                {/* Revenue Trend */}
                <div className="bg-black border border-orange-600/30 rounded-2xl p-4 h-64 flex flex-col">
                    <div className="flex items-center justify-between shrink-0 gap-2">
                        <h3 className="text-sm font-bold text-white">Revenue Trend</h3>
                        {revenueTrendYears.length > 0 && (
                            <div className="flex items-center gap-1.5">
                                <select
                                    value={revenueMonthFilter}
                                    onChange={(e) => setRevenueMonthFilter(e.target.value)}
                                    className="bg-white/5 border border-white/10 text-gray-300 text-[11px] rounded-lg px-2 py-1 outline-none focus:border-orange-600/50 transition cursor-pointer"
                                >
                                    <option value="all" className="bg-[#0a0a0a]">All Months</option>
                                    {revenueTrendMonthOptions.map(({ month, monthName }) => (
                                        <option key={month} value={String(month)} className="bg-[#0a0a0a]">
                                            {monthName}
                                        </option>
                                    ))}
                                </select>
                                <select
                                    value={revenueYearFilter}
                                    onChange={(e) => handleYearFilterChange(e.target.value)}
                                    className="bg-white/5 border border-white/10 text-gray-300 text-[11px] rounded-lg px-2 py-1 outline-none focus:border-orange-600/50 transition cursor-pointer"
                                >
                                    <option value="all" className="bg-[#0a0a0a]">All Years</option>
                                    {revenueTrendYears.map((y) => (
                                        <option key={y} value={String(y)} className="bg-[#0a0a0a]">
                                            {y}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                    {dealsLoading ? (
                        <div className="flex-1 flex items-center justify-center text-gray-500 text-xs">Loading...</div>
                    ) : revenueTrendData.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-gray-500 text-xs text-center px-4">
                            No Closed Won deals yet — revenue trend will appear here once deals close.
                        </div>
                    ) : (
                        <div className="flex-1 min-h-0 mt-2">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={revenueTrendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="analyticsRevenueFill" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0%" stopColor="#f97316" stopOpacity={0.35} />
                                            <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid stroke="#f97316" strokeOpacity={0.12} strokeDasharray="4 4" vertical={false} />
                                    <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={{ stroke: "#f9731633" }} tickLine={false} />
                                    <YAxis tickFormatter={(v) => `${v}L`} tick={{ fill: "#6b7280", fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
                                    <Tooltip content={<RevenueTooltip />} />
                                    <Area
                                        type="monotone"
                                        dataKey="revenue"
                                        stroke="#f97316"
                                        strokeWidth={2.5}
                                        fill="url(#analyticsRevenueFill)"
                                        dot={{ r: 3, fill: "#f97316", stroke: "#000000", strokeWidth: 1.5 }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>

                {/* Lead Source Performance */}
                <div className="bg-black border border-orange-600/30 rounded-2xl p-4 h-64 flex flex-col">
                    <h3 className="text-sm font-bold text-white shrink-0">Lead Source Performance</h3>
                    {leadsLoading ? (
                        <div className="flex-1 flex items-center justify-center text-gray-500 text-xs">Loading leads...</div>
                    ) : leadSources.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-gray-500 text-xs text-center px-4">
                            No leads yet — add some in Lead Management to see source breakdown.
                        </div>
                    ) : (
                        <div className="flex-1 min-h-0 flex items-center gap-2">
                            <div className="w-1/2 h-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={leadSources}
                                            dataKey="value"
                                            nameKey="name"
                                            innerRadius={32}
                                            outerRadius={55}
                                            paddingAngle={2}
                                        >
                                            {leadSources.map((entry, index) => (
                                                <Cell key={index} fill={entry.color} stroke="#000000" strokeWidth={1} />
                                            ))}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="w-1/2 space-y-1.5 overflow-y-auto max-h-full">
                                {leadSources.map((s, index) => (
                                    <div key={index} className="flex items-center gap-1.5 text-[11px] text-gray-300">
                                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                                        {s.name} {s.value}% <span className="text-gray-500">({s.count})</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Lead Funnel */}
                <div className="bg-black border border-orange-600/30 rounded-2xl p-4 h-64 flex flex-col">
                    <h3 className="text-sm font-bold text-white shrink-0">Lead Funnel</h3>
                    {funnelLoading ? (
                        <div className="flex-1 flex items-center justify-center text-gray-500 text-xs">Loading...</div>
                    ) : (
                        <>
                            <div className="flex-1 min-h-0 mt-2">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={funnelChartData} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 4 }} barCategoryGap="18%">
                                        <XAxis type="number" hide />
                                        <YAxis
                                            type="category"
                                            dataKey="stage"
                                            interval={0}
                                            tick={{ fill: "#9ca3af", fontSize: 10 }}
                                            axisLine={false}
                                            tickLine={false}
                                            width={66}
                                        />
                                        <Bar dataKey="value" fill="#f97316" radius={[0, 6, 6, 0]} barSize={12} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="space-y-0.5 mt-1 shrink-0">
                                {leadFunnel.map((f, index) => (
                                    <p key={index} className="text-[10px] text-gray-500 flex justify-between">
                                        <span>{f.stage}</span>
                                        <span className="text-gray-300">{f.display}</span>
                                    </p>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Channel table + AI Analytics */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-5 flex-1 min-h-0">
                {/* Channel performance table */}
                <div className="lg:col-span-2 bg-black border border-orange-600/30 rounded-2xl overflow-hidden flex flex-col min-h-0">
                    <h3 className="text-sm font-bold text-white p-4 pb-0 shrink-0">Channel Performance</h3>
                    <div className="overflow-auto mt-3">
                        <table className="w-full text-sm text-left border-collapse">
                            <thead>
                                <tr className="border-b border-orange-600/20 text-gray-500 text-[11px] uppercase tracking-wide">
                                    <th className="px-4 py-3 font-semibold">Channel</th>
                                    <th className="px-4 py-3 font-semibold">Leads</th>
                                    <th className="px-4 py-3 font-semibold" title="No ad-spend tracking table exists yet">
                                        Spend
                                    </th>
                                    <th className="px-4 py-3 font-semibold">Conversion</th>
                                    <th className="px-4 py-3 font-semibold" title="Needs Spend to be tracked first">
                                        ROI
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {leadsLoading && (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500">Loading...</td>
                                    </tr>
                                )}
                                {!leadsLoading && channelPerformance.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-4 py-8 text-center text-gray-500">No leads yet.</td>
                                    </tr>
                                )}
                                {!leadsLoading && channelPerformance.map((c, index) => (
                                    <tr key={index} className="border-b border-white/5 last:border-b-0 hover:bg-white/5 transition">
                                        <td className="px-4 py-3 text-white font-medium">{c.channel}</td>
                                        <td className="px-4 py-3 text-gray-300">{c.leads}</td>
                                        <td className="px-4 py-3 text-gray-600 italic">Not tracked</td>
                                        <td className="px-4 py-3 text-gray-300">{c.conversion}</td>
                                        <td className="px-4 py-3 text-gray-600 italic">Not tracked</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* AI Analytics */}
                <div className="bg-black border border-orange-600/30 rounded-2xl p-4 flex flex-col min-h-0">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2 shrink-0">
                        AI Analytics <Sparkles size={15} className="text-orange-500" />
                    </h3>

                    <div className="mt-3 overflow-y-auto min-h-0 flex-1 space-y-4">
                        {insightsLoading ? (
                            <p className="text-gray-500 text-xs">Analyzing your pipeline...</p>
                        ) : (
                            <>
                                <div>
                                    <p className="text-white text-sm font-semibold">
                                        {aiInsights.reasons.length > 0 ? "What's affecting your pipeline" : "Pipeline looks healthy"}
                                    </p>
                                    {aiInsights.reasons.length === 0 ? (
                                        <p className="text-gray-400 text-xs mt-1">
                                            No issues detected in current deals, leads, or spend data.
                                        </p>
                                    ) : (
                                        <div className="space-y-1.5 mt-2">
                                            {aiInsights.reasons.map((reason, index) => (
                                                <div key={index} className="flex items-start gap-2 text-xs text-gray-300">
                                                    <AlertCircle size={13} className="text-orange-500 mt-0.5 shrink-0" />
                                                    {reason}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                {aiInsights.actions.length > 0 && (
                                    <div>
                                        <p className="text-white text-sm font-semibold">Recommended Actions</p>
                                        <div className="space-y-1.5 mt-2">
                                            {aiInsights.actions.map((action, index) => (
                                                <div key={index} className="flex items-start gap-2 text-xs text-gray-300">
                                                    <span className="h-4 w-4 rounded-full bg-orange-500/15 border border-orange-600/30 text-orange-400 text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                                                        {index + 1}
                                                    </span>
                                                    {action}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {aiInsights.actions.length > 0 && (
                        <button
                            onClick={() => setApplied(true)}
                            disabled={applied}
                            className={`shrink-0 mt-4 w-full rounded-lg py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2 ${
                                applied
                                    ? "bg-green-500/10 text-green-400 border border-green-600/30 cursor-default"
                                    : "border border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white"
                            }`}
                        >
                            {applied ? (
                                <>
                                    <Check size={15} />
                                    Marked as Reviewed
                                </>
                            ) : (
                                "Mark as Reviewed"
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AnalyticsBI;