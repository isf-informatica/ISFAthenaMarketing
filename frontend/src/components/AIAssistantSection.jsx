import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    Sparkles,
    Send,
    Loader2,
    Megaphone,
    BarChart3,
    Check,
    AlertTriangle,
    ChevronRight,
    ChevronDown,
    Lock,
    Flame,
    Target,
    Circle,
    CheckCircle2,
    Pencil,
    UserRound,
    Headphones,
    Compass,
    Bot,
    Clock,
    Activity,
    ShieldCheck,
} from "lucide-react";
import { useCustomerData } from "./CustomerDataContext";
import { GROQ_API_KEY, GROQ_MODEL } from "./groqConfig";

/* ==========================================================
   GROWTHOS COPILOT (id="sec-ai-assistant")

   Not a generic chatbot — this recognizes a few real commands
   ("show hot leads", "send follow-up to all") and answers them
   with REAL data from CustomerDataContext (never AI-invented
   names/scores/costs). Everything else still goes to Groq as
   free-form chat, same as before.

   Human Approval Mode is mandatory, not optional: a bulk
   follow-up request only ever DRAFTS messages and shows them
   for review. Nothing sends until the person clicks
   "Approve & Send" — matching AI Suggests -> User Reviews ->
   User Approves -> System Executes. "Autonomous Mode" (skip
   review) is shown as a locked Pro-plan toggle, not built yet.
========================================================== */

const API_BASE_URL = "http://localhost:8000";

const authHeaders = () => {
    const token = localStorage.getItem("growthos_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
};
const SEND_EMAIL_ENDPOINT = `${API_BASE_URL}/send-email`;
const markContactedEndpoint = (leadId) => `${API_BASE_URL}/leads/${leadId}/mark-contacted`;

// Same heuristic used in Lead_Management.jsx / DashboardPreviewSection.jsx —
// duplicated locally so this page doesn't depend on those files directly.
// NOT a real AI model — deterministic placeholder until a real scoring
// pipeline exists.
// Prefers the REAL ai_score column (main.py's compute_ai_score, same value
// Lead Management shows) — only falls back to this rough heuristic if a
// lead somehow has no ai_score stored yet.
const computeLeadScore = (lead) => {
    if (lead.ai_score !== null && lead.ai_score !== undefined) return Number(lead.ai_score);
    const statusWeights = { Success: 88, "Phone Contacted": 74, "Mail Send": 58, Open: 44, Closed: 28 };
    const base = statusWeights[lead.current_status] ?? 50;
    const jitter = (Number(lead.id) || 0) % 10;
    return Math.min(99, base + jitter);
};

const recommendedAction = (lead) => {
    if (!lead.is_contacted) return lead.user_email ? "Email now" : "Call now";
    if (lead.current_status === "Success") return "Onboard";
    return "Follow up again";
};

const followUpMessage = (name) =>
    `Hi ${name},\n\nJust checking in — wanted to see if you had any questions about GrowthOS AI after your last visit.\nHappy to walk you through a quick demo whenever suits you.\n\nBest,\nGrowthOS AI Team`;

const EMAIL_SUBJECT = "Following up — GrowthOS AI";

// Safety Layer: hard cap on how many emails one approval can send in a
// single batch. Real, enforced limit (used below) — not decorative.
const BATCH_CAP = 20;

// How many prior chat turns are replayed into every Groq call. Shown in
// the Safety & Memory strip so the "short-term memory" claim is honest
// and matches what callGroq() actually does (see history.slice below).
const MEMORY_WINDOW = 10;

const chipColors = {
    orange: "bg-orange-500/15 border-orange-500/30 text-orange-400",
    blue: "bg-blue-500/15 border-blue-500/30 text-blue-400",
    green: "bg-green-500/15 border-green-500/30 text-green-400",
    purple: "bg-purple-500/15 border-purple-500/30 text-purple-400",
    rose: "bg-rose-500/15 border-rose-500/30 text-rose-400",
};

const Chip = ({ color, icon: Icon, size = 14 }) => (
    <div className={`h-7 w-7 rounded-lg border flex items-center justify-center shrink-0 ${chipColors[color]}`}>
        <Icon size={size} />
    </div>
);

const SUGGESTED_PROMPTS = [
    "Show hot leads",
    "Send follow-up to all",
    "Why did revenue drop?",
    "Deals likely to close this week",
    "Forecast this month revenue",
    "Best performing channels",
];

// Only "Increase Sales" is wired to real data + real execution right now
// (hot leads, follow-ups due, lead_source performance, actual sends via
// the backend). The rest are shown as an honest roadmap, not faked —
// they need data this app doesn't track yet (churn signals, inactivity
// windows, campaign infra).
const GOALS = [
    { label: "Increase Sales", enabled: true },
    { label: "Generate More Leads", enabled: false },
    { label: "Recover Inactive Customers", enabled: false },
    { label: "Reduce Churn", enabled: false },
];

// Multi-Agent Collaboration System. Each agent is grounded in whatever
// REAL data actually exists for its domain — leads, deals, automations.
// Sales/Marketing/Analytics map cleanly onto real tables. Support and
// Strategy are adapted: there's no support-ticket table or budget/
// competitor tracking anywhere in the schema, so those two work off the
// closest real proxy available (lead comments, pipeline/conversion
// numbers) rather than faking a ticket system or budget data.
const AGENTS = [
    {
        id: "sales",
        label: "AI Sales Assistant",
        icon: UserRound,
        color: "orange",
        description: "Predicts which deals close soonest, drafts a follow-up email",
    },
    {
        id: "marketing",
        label: "AI Marketing Engine",
        icon: Megaphone,
        color: "purple",
        description: "Finds your best channel, drafts a real campaign message",
    },
    {
        id: "support",
        label: "AI Support Agent",
        icon: Headphones,
        color: "blue",
        description: "Flags leads with open comments/questions needing a reply",
    },
    {
        id: "strategy",
        label: "AI Strategy Layer",
        icon: Compass,
        color: "green",
        description: "Growth priorities from real pipeline & conversion data",
    },
    {
        id: "analytics",
        label: "AI Analytics",
        icon: BarChart3,
        color: "rose",
        description: 'Answers "why did sales drop?", "which channel is best?"',
    },
];

const initials = (name) =>
    (name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

const DEALS_ENDPOINT = `${API_BASE_URL}/deals`;
const AUTOMATIONS_ENDPOINT = `${API_BASE_URL}/automations`;

const AIAssistantSection = () => {
    const navigate = useNavigate();
    const { leads, fetchLeads } = useCustomerData();

    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef(null);

    // Full project context — fetched once on mount, refreshed after any
    // data-changing action (bulk send, goal execution) so the AI always
    // answers from CURRENT real numbers instead of guessing or only
    // knowing about leads.
    const [deals, setDeals] = useState([]);
    const [automations, setAutomations] = useState([]);

    const fetchProjectContext = async () => {
        try {
            const [dealsRes, autoRes] = await Promise.all([
                fetch(DEALS_ENDPOINT, { method: "GET" }),
                fetch(AUTOMATIONS_ENDPOINT, { method: "GET" }),
            ]);
            const dealsJson = await dealsRes.json().catch(() => null);
            const autoJson = await autoRes.json().catch(() => null);
            setDeals(dealsRes.ok && dealsJson?.success && Array.isArray(dealsJson.data) ? dealsJson.data : []);
            setAutomations(autoRes.ok && autoJson?.success && Array.isArray(autoJson.data) ? autoJson.data : []);
        } catch (err) {
            setDeals([]);
            setAutomations([]);
        }
    };

    useEffect(() => {
        fetchProjectContext();
    }, []);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages, isLoading]);

    const isGroqConfigured =
        Boolean(GROQ_API_KEY) && GROQ_API_KEY !== "PASTE_YOUR_GROQ_API_KEY_HERE";

    // Builds a compact, REAL summary of everything currently in the
    // database — leads, deals, automations — so every Groq call (not just
    // the two special commands) is grounded in the actual project state.
    const buildProjectContext = () => {
        const hot = leads.filter((l) => computeLeadScore(l) >= 80).length;
        const due = leads.filter((l) => !l.is_contacted).length;
        const converted = leads.filter((l) => l.current_status === "Success").length;

        const wonDeals = deals.filter((d) => d.is_won);
        const openDeals = deals.filter((d) => !d.is_won);
        const pipelineValue = deals.reduce((s, d) => s + (Number(d.deal_value) || 0), 0);
        const stageCounts = {};
        deals.forEach((d) => {
            stageCounts[d.stage] = (stageCounts[d.stage] || 0) + 1;
        });
        const stageLine = Object.entries(stageCounts).map(([s, c]) => `${s}: ${c}`).join(", ") || "no deals yet";

        const runningAutomations = automations.filter((a) => a.status === "Running").length;
        const totalEnrolled = automations.reduce((s, a) => s + (Number(a.enrolled) || 0), 0);
        const totalCompleted = automations.reduce((s, a) => s + (Number(a.completed) || 0), 0);

        return (
            `=== LIVE PROJECT DATA (isfathena database, current as of this message) ===\n` +
            `LEADS (lead_generation table): ${leads.length} total leads, ${hot} hot (AI score 80+), ` +
            `${due} not yet contacted, ${converted} converted (status=Success).\n` +
            `DEALS (deals table, Sales Pipeline): ${deals.length} total deals — ${openDeals.length} open, ${wonDeals.length} closed won. ` +
            `Pipeline value: ₹${(pipelineValue / 100000).toFixed(2)}L. By stage: ${stageLine}.\n` +
            `CAMPAIGN AUTOMATIONS: ${automations.length} total workflows, ${runningAutomations} running, ` +
            `${totalEnrolled} contacts enrolled overall, ${totalCompleted} completed overall.\n` +
            `=== END LIVE DATA — use ONLY these numbers, never invent different ones ===`
        );
    };

    const callGroq = async (prompt) => {
        // Real conversation memory — previous turns in THIS chat, so
        // follow-ups like "generate another one" or "I don't like this"
        // actually know what "this" refers to. Capped to the last 10 plain
        // text turns to keep the request small; structured cards (hot
        // leads table, goal plans, agent results) aren't replayable text,
        // so only kind:"text" messages are included.
        const history = messages
            .filter((m) => m.kind === "text")
            .slice(-MEMORY_WINDOW)
            .map((m) => ({ role: m.role, content: m.content }));

        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
            body: JSON.stringify({
                model: GROQ_MODEL,
                temperature: 0.7,
                max_tokens: 600,
                messages: [
                    {
                        role: "system",
                        content:
                            "You are GrowthOS Copilot, embedded in a CRM. Answer concisely in plain language, short paragraphs or bullets.\n\n" +
                            "You'll be given the project's real, current internal data below (lead counts, pipeline value, deal counts, etc.) — " +
                            "use it ONLY to answer questions about the business itself (e.g. \"why did sales drop\", \"how many hot leads\"). " +
                            "If something isn't in the data provided, say it isn't tracked yet rather than guessing or inventing a number.\n\n" +
                            "IMPORTANT — when asked to draft a message, email, or WhatsApp text meant to be SENT to a customer or lead: " +
                            "write clean, natural, FORMAL business content only. Never mention internal metrics in it — no lead counts, " +
                            "no pipeline value, no deal counts, no conversion rates. The customer should never see our internal numbers. " +
                            "Just write a normal, professional email/message focused on that person and the stated goal (e.g. booking a demo).\n\n" +
                            "If the person says they don't like a draft, asks for another one, or asks you to redo it, write a genuinely " +
                            "different version — vary the opening, structure, and phrasing, don't just repeat the same email again.\n\n" +
                            buildProjectContext(),
                    },
                    ...history,
                    { role: "user", content: prompt },
                ],
            }),
        });
        if (!res.ok) throw new Error(`Groq responded with ${res.status}`);
        const data = await res.json();
        return data?.choices?.[0]?.message?.content?.trim() || "I didn't get a usable reply — try rephrasing.";
    };

    const pushMessage = (msg) => setMessages((prev) => [...prev, msg]);
    const updateMessage = (id, patch) =>
        setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));

    // Action Log — a REAL, timestamped record of things this session
    // actually did (agent runs, goal plans, sends). Client-side only:
    // it resets on page reload since there's no actions table in the
    // backend yet to persist it. Shown honestly as "This session" below.
    const [actionLog, setActionLog] = useState([]);
    const pushLog = (text) =>
        setActionLog((prev) => [
            { id: crypto.randomUUID(), time: new Date(), text },
            ...prev,
        ].slice(0, 30));

    const hotLeads = () =>
        leads
            .map((l) => ({ ...l, score: computeLeadScore(l) }))
            .filter((l) => l.score >= 80)
            .sort((a, b) => b.score - a.score);

    const dueLeads = () => leads.filter((l) => !l.is_contacted);

    const [runningAgentId, setRunningAgentId] = useState(null);

    // Each agent gets its own real-data slice + framing, then the SAME
    // callGroq() used everywhere else (which already includes the full
    // live project context) answers as that specialist.
    const runAgent = async (agentId) => {
        const agent = AGENTS.find((a) => a.id === agentId);
        if (!agent || runningAgentId) return;
        setRunningAgentId(agentId);

        let instruction = "";
        if (agentId === "sales") {
            const topHot = hotLeads()[0];
            const soonToClose = deals
                .filter((d) => !d.is_won && (d.stage === "Negotiation" || d.stage === "Proposal") && d.closing_date)
                .sort((a, b) => new Date(a.closing_date) - new Date(b.closing_date))
                .slice(0, 5)
                .map((d) => `${d.contact_name} (${d.stage}, ₹${(Number(d.deal_value) / 100000).toFixed(1)}L, closing ${d.closing_date})`)
                .join("; ") || "none in Negotiation/Proposal with a closing date set";
            instruction =
                `Act as the AI Sales Agent. Real deals nearest to closing (Negotiation/Proposal stage, sorted by closing date): ${soonToClose}.\n` +
                `Using the live lead/deal data above plus this, do 3 things:\n` +
                `1. Predict which 2-3 deals are most likely to close soonest and why (based on stage + closing date only — say plainly you're not using any probability model).\n` +
                `2. List which hot leads to prioritize today.\n` +
                (topHot
                    ? `3. Draft a short, personalized follow-up email (3-4 sentences) for ${topHot.user_name}, the single hottest lead (score ${topHot.score}). Label it clearly as "Draft email for ${topHot.user_name}:".`
                    : `3. Note there are no hot leads to draft an email for right now.`);
        } else if (agentId === "marketing") {
            const sourceCounts = {};
            leads.forEach((l) => {
                const k = l.lead_source?.trim() || "Not specified";
                sourceCounts[k] = (sourceCounts[k] || 0) + 1;
            });
            const ranked = Object.entries(sourceCounts).sort((a, b) => b[1] - a[1]);
            const sourceLine = ranked.map(([s, c]) => `${s}: ${c}`).join(", ") || "no data";
            const bestChannel = ranked[0]?.[0] || "your top channel";
            instruction =
                `Act as the AI Marketing Engine. Real lead source breakdown: ${sourceLine}.\n` +
                `Do 3 things, based ONLY on this real data:\n` +
                `1. Name the best-performing channel (${bestChannel} has the most leads) and say why it's worth doubling down on.\n` +
                `2. Write one ready-to-send WhatsApp/email campaign message (4-5 sentences) aimed at generating more leads from ${bestChannel} specifically. Label it "Campaign draft:".\n` +
                `3. Suggest 2 more channel ideas worth testing next, from the ones with fewer leads.`;
        } else if (agentId === "support") {
            const withComments = leads.filter((l) => l.prospect_comment && l.prospect_comment.trim() && l.prospect_comment.trim().toLowerCase() !== "testing");
            const commentLines = withComments.slice(0, 8).map((l) => `${l.user_name}: "${l.prospect_comment}" (${l.is_contacted ? "already contacted" : "NOT yet contacted"})`).join("\n") || "No lead comments on file.";
            instruction =
                `Act as the AI Support Agent. There's no dedicated support-ticket system yet, so use each lead's saved comment as a proxy for an open question:\n${commentLines}\n\n` +
                `Say plainly that this is based on lead comments (not real tickets), then list which ones look most urgent to respond to and why. Short bullets.`;
        } else if (agentId === "strategy") {
            instruction =
                `Act as the AI Strategy Agent. There's no budget or competitor data tracked yet, so base this ONLY on the real pipeline/lead numbers above. ` +
                `Give 3 prioritized growth actions for this week, each tied to a specific real number from the data. Say plainly that budget/competitor analysis isn't available yet.`;
        } else if (agentId === "analytics") {
            instruction =
                `Act as the AI Analytics Agent. Analyze the live data above like a report: call out anything that looks like a problem (e.g. a lot of leads never contacted, ` +
                `low conversion, deals stuck in one stage), and suggest one fix for each. 4-5 short bullets.`;
        }

        pushMessage({ id: crypto.randomUUID(), role: "user", kind: "text", content: `Run ${agent.label}` });
        pushLog(`${agent.label} started`);
        try {
            const reply = await callGroq(instruction);
            pushMessage({ id: crypto.randomUUID(), role: "assistant", kind: "agent_result", agent, content: reply });
            pushLog(`${agent.label} finished — response ready`);
        } catch (err) {
            pushMessage({
                id: crypto.randomUUID(),
                role: "assistant",
                kind: "text",
                content: "Couldn't reach the AI right now — try again in a moment.",
                isError: true,
            });
            pushLog(`${agent.label} failed — couldn't reach AI`);
        } finally {
            setRunningAgentId(null);
        }
    };

    // Same lead_source grouping used on the Analytics BI page — reused
    // here so the plan's "best channel" claim is grounded in the same
    // real counts, not a separate guess.
    const bestChannel = () => {
        if (!leads.length) return null;
        const counts = {};
        leads.forEach((l) => {
            const key = l.lead_source?.trim() || "Not specified";
            counts[key] = (counts[key] || 0) + 1;
        });
        const [top] = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        return top ? { name: top[0], count: top[1] } : null;
    };

    // Live Agent Dashboard status — real counts per agent (not decorative).
    // Mirrors the doc's "AI Agents — Running / Idle" panel, but every
    // number here comes from actual state already in this component.
    const agentLiveStatus = (agentId) => {
        if (agentId === "sales") {
            const due = dueLeads().length;
            return due > 0 ? { label: "Follow-ups pending", value: due, active: true } : { label: "All caught up", value: null, active: false };
        }
        if (agentId === "marketing") {
            const running = automations.filter((a) => a.status === "Running").length;
            return running > 0
                ? { label: "Campaigns running", value: running, active: true }
                : { label: "No campaigns running", value: null, active: false };
        }
        if (agentId === "support") {
            const open = leads.filter((l) => l.prospect_comment && l.prospect_comment.trim() && l.prospect_comment.trim().toLowerCase() !== "testing").length;
            return open > 0 ? { label: "Open comments to review", value: open, active: true } : { label: "Nothing flagged", value: null, active: false };
        }
        if (agentId === "strategy") {
            const openDealsCount = deals.filter((d) => !d.is_won).length;
            return openDealsCount > 0 ? { label: "Open deals in pipeline", value: openDealsCount, active: true } : { label: "Pipeline empty", value: null, active: false };
        }
        if (agentId === "analytics") {
            return leads.length > 0 || deals.length > 0 ? { label: "Data ready to analyze", value: null, active: true } : { label: "No data yet", value: null, active: false };
        }
        return { label: "", value: null, active: false };
    };

    const startGoal = (goalLabel) => {
        const hot = hotLeads();
        const due = dueLeads();
        const channel = bestChannel();

        pushMessage({ id: crypto.randomUUID(), role: "user", kind: "text", content: `Goal: ${goalLabel}` });
        pushLog(`Orchestrator started goal "${goalLabel}"`);

        const findings = [
            `${hot.length} hot leads available`,
            `${due.length} follow-up${due.length !== 1 ? "s" : ""} pending`,
            channel ? `${channel.name} is your best-performing source (${channel.count} leads)` : null,
        ].filter(Boolean);

        const planTargets = due.slice(0, BATCH_CAP);

        pushMessage({
            id: crypto.randomUUID(),
            role: "assistant",
            kind: "goal_plan",
            goal: goalLabel,
            findings,
            routedVia: [
                "AI Sales Assistant",
                channel ? "AI Marketing Engine" : null,
            ].filter(Boolean),
            steps: [
                { label: `Draft follow-up emails for ${planTargets.length} pending leads`, done: false },
                { label: "Review & approve messages", done: false },
                { label: "Send and update CRM", done: false },
            ],
            drafts: planTargets.map((l) => ({
                id: l.id,
                name: l.user_name || "there",
                email: l.user_email,
                message: followUpMessage(l.user_name || "there"),
            })),
            status: "planning", // planning | executing | done
            sentCount: 0,
        });
    };

    const handleSend = async (textOverride) => {
        const text = (textOverride ?? input).trim();
        if (!text || isLoading) return;
        setInput("");
        pushMessage({ id: crypto.randomUUID(), role: "user", kind: "text", content: text });

        const lower = text.toLowerCase();

        // ---- Real-data command: hot leads table ----
        if (lower.includes("hot lead")) {
            const top = hotLeads(); // show every hot lead, not just a top-5 sample
            pushMessage({ id: crypto.randomUUID(), role: "assistant", kind: "hot_leads", leads: top });
            pushLog(`Looked up hot leads — ${top.length} found`);
            return;
        }

        // ---- Real-data command: bulk follow-up (draft-only, needs approval) ----
        if (lower.includes("follow-up") || lower.includes("follow up")) {
            const targets = dueLeads().slice(0, BATCH_CAP); // sane cap for one batch
            if (targets.length === 0) {
                pushMessage({
                    id: crypto.randomUUID(),
                    role: "assistant",
                    kind: "text",
                    content: "Every lead has already been contacted at least once — nothing due for follow-up right now.",
                });
                return;
            }
            pushMessage({
                id: crypto.randomUUID(),
                role: "assistant",
                kind: "approval",
                status: "draft", // draft | reviewing | sending | done
                drafts: targets.map((l) => ({
                    id: l.id,
                    name: l.user_name || "there",
                    email: l.user_email,
                    message: followUpMessage(l.user_name || "there"),
                })),
                sentCount: 0,
            });
            pushLog(`Drafted ${targets.length} follow-up email${targets.length !== 1 ? "s" : ""} — awaiting approval`);
            return;
        }

        // ---- Everything else: free-form Groq chat ----
        if (!isGroqConfigured) {
            pushMessage({
                id: crypto.randomUUID(),
                role: "assistant",
                kind: "text",
                content: "AI isn't configured yet — add a Groq API key in groqConfig.js.",
                isError: true,
            });
            return;
        }
        setIsLoading(true);
        try {
            const reply = await callGroq(text);
            pushMessage({ id: crypto.randomUUID(), role: "assistant", kind: "text", content: reply });
        } catch (err) {
            pushMessage({
                id: crypto.randomUUID(),
                role: "assistant",
                kind: "text",
                content: "Couldn't reach the AI right now — try again in a moment.",
                isError: true,
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Only fires when the person explicitly clicks "Approve & Send" —
    // never automatically. This is the one place real sends happen.
    const approveAndSend = async (messageId) => {
        const msg = messages.find((m) => m.id === messageId);
        if (!msg) return;
        updateMessage(messageId, { status: "sending" });

        let sentCount = 0;
        for (const draft of msg.drafts) {
            if (!draft.email) continue;
            try {
                const res = await fetch(SEND_EMAIL_ENDPOINT, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        to_email: draft.email,
                        to_name: draft.name,
                        subject: EMAIL_SUBJECT,
                        message: draft.message,
                    }),
                });
                const data = await res.json().catch(() => null);
                if (res.ok && data?.success) {
                    sentCount++;
                    fetch(markContactedEndpoint(draft.id), { method: "POST", headers: authHeaders() }).catch(() => {});
                }
            } catch (err) {
                // this one lead failed — continue with the rest of the batch
            }
        }

        fetchLeads();
        fetchProjectContext(); // keep the AI's live-data context in sync
        updateMessage(messageId, { status: "done", sentCount });
        pushLog(`Approved & sent ${sentCount} of ${msg.drafts.length} follow-up emails`);
    };

    // Executes a goal plan: same real send + mark-contacted as
    // approveAndSend, but also advances the step checklist so the
    // person can watch progress (Phase 6/9 idea, kept lightweight —
    // no persisted task queue, just this message's own state).
    const approveGoalPlan = async (messageId) => {
        const msg = messages.find((m) => m.id === messageId);
        if (!msg) return;

        updateMessage(messageId, {
            status: "executing",
            steps: msg.steps.map((s, i) => (i <= 1 ? { ...s, done: true } : s)),
        });
        pushLog(`Executing goal "${msg.goal}" — sending ${msg.drafts.length} draft${msg.drafts.length !== 1 ? "s" : ""}`);

        let sentCount = 0;
        for (const draft of msg.drafts) {
            if (!draft.email) continue;
            try {
                const res = await fetch(SEND_EMAIL_ENDPOINT, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        to_email: draft.email,
                        to_name: draft.name,
                        subject: EMAIL_SUBJECT,
                        message: draft.message,
                    }),
                });
                const data = await res.json().catch(() => null);
                if (res.ok && data?.success) {
                    sentCount++;
                    fetch(markContactedEndpoint(draft.id), { method: "POST", headers: authHeaders() }).catch(() => {});
                }
            } catch (err) {
                // this one lead failed — continue with the rest of the batch
            }
        }

        fetchLeads();
        fetchProjectContext(); // keep the AI's live-data context in sync
        setMessages((prev) =>
            prev.map((m) =>
                m.id === messageId
                    ? { ...m, status: "done", sentCount, steps: m.steps.map((s) => ({ ...s, done: true })) }
                    : m
            )
        );
        pushLog(`Goal "${msg.goal}" done — sent ${sentCount} of ${msg.drafts.length}, CRM updated`);
    };

    return (
        <section id="sec-ai-assistant" className="h-full flex flex-col overflow-hidden relative z-10 py-3 sm:py-4">
            <div className="w-full h-full flex flex-col min-h-0 px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between shrink-0 flex-wrap gap-2">
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
                            GrowthOS Copilot <Sparkles size={20} className="text-orange-500" />
                        </h2>
                        <p className="text-gray-400 text-sm mt-1">Your AI partner for growth.</p>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2 text-[11px] text-gray-500 border border-white/10 rounded-lg px-3 py-2">
                            <ShieldCheck size={13} className="text-green-500 shrink-0" />
                            <span>
                                Human Approval: <span className="text-gray-300 font-semibold">ON</span> · Batch cap:{" "}
                                <span className="text-gray-300 font-semibold">{BATCH_CAP}</span> · Memory:{" "}
                                <span className="text-gray-300 font-semibold">last {MEMORY_WINDOW} msgs</span>
                            </span>
                        </div>
                        <button
                            disabled
                            title="Autonomous Mode — Pro plan, coming soon"
                            className="flex items-center gap-2 border border-white/10 text-gray-500 px-3 py-2 rounded-lg text-xs font-semibold cursor-not-allowed"
                        >
                            <Lock size={12} /> Autonomous Mode
                        </button>
                    </div>
                </div>

                <div className="mt-4 flex-1 min-h-0 bg-black border border-orange-600/30 rounded-[28px] overflow-hidden">
                    <div className="grid grid-cols-1 lg:grid-cols-3 h-full">
                        {/* Chat */}
                        <div className="lg:col-span-2 border-r border-orange-600/20 h-full min-h-0 flex flex-col">
                            <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-5 py-5 space-y-4">
                                {messages.length === 0 && (
                                    <div className="bg-black border border-orange-600/30 rounded-2xl p-4 max-w-[90%]">
                                        <p className="text-gray-300 text-sm leading-6">
                                            Ask me anything, or try "Show hot leads" / "Send follow-up to all" for
                                            answers grounded in your real lead data.
                                        </p>
                                    </div>
                                )}

                                {messages.map((m) => (
                                    <ChatMessage
                                        key={m.id}
                                        message={m}
                                        onApprove={() => approveAndSend(m.id)}
                                        onApproveGoal={() => approveGoalPlan(m.id)}
                                    />
                                ))}

                                {isLoading && (
                                    <div className="bg-black border border-orange-600/30 rounded-2xl p-3 w-fit flex items-center gap-2">
                                        <Loader2 size={14} className="animate-spin text-orange-500" />
                                        <span className="text-xs text-gray-400">Thinking...</span>
                                    </div>
                                )}
                            </div>

                            <div className="px-5 py-4 border-t border-orange-600/20 shrink-0">
                                <div className="flex items-center gap-2 bg-white/5 border border-white/10 focus-within:border-orange-600/50 rounded-xl px-3 py-2.5 transition">
                                    <input
                                        type="text"
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyDown={(e) => e.key === "Enter" && handleSend()}
                                        placeholder="Ask anything or type a command..."
                                        className="flex-1 min-w-0 bg-transparent outline-none text-sm text-white placeholder:text-gray-500"
                                    />
                                    <button
                                        onClick={() => handleSend()}
                                        disabled={isLoading || !input.trim()}
                                        className="h-8 w-8 rounded-lg bg-orange-500 disabled:bg-orange-500/30 disabled:cursor-not-allowed hover:bg-orange-600 flex items-center justify-center shrink-0 transition"
                                    >
                                        <Send size={15} className="text-black" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Sidebar */}
                        <div className="bg-black border-t lg:border-t-0 border-orange-600/40 text-white p-4 sm:p-5 h-full min-h-0 flex flex-col overflow-y-auto">
                            <h3 className="text-sm font-bold text-white shrink-0 flex items-center gap-1.5">
                                <Target size={14} className="text-orange-500" /> Goals
                            </h3>
                            <p className="text-[11px] text-gray-500 mt-0.5 shrink-0">What do you want to achieve?</p>
                            <div className="space-y-2 mt-3 shrink-0">
                                {GOALS.map((g) => (
                                    <button
                                        key={g.label}
                                        onClick={() => g.enabled && startGoal(g.label)}
                                        disabled={!g.enabled}
                                        title={g.enabled ? undefined : "Coming soon — needs data this app doesn't track yet"}
                                        className={`w-full text-left rounded-xl px-3 py-2.5 text-sm transition duration-200 border ${
                                            g.enabled
                                                ? "bg-orange-500/10 border-orange-500/30 hover:bg-orange-500/20 text-white"
                                                : "bg-white/[0.02] border-white/5 text-gray-600 cursor-not-allowed"
                                        }`}
                                    >
                                        {g.label} {!g.enabled && <Lock size={10} className="inline ml-1 mb-0.5" />}
                                    </button>
                                ))}
                            </div>

                            <h3 className="text-sm font-bold text-white mt-6 shrink-0">Suggested Prompts</h3>
                            <div className="space-y-2 mt-3 shrink-0">
                                {SUGGESTED_PROMPTS.map((p) => (
                                    <button
                                        key={p}
                                        onClick={() => handleSend(p)}
                                        disabled={isLoading}
                                        className="w-full text-left bg-white/10 hover:bg-orange-500/15 border border-transparent hover:border-orange-500/40 rounded-xl px-3 py-2.5 text-sm transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {p}
                                    </button>
                                ))}
                            </div>

                            <h3 className="text-sm font-bold text-white mt-6 shrink-0 flex items-center gap-1.5">
                                <Bot size={14} className="text-orange-500" /> AI Agents
                            </h3>
                            <p className="text-[11px] text-gray-500 mt-0.5 shrink-0">Specialists grounded in your real data</p>
                            <div className="space-y-2 mt-3 shrink-0">
                                {AGENTS.map((agent) => {
                                    const Icon = agent.icon;
                                    const running = runningAgentId === agent.id;
                                    const live = agentLiveStatus(agent.id);
                                    return (
                                        <button
                                            key={agent.id}
                                            onClick={() => runAgent(agent.id)}
                                            disabled={Boolean(runningAgentId)}
                                            className="w-full text-left bg-white/5 hover:bg-orange-500/10 border border-white/10 hover:border-orange-500/30 rounded-xl p-2.5 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <div className="flex items-center gap-2">
                                                <Chip color={agent.color} icon={Icon} size={13} />
                                                <span className="text-xs font-semibold text-white flex-1">{agent.label}</span>
                                                {running && <Loader2 size={12} className="animate-spin text-orange-400 shrink-0" />}
                                            </div>
                                            <p className="text-[10px] text-gray-500 mt-1.5 leading-snug">{agent.description}</p>
                                            <div className="flex items-center gap-1.5 mt-1.5">
                                                <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${running ? "bg-orange-400 animate-pulse" : live.active ? "bg-green-400" : "bg-gray-600"}`} />
                                                <span className="text-[10px] text-gray-400">
                                                    {running ? "Running..." : live.value !== null ? `${live.label}: ${live.value}` : live.label}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>

                            <h3 className="text-sm font-bold text-white mt-6 shrink-0 flex items-center gap-1.5">
                                <Clock size={14} className="text-orange-500" /> Action Log
                            </h3>
                            <p className="text-[11px] text-gray-500 mt-0.5 shrink-0">This session — resets on reload</p>
                            <div className="mt-3 shrink-0 max-h-40 overflow-y-auto space-y-1.5 pr-1">
                                {actionLog.length === 0 ? (
                                    <p className="text-[11px] text-gray-600 italic">No actions taken yet</p>
                                ) : (
                                    actionLog.map((entry) => (
                                        <div key={entry.id} className="flex items-start gap-2 text-[11px]">
                                            <span className="text-gray-600 shrink-0 tabular-nums">
                                                {entry.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                            </span>
                                            <span className="text-gray-300 leading-snug">{entry.text}</span>
                                        </div>
                                    ))
                                )}
                            </div>

                            <h3 className="text-sm font-bold text-white mt-6 shrink-0">Quick Actions</h3>
                            <div className="space-y-2 mt-3 shrink-0">
                                <button
                                    onClick={() => navigate("/app/campaign-automation", { state: { openCreateAutomation: true } })}
                                    className="w-full flex items-center gap-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 text-sm transition"
                                >
                                    <Megaphone size={15} className="text-orange-500" /> Create Campaign
                                </button>
                                <button
                                    onClick={() => navigate("/app/analytics-bi")}
                                    className="w-full flex items-center gap-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl px-3 py-2.5 text-sm transition"
                                >
                                    <BarChart3 size={15} className="text-orange-500" /> Analyze Leads
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

/* ==========================================================
   Chat message renderer — handles plain text plus the two
   structured, real-data message kinds (hot_leads, approval).
========================================================== */
const ChatMessage = ({ message, onApprove, onApproveGoal }) => {
    if (message.role === "user") {
        return (
            <div className="bg-orange-500 text-black ml-auto rounded-2xl p-4 max-w-[85%] text-sm leading-6 whitespace-pre-wrap break-words w-fit">
                {message.content}
            </div>
        );
    }

    if (message.kind === "hot_leads") {
        return <HotLeadsCard leads={message.leads} />;
    }

    if (message.kind === "approval") {
        return <ApprovalCard message={message} onApprove={onApprove} />;
    }

    if (message.kind === "goal_plan") {
        return <GoalPlanCard message={message} onApprove={onApproveGoal} />;
    }

    if (message.kind === "agent_result") {
        return <AgentResultCard message={message} />;
    }

    return (
        <div
            className={`rounded-2xl p-4 max-w-[85%] text-sm leading-6 whitespace-pre-wrap break-words bg-black border ${
                message.isError ? "border-red-500/40" : "border-orange-600/30"
            } text-gray-200`}
        >
            {message.content}
        </div>
    );
};

const HotLeadsCard = ({ leads }) => (
    <div className="bg-black border border-orange-600/30 rounded-2xl p-4 max-w-[95%] w-fit">
        <p className="text-sm text-white font-semibold flex items-center gap-1.5 mb-3">
            <Flame size={14} className="text-orange-500" />
            {leads.length === 0 ? "No hot leads right now" : `${leads.length} hot lead${leads.length !== 1 ? "s" : ""}`}
        </p>
        {leads.length > 0 && (
            <div className="overflow-x-auto">
                <table className="text-xs w-full">
                    <thead>
                        <tr className="text-left text-gray-500 uppercase text-[10px] border-b border-white/10">
                            <th className="pb-2 pr-4 font-semibold">Lead</th>
                            <th className="pb-2 pr-4 font-semibold">AI Score</th>
                            <th className="pb-2 pr-4 font-semibold">Source</th>
                            <th className="pb-2 pr-4 font-semibold">Status</th>
                            <th className="pb-2 font-semibold">Recommended</th>
                        </tr>
                    </thead>
                    <tbody>
                        {leads.map((l) => (
                            <tr key={l.id} className="border-b border-white/5 last:border-0">
                                <td className="py-2 pr-4">
                                    <div className="flex items-center gap-2">
                                        <div className="h-6 w-6 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-400 text-[9px] font-bold flex items-center justify-center shrink-0">
                                            {initials(l.user_name)}
                                        </div>
                                        <span className="text-white font-medium whitespace-nowrap">{l.user_name || "Unnamed"}</span>
                                    </div>
                                </td>
                                <td className="py-2 pr-4 text-orange-400 font-semibold">{l.score}</td>
                                <td className="py-2 pr-4 text-gray-300 whitespace-nowrap">{l.lead_source || "—"}</td>
                                <td className="py-2 pr-4">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                        l.is_contacted
                                            ? "bg-green-500/10 text-green-400 border-green-500/30"
                                            : "bg-red-500/10 text-red-400 border-red-500/30"
                                    }`}>
                                        {l.is_contacted ? "Contacted" : "Due"}
                                    </span>
                                </td>
                                <td className="py-2 text-gray-300 whitespace-nowrap">{recommendedAction(l)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
    </div>
);

const ApprovalCard = ({ message, onApprove }) => {
    const [expanded, setExpanded] = useState(false);
    const { drafts, status, sentCount } = message;

    return (
        <div className="bg-black border border-orange-600/30 rounded-2xl p-4 max-w-[95%] w-fit">
            {status === "done" ? (
                <div className="flex items-center gap-2 text-sm text-green-400 font-semibold">
                    <Check size={15} /> Sent to {sentCount} of {drafts.length} leads
                </div>
            ) : (
                <>
                    <p className="text-sm text-white">
                        I've prepared follow-up emails for <span className="font-semibold">{drafts.length} leads</span> who
                        haven't been contacted yet.
                    </p>

                    <button
                        onClick={() => setExpanded((v) => !v)}
                        className="flex items-center gap-1 text-orange-400 text-xs font-semibold mt-2.5"
                    >
                        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                        Review Messages
                    </button>

                    {expanded && (
                        <div className="mt-2.5 space-y-2 max-h-56 overflow-y-auto pr-1">
                            {drafts.map((d) => (
                                <div key={d.id} className="bg-white/5 border border-white/10 rounded-xl p-2.5">
                                    <p className="text-xs font-semibold text-white">
                                        {d.name} {!d.email && <span className="text-red-400 font-normal">— no email on file, will be skipped</span>}
                                    </p>
                                    <p className="text-[11px] text-gray-400 mt-1 whitespace-pre-wrap leading-relaxed">{d.message}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex items-center gap-2.5 mt-3.5">
                        <button
                            onClick={onApprove}
                            disabled={status === "sending"}
                            className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-black text-xs font-bold px-4 py-2 rounded-lg transition"
                        >
                            {status === "sending" ? (
                                <>
                                    <Loader2 size={13} className="animate-spin" /> Sending...
                                </>
                            ) : (
                                <>
                                    <Check size={13} /> Approve &amp; Send
                                </>
                            )}
                        </button>
                        {status !== "sending" && (
                            <span className="text-[11px] text-gray-500 flex items-center gap-1">
                                <AlertTriangle size={11} /> Nothing sends until you approve
                            </span>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

/* ==========================================================
   Goal -> Plan -> Approve -> Execute card (Phase 1 of the
   Copilot roadmap). Findings and steps are computed from real
   lead data (see startGoal in the parent) — never invented.
========================================================== */
const GoalPlanCard = ({ message, onApprove }) => {
    const [expanded, setExpanded] = useState(false);
    const { goal, findings, routedVia, steps, drafts, status, sentCount } = message;

    return (
        <div className="bg-black border border-orange-600/30 rounded-2xl p-4 max-w-[95%] w-fit">
            <p className="text-sm text-white font-semibold flex items-center gap-1.5">
                <Target size={14} className="text-orange-500" /> I found a plan for "{goal}"
            </p>

            {routedVia?.length > 0 && (
                <div className="flex items-center flex-wrap gap-1.5 mt-2">
                    <span className="text-[10px] text-gray-500">Orchestrator routed to:</span>
                    {routedVia.map((name) => (
                        <span key={name} className="text-[10px] font-semibold text-orange-400 bg-orange-500/10 border border-orange-500/30 rounded-full px-2 py-0.5">
                            {name}
                        </span>
                    ))}
                </div>
            )}

            <div className="mt-3 space-y-1.5">
                {findings.map((f, i) => (
                    <p key={i} className="text-xs text-gray-300 flex items-center gap-1.5">
                        <Check size={12} className="text-green-400 shrink-0" /> {f}
                    </p>
                ))}
            </div>

            <p className="text-xs text-gray-500 font-semibold mt-3.5 mb-1.5">Recommended Plan</p>
            <div className="space-y-1.5">
                {steps.map((s, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                        {s.done ? (
                            <CheckCircle2 size={13} className="text-green-400 shrink-0" />
                        ) : (
                            <Circle size={13} className="text-gray-600 shrink-0" />
                        )}
                        <span className={s.done ? "text-gray-400 line-through" : "text-gray-200"}>{s.label}</span>
                    </div>
                ))}
            </div>

            {status !== "done" && (
                <button
                    onClick={() => setExpanded((v) => !v)}
                    className="flex items-center gap-1 text-orange-400 text-xs font-semibold mt-3"
                >
                    {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                    Preview {drafts.length} draft message{drafts.length !== 1 ? "s" : ""}
                </button>
            )}

            {expanded && status !== "done" && (
                <div className="mt-2 space-y-2 max-h-48 overflow-y-auto pr-1">
                    {drafts.map((d) => (
                        <div key={d.id} className="bg-white/5 border border-white/10 rounded-xl p-2.5">
                            <p className="text-xs font-semibold text-white">
                                {d.name} {!d.email && <span className="text-red-400 font-normal">— no email on file, will be skipped</span>}
                            </p>
                            <p className="text-[11px] text-gray-400 mt-1 whitespace-pre-wrap leading-relaxed">{d.message}</p>
                        </div>
                    ))}
                </div>
            )}

            {status === "done" ? (
                <div className="flex items-center gap-2 text-sm text-green-400 font-semibold mt-3.5">
                    <Check size={15} /> Done — sent to {sentCount} of {drafts.length} leads, CRM updated
                </div>
            ) : (
                <div className="flex items-center gap-2.5 mt-3.5">
                    <button
                        onClick={onApprove}
                        disabled={status === "executing"}
                        className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 disabled:opacity-60 text-black text-xs font-bold px-4 py-2 rounded-lg transition"
                    >
                        {status === "executing" ? (
                            <>
                                <Loader2 size={13} className="animate-spin" /> Executing...
                            </>
                        ) : (
                            <>
                                <Check size={13} /> Approve
                            </>
                        )}
                    </button>
                    {status !== "executing" && (
                        <span className="text-[11px] text-gray-500 flex items-center gap-1">
                            <Pencil size={11} /> Edit the drafts above before approving if needed
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};

/* ==========================================================
   Agent result card — shows which agent answered + its
   real-data-grounded response.
========================================================== */
const AgentResultCard = ({ message }) => {
    const { agent, content } = message;
    const Icon = agent.icon;
    return (
        <div className="bg-black border border-orange-600/30 rounded-2xl p-4 max-w-[85%] w-fit">
            <p className="text-sm text-white font-semibold flex items-center gap-2 mb-2.5">
                <Chip color={agent.color} icon={Icon} size={13} />
                {agent.label}
            </p>
            <p className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">{content}</p>
        </div>
    );
};

export default AIAssistantSection;