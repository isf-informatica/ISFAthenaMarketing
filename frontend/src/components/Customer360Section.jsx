import React, { useMemo, useState, useEffect } from "react";
import {
    Sparkles,
    MessageSquare,
    TrendingUp,
    Clock,
    ShieldAlert,
    ChevronDown,
    Loader2,
    Mail,
    Phone,
    PhoneCall,
    MapPin,
    Check,
    X,
    Send,
    AlertTriangle,
    RefreshCw,
    Globe,
    Tag,
    Link,
    User,
    Building2,
    Cpu,
    Lightbulb,
    Maximize2,
} from "lucide-react";
import ChatPanel from "./ChatPanel";
import { useGroqChat } from "./useGroqChat";
import { useCustomerData } from "./CustomerDataContext";
import { GROQ_API_KEY, GROQ_MODEL } from "./groqConfig";

/* ==========================================================
   CUSTOMER 360 VIEW (id="sec-customer-360")
   Layout: stat row -> [Profile | AI Insights | Channels + Chat]

   Email card sends mail IN-APP via the same FastAPI /send-email
   endpoint (SMTP-backed) that Lead_Management.jsx already uses
   successfully — not EmailJS, whose credentials here were stale.
   Click shows an editable confirm-before-send preview, then a
   success/failure toast.
   SMS / WhatsApp / Call still hand off to the device's own
   app, which is the only way a browser can trigger those.
========================================================== */

// Same backend used by Lead_Management.jsx — keep these in sync if the
// API host ever changes (matches ALLOWED_ORIGINS in growthos_backend/main.py).
const API_BASE_URL = "http://localhost:8000";
const SEND_EMAIL_ENDPOINT = `${API_BASE_URL}/send-email`;
// The mailbox the backend's SMTP config actually sends from — shown for
// reference in the compose modal, matching Lead_Management's Send Email card.
const SEND_FROM_ADDRESS = "isfinformaticaanalytica@gmail.com";

const CARD = "bg-[#0d0d10] border border-white/10 rounded-2xl";

const chipColors = {
    orange: "bg-orange-500/15 border-orange-500/30 text-orange-400",
    blue: "bg-blue-500/15 border-blue-500/30 text-blue-400",
    green: "bg-green-500/15 border-green-500/30 text-green-400",
    purple: "bg-purple-500/15 border-purple-500/30 text-purple-400",
    rose: "bg-rose-500/15 border-rose-500/30 text-rose-400",
};

const Chip = ({ color, icon: Icon, size = 15 }) => (
    <div className={`h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 ${chipColors[color]}`}>
        <Icon size={size} />
    </div>
);

/* ---------------------------------------------------------
   Default message templates (used unless an AI-drafted
   message has been saved for that channel — see customMsgs)
--------------------------------------------------------- */
const smsTemplate = (name) =>
    `Hi ${name},\nThank you for connecting with GrowthOS AI.\nYour inquiry has been received successfully.\nOur team will contact you soon for a free demo.\nVisit: https://www.growthos.ai\n- GrowthOS AI Team`;

const whatsappTemplate = (name) =>
    `👋 Hello ${name},\nThank you for your interest in GrowthOS AI.\nWe received your request and our AI has analyzed your business requirements.\n🚀 GrowthOS AI can help you with:\n• Lead Generation\n• CRM Management\n• Marketing Automation\n• AI WhatsApp Campaigns\n• Email Marketing\n• Customer Analytics\nOur team will contact you shortly for a free demo.\nIf you have any questions, simply reply to this message.\nThank you,\nGrowthOS AI Team`;

const emailBodyTemplate = (name) =>
    `Dear ${name},\n\nThank you for showing interest in GrowthOS AI.\nWe have successfully received your request.\n\nOur AI platform is designed to help businesses with:\n• Lead Generation\n• CRM Management\n• AI Marketing Automation\n• WhatsApp Campaigns\n• Email Campaigns\n• Customer Analytics\n\nOne of our experts will contact you shortly to understand your business requirements and schedule a personalized demo.\n\nIf you have any questions, simply reply to this email.\n\nThank you for choosing GrowthOS AI.\n\nBest Regards,\nGrowthOS AI Team\nAutonomous Revenue Platform\nhttps://isfathena.com/`;

const EMAIL_SUBJECT = "Thank you for your interest in GrowthOS AI";

// Best-effort country -> dial code, since the backend doesn't store one
// separately. WhatsApp click-to-chat links require the full international
// number, so this fills the gap using the lead's "country" field.
const dialCodeForCountry = (country) => {
    const map = {
        India: "91",
        "United State of America": "1",
        Canada: "1",
    };
    return map[country] || "";
};

const digitsOnly = (v) => (v || "").replace(/\D/g, "");

const channelConfig = [
    { key: "email", label: "Email", icon: Mail, color: "orange" },
    { key: "sms", label: "SMS", icon: Phone, color: "blue" },
    { key: "whatsapp", label: "WhatsApp", icon: MessageSquare, color: "green" },
    { key: "call", label: "Call", icon: PhoneCall, color: "purple" },
];

// Used ONLY if Groq isn't configured or the API call fails — a rule-based
// fallback so the card never shows nothing, clearly less specific than a
// real AI-generated insight.
const fallbackInsights = (lead) => {
    const base = [{ text: `Current Status: ${lead?.current_status || "Open"}`, color: "orange", icon: Sparkles }];
    const contactLine = lead?.is_contacted
        ? { text: "Already contacted at least once", color: "green", icon: Phone }
        : { text: "Not contacted yet — reach out via Email/SMS/WhatsApp", color: "blue", icon: Clock };
    return [...base, contactLine];
};

const Customer360Section = () => {
    const { leads, leadsLoading, leadsError, selectedLead, selectedLeadKey, setSelectedLeadKey } =
        useCustomerData();
    const { messages, isLoading, sendMessage, resetChat } = useGroqChat();

    // AI-drafted messages saved per channel — takes priority over the
    // default template when present. Reset when a different lead is selected.
    const [customMsgs, setCustomMsgs] = useState({});
    const [savedFlash, setSavedFlash] = useState("");
    const [isChatExpanded, setIsChatExpanded] = useState(false);

    // Unified compose modal — used for Email, SMS and WhatsApp so the user
    // can review/edit the recipient and message before it goes out.
    // Call is excluded since there's nothing to edit before dialing.
    const [composeChannel, setComposeChannel] = useState(null); // "email" | "sms" | "whatsapp" | null
    const [composeTo, setComposeTo] = useState("");
    const [composeToIsAiGuess, setComposeToIsAiGuess] = useState(false);
    const [composeSubject, setComposeSubject] = useState("");
    const [composeBody, setComposeBody] = useState("");
    const [emailSending, setEmailSending] = useState(false);
    const [emailResult, setEmailResult] = useState(null); // { type: "success" | "error", text }
    const [toast, setToast] = useState(null); // { type, text }

    const lead = selectedLead;
    // Real, not guessed: driven directly by is_contacted (isfathena.lead_generation)
    // — the same Due/Contacted flag the Lead Management STATUS column uses.
    const nextAction = lead ? (lead.is_contacted ? "Need to take Follow-ups" : "Need to Contact") : "—";

    // Also real: ai_score is computed server-side (main.py's compute_ai_score)
    // from the lead's own form fields — not a per-status guess.
    const engagementScore = lead ? (Number(lead.ai_score) || 0) : 0;

    // Churn risk composed from two real fields — current_status and
    // is_contacted. No purchase-history or last-contacted-date column
    // exists yet, so this can't factor in time-since-contact; it's the
    // best signal available from what's actually tracked today.
    const churnRisk = (() => {
        if (!lead) return { risk: "Unknown", riskColor: "blue" };
        if (lead.current_status === "Closed") return { risk: "High", riskColor: "rose" };
        if (lead.current_status === "Success") return { risk: "Low", riskColor: "green" };
        if (!lead.is_contacted) return { risk: "Medium-High", riskColor: "orange" };
        return { risk: "Medium", riskColor: "purple" };
    })();
    const initial = (lead?.user_name || "?").trim().charAt(0).toUpperCase() || "?";
    const name = lead?.user_name || "there";

    /* ---------------- AI Customer Insights (real Groq call) ---------------- */
    const [aiInsights, setAiInsights] = useState([]);
    const [insightsLoading, setInsightsLoading] = useState(false);
    const [insightsError, setInsightsError] = useState("");

    const isGroqConfigured =
        Boolean(GROQ_API_KEY) && GROQ_API_KEY !== "PASTE_YOUR_GROQ_API_KEY_HERE";

    const generateInsights = async (targetLead) => {
        if (!targetLead) return;
        if (!isGroqConfigured) {
            setInsightsError("");
            setAiInsights([]); // falls back to fallbackInsights() below
            return;
        }
        setInsightsLoading(true);
        setInsightsError("");
        try {
            const contactState = targetLead.is_contacted ? "already contacted at least once" : "not contacted yet";
            // AI Search-discovered leads carry extra enrichment fields
            // (blank for manually-added leads) — include them only when
            // present so Groq's insights reflect the FULL real record,
            // not just the basic form fields every lead has.
            const enrichmentLines = [
                targetLead.decision_maker && `Decision maker: ${targetLead.decision_maker}${targetLead.designation ? ` (${targetLead.designation})` : ""}`,
                targetLead.industry && `Industry: ${targetLead.industry}`,
                (targetLead.company_size || targetLead.estimated_scale) &&
                    `Company size/scale: ${[targetLead.company_size, targetLead.estimated_scale].filter(Boolean).join(" · ")}`,
                targetLead.technology_used && `Technology used: ${targetLead.technology_used}`,
                targetLead.pain_points && `Pain points: ${targetLead.pain_points}`,
                targetLead.reason && `Why this is a fit: ${targetLead.reason}`,
            ]
                .filter(Boolean)
                .join("\n");
            const missingFields = [
                !targetLead.decision_maker && "decision maker",
                !targetLead.industry && "industry",
                !(targetLead.company_size || targetLead.estimated_scale) && "company size",
                !targetLead.technology_used && "technology used",
                !targetLead.pain_points && "pain points",
            ]
                .filter(Boolean)
                .join(", ");

            const prompt =
                `You are a sharp CRM analyst writing insights for ONE specific sales rep about ONE specific lead. ` +
                `Use ONLY the facts below — never invent names, numbers, or details that aren't given.\n\n` +
                `LEAD RECORD:\n` +
                `Name: ${targetLead.user_name || "Unknown"}\n` +
                `Status: ${targetLead.current_status || "Open"}\n` +
                `Contact state: ${contactState}\n` +
                `Lead source: ${targetLead.lead_source || "Not specified"}\n` +
                `GMB status: ${targetLead.gmb_status || "Not specified"}\n` +
                `Assigned to: ${targetLead.assigned_prospect || "Unassigned"}\n` +
                `Notes: ${targetLead.prospect_comment || "None"}\n` +
                (enrichmentLines ? `${enrichmentLines}\n` : "") +
                (missingFields ? `\nFields NOT available for this lead (do not guess these): ${missingFields}.\n` : "") +
                `\nWrite exactly 4 lines, one per category below, in this exact order, each prefixed with its tag:\n` +
                `RISK: something specific in THIS record that could stall or lose the deal (e.g. tied to contact state, status, or a named pain point). If nothing stands out, say what's missing that creates risk.\n` +
                `OPPORTUNITY: a specific angle to lean into, grounded in the industry, tech used, or stated reason/fit — not a generic "great opportunity" line.\n` +
                `ACTION: one concrete next step naming a channel (email/SMS/WhatsApp/call) and WHY now, based on the contact state and status.\n` +
                `TIMING: how urgent this is and why, referencing the status or how long it's likely been sitting.\n\n` +
                `Rules: each line under 16 words. Reference actual field values (names, statuses, industries) instead of vague phrases like "reach out soon" or "follow up". No numbering beyond the tag, no markdown, no extra commentary.`;

            const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
                body: JSON.stringify({
                    model: GROQ_MODEL,
                    temperature: 0.4,
                    max_tokens: 260,
                    messages: [{ role: "user", content: prompt }],
                }),
            });
            if (!res.ok) throw new Error(`Groq responded with ${res.status}`);
            const data = await res.json();
            const text = data?.choices?.[0]?.message?.content?.trim() || "";
            const CATEGORY_META = {
                RISK: { color: "rose", icon: AlertTriangle },
                OPPORTUNITY: { color: "green", icon: TrendingUp },
                ACTION: { color: "orange", icon: Lightbulb },
                TIMING: { color: "blue", icon: Clock },
            };
            const parsed = text
                .split("\n")
                .map((l) => l.replace(/^[-•\d.)\s]+/, "").trim())
                .filter(Boolean)
                .map((line) => {
                    const match = line.match(/^(RISK|OPPORTUNITY|ACTION|TIMING)\s*:\s*(.+)$/i);
                    if (match) {
                        const tag = match[1].toUpperCase();
                        return { text: match[2].trim(), ...CATEGORY_META[tag] };
                    }
                    return { text: line, color: "orange", icon: Sparkles };
                })
                .slice(0, 4);
            setAiInsights(parsed);
        } catch (err) {
            setInsightsError("Couldn't reach the AI right now.");
            setAiInsights([]);
        } finally {
            setInsightsLoading(false);
        }
    };

    // Auto-regenerate whenever the selected lead changes.
    useEffect(() => {
        if (lead?.id) generateInsights(lead);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lead?.id]);

    const insights = aiInsights.length ? aiInsights : fallbackInsights(lead);

    /* ---------------- AI-suggested missing contact info ----------------
       Groq has no live web access, so this can only surface facts it
       already knows from training (e.g. a well-known institution's
       published contact info) — never a real-time lookup. Every result
       is treated as an unverified suggestion: shown with a distinct
       "AI suggested" style, never written back to the lead record, and
       only used as a compose fallback with a visible warning so nobody
       accidentally messages a guessed number/email. */
    const [aiContactLookup, setAiContactLookup] = useState({ email: null, phone: null });
    const [contactLookupNote, setContactLookupNote] = useState("");
    const [contactLookupLoading, setContactLookupLoading] = useState(false);
    const [contactLookupError, setContactLookupError] = useState("");

    const findMissingContactInfo = async (targetLead) => {
        if (!targetLead) return;
        const needsEmail = !targetLead.user_email;
        const needsPhone = !targetLead.user_mobile_number;
        if (!needsEmail && !needsPhone) {
            setAiContactLookup({ email: null, phone: null });
            setContactLookupNote("");
            setContactLookupError("");
            return;
        }
        if (!isGroqConfigured) {
            setContactLookupError("");
            return;
        }
        setContactLookupLoading(true);
        setContactLookupError("");
        try {
            const wanted = [needsEmail && "email", needsPhone && "phone number"].filter(Boolean).join(" and ");
            const knownLines = [
                `Name/business: ${targetLead.user_name || "Unknown"}`,
                targetLead.user_address && `Address: ${targetLead.user_address}`,
                targetLead.country && `Country: ${targetLead.country}`,
                targetLead.lead_source && `Source: ${targetLead.lead_source}`,
                targetLead.industry && `Industry: ${targetLead.industry}`,
            ]
                .filter(Boolean)
                .join("\n");

            const prompt =
                `You are a CRM assistant with NO live internet access — you can only use what you already know from training data.\n` +
                `This record is missing: ${wanted}.\n\n` +
                `Known facts:\n${knownLines}\n\n` +
                `If — and only if — you have specific, confident knowledge of this exact entity's real published ${wanted} ` +
                `(e.g. a well-known institution's official contact details), return it. Otherwise return null. ` +
                `NEVER invent a plausible-looking email or phone number you are not genuinely confident about — a wrong guess could reach an unrelated person.\n\n` +
                `Respond with ONLY raw JSON, no markdown, no code fences, in exactly this shape:\n` +
                `{"email": "value or null", "phone": "value or null", "note": "one short sentence on confidence/source, or why unknown"}`;

            const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
                body: JSON.stringify({
                    model: GROQ_MODEL,
                    temperature: 0.1,
                    max_tokens: 200,
                    messages: [{ role: "user", content: prompt }],
                }),
            });
            if (!res.ok) throw new Error(`Groq responded with ${res.status}`);
            const data = await res.json();
            const raw = data?.choices?.[0]?.message?.content?.trim() || "{}";
            const cleaned = raw.replace(/^```json\s*|^```\s*|```$/g, "").trim();
            const parsed = JSON.parse(cleaned);
            setAiContactLookup({
                email: needsEmail && parsed.email && parsed.email !== "null" ? parsed.email : null,
                phone: needsPhone && parsed.phone && parsed.phone !== "null" ? parsed.phone : null,
            });
            setContactLookupNote(parsed.note || "");
        } catch (err) {
            setContactLookupError("Couldn't look this up right now.");
            setAiContactLookup({ email: null, phone: null });
        } finally {
            setContactLookupLoading(false);
        }
    };

    // Auto-run whenever the selected lead changes, same as insights above.
    useEffect(() => {
        setAiContactLookup({ email: null, phone: null });
        setContactLookupNote("");
        setContactLookupError("");
        if (lead?.id) findMissingContactInfo(lead);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lead?.id]);

    /* ---------------- "Ask AI about {lead}" chat, grounded per-lead ----------------
       useGroqChat() is shared with other panels (AI Assistant, floating
       widget) — we don't touch its default SYSTEM_PROMPT for them. Instead
       we pass an optional per-call context string (2nd arg to sendMessage,
       additive-only) so ONLY this chat gets the currently selected lead's
       real record, plus the same "no live browsing, don't invent contact
       details" honesty rule used elsewhere in this file. */
    const buildLeadChatContext = (targetLead) => {
        if (!targetLead) return "";
        const knownLines = [
            `Name: ${targetLead.user_name || "Unknown"}`,
            `Status: ${targetLead.current_status || "Open"}`,
            `Contact state: ${targetLead.is_contacted ? "already contacted" : "not contacted yet"}`,
            `Email on file: ${targetLead.user_email || "none"}`,
            `Phone on file: ${targetLead.user_mobile_number || "none"}`,
            `Website: ${targetLead.web_url || "none"}`,
            `Address: ${targetLead.user_address || "none"}`,
            `Country: ${targetLead.country || "none"}`,
            `Lead source: ${targetLead.lead_source || "Not specified"}`,
            `GMB status: ${targetLead.gmb_status || "Not specified"}`,
            `Assigned to: ${targetLead.assigned_prospect || "Unassigned"}`,
            targetLead.industry && `Industry: ${targetLead.industry}`,
            targetLead.decision_maker && `Decision maker: ${targetLead.decision_maker}${targetLead.designation ? ` (${targetLead.designation})` : ""}`,
            targetLead.pain_points && `Pain points: ${targetLead.pain_points}`,
            targetLead.reason && `Why this is a fit: ${targetLead.reason}`,
            targetLead.prospect_comment && `Notes: ${targetLead.prospect_comment}`,
        ]
            .filter(Boolean)
            .join("\n");

        return (
            `The user is currently viewing this specific lead in the CRM — every question below is about THIS lead unless stated otherwise:\n` +
            `${knownLines}\n\n` +
            `You have NO live internet access — you cannot browse the web right now. If asked for something not listed above ` +
            `(e.g. "give me the email" or "give me the contact number" when it says "none"), only answer if you have specific, ` +
            `confident knowledge of this exact real-world entity's actual published info from training. Otherwise say plainly that ` +
            `it's not on file and you don't have live access to look it up — suggest checking the website field above (if present) ` +
            `or the AI-suggested contact info shown on this card, rather than guessing a number or address that could belong to someone else.`
        );
    };

    const askAiAboutLead = (text) => sendMessage(text, buildLeadChatContext(lead));

    const lastAssistantMessage = useMemo(
        () => [...messages].reverse().find((m) => m.role === "assistant" && !m.isError && !m.isSystemNotice),
        [messages]
    );

    const useAsDraft = (channelKey) => {
        if (!lastAssistantMessage) return;
        setCustomMsgs((prev) => ({ ...prev, [channelKey]: lastAssistantMessage.content }));
        setSavedFlash(channelKey);
        setTimeout(() => setSavedFlash(""), 1800);
    };

    const showToast = (type, text) => {
        setToast({ type, text });
        setTimeout(() => setToast(null), 3500);
    };

    const messageFor = (channelKey) =>
        customMsgs[channelKey] ||
        { sms: smsTemplate(name), whatsapp: whatsappTemplate(name), email: emailBodyTemplate(name) }[channelKey];

    // Opens the compose modal pre-filled from the lead's saved details —
    // the user can still edit the recipient and message before sending.
    // Call has nothing to edit, so it still dials directly.
    const openChannel = (channelKey) => {
        if (!lead) return;

        if (channelKey === "call") {
            const phone = digitsOnly(lead.user_mobile_number);
            if (!phone) return;
            window.location.href = `tel:${phone}`;
            return;
        }

        if (channelKey === "email") {
            const to = lead.user_email || aiContactLookup.email || "";
            setComposeTo(to);
            setComposeToIsAiGuess(!lead.user_email && !!aiContactLookup.email);
            setComposeSubject(EMAIL_SUBJECT);
            setComposeBody(messageFor("email"));
            setEmailResult(null);
            setComposeChannel("email");
            return;
        }

        if (channelKey === "sms" || channelKey === "whatsapp") {
            const to = lead.user_mobile_number || aiContactLookup.phone || "";
            setComposeTo(to);
            setComposeToIsAiGuess(!lead.user_mobile_number && !!aiContactLookup.phone);
            setComposeBody(messageFor(channelKey));
            setComposeChannel(channelKey);
        }
    };

    const closeCompose = () => {
        if (emailSending) return;
        setComposeChannel(null);
        setComposeToIsAiGuess(false);
        setEmailResult(null);
    };

    // Actually sends the email via the backend's /send-email endpoint
    // (SMTP-backed — the same one Lead_Management.jsx uses) — no mail
    // client opens. Uses whatever the user has typed into the
    // To/Subject/Body fields, not necessarily the lead's saved address.
    const confirmSendEmail = async () => {
        const toAddress = composeTo.trim();
        if (!toAddress) {
            setEmailResult({ type: "error", text: "Please enter a recipient email address." });
            return;
        }

        setEmailSending(true);
        setEmailResult(null);
        try {
            const res = await fetch(SEND_EMAIL_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    to_email: toAddress,
                    to_name: name,
                    subject: composeSubject.trim() || EMAIL_SUBJECT,
                    message: composeBody,
                }),
            });
            const resp = await res.json().catch(() => null);
            if (res.ok && resp?.success) {
                setEmailResult({ type: "success", text: `Email sent to ${toAddress}` });
                showToast("success", `✓ Email sent to ${toAddress}`);
                setTimeout(() => setComposeChannel(null), 1100);
            } else {
                setEmailResult({ type: "error", text: "Send failed — please try again." });
            }
        } catch (err) {
            setEmailResult({ type: "error", text: "Network error — please try again." });
        } finally {
            setEmailSending(false);
        }
    };

    // SMS / WhatsApp still hand off to the device's own app, but now only
    // after the user confirms (and optionally edits) the number & message
    // in the compose modal.
    const sendSms = () => {
        const phone = digitsOnly(composeTo);
        if (!phone) return;
        window.location.href = `sms:${phone}?&body=${encodeURIComponent(composeBody)}`;
        setComposeChannel(null);
    };

    const sendWhatsapp = () => {
        const phone = digitsOnly(composeTo);
        if (!phone) return;
        const dial = dialCodeForCountry(lead?.country);
        const waNumber = dial && !phone.startsWith(dial) ? `${dial}${phone}` : phone;
        window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(composeBody)}`, "_blank");
        setComposeChannel(null);
    };

    const handleComposeSend = () => {
        if (composeChannel === "email") return confirmSendEmail();
        if (composeChannel === "sms") return sendSms();
        if (composeChannel === "whatsapp") return sendWhatsapp();
    };

    const isChannelEnabled = (channelKey) => {
        if (!lead) return false;
        // Email/SMS/WhatsApp all open the compose modal below, where the
        // recipient is a plain editable field — so these should stay
        // clickable even when the lead record itself has no email/phone
        // yet (very common for AI Search-discovered leads, which capture
        // the business first and contact details later). Call is the one
        // exception: it dials `tel:` immediately with no modal step, so it
        // genuinely needs a real number already on file.
        if (channelKey === "call") return !!lead.user_mobile_number;
        return true;
    };

    const stats = [
        { label: "Engagement Score (est.)", value: `${engagementScore}/100`, icon: TrendingUp, color: "orange", bar: engagementScore },
        { label: "Assigned To", value: lead?.assigned_prospect || "Unassigned", icon: MessageSquare, color: "blue" },
        { label: "Predicted Next Action", value: nextAction, icon: Clock, color: "green" },
        { label: "Churn Risk (est.)", value: churnRisk.risk, icon: ShieldAlert, color: churnRisk.riskColor },
    ];

    return (
        <section id="sec-customer-360" className="h-full flex flex-col overflow-hidden relative z-10 py-3 sm:py-4">
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 w-full h-full flex flex-col min-h-0">
                {/* Header + selector */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
                    <div>
                        <span className="inline-block bg-orange-500/10 text-orange-400 border border-orange-600/30 px-3 py-1 rounded-full font-semibold text-[11px] tracking-wide">
                            Customer Intelligence
                        </span>
                        <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold mt-2 text-white">
                            Customer 360 View
                        </h2>
                    </div>

                    <div className="relative w-full sm:w-64">
                        <select
                            value={selectedLeadKey ?? ""}
                            onChange={(e) => {
                                setSelectedLeadKey(e.target.value);
                                setCustomMsgs({});
                                resetChat();
                            }}
                            disabled={leadsLoading || leads.length === 0}
                            className="w-full bg-[#0d0d10] border border-white/10 rounded-xl pl-4 pr-10 py-2.5 text-sm text-white outline-none focus:border-orange-500/60 appearance-none cursor-pointer disabled:opacity-50"
                        >
                            {leads.length === 0 && <option value="">No leads yet</option>}
                            {leads.map((l, i) => (
                                <option key={l.id ?? i} value={l.id ?? String(i)} className="bg-black text-white">
                                    {l.user_name || `Lead #${i + 1}`}
                                </option>
                            ))}
                        </select>
                        <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
                    </div>
                </div>

                {leadsLoading && (
                    <div className="flex-1 flex items-center justify-center gap-2 text-gray-400 text-sm">
                        <Loader2 size={16} className="animate-spin" /> Loading leads from Campaign Builder...
                    </div>
                )}

                {!leadsLoading && leadsError && (
                    <div className="flex-1 flex items-center justify-center text-red-400 text-sm">{leadsError}</div>
                )}

                {!leadsLoading && !leadsError && leads.length === 0 && (
                    <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                        No leads yet — add one in Campaign Builder to see it here.
                    </div>
                )}

                {!leadsLoading && !leadsError && lead && (
                    <>
                        {/* Stat cards */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3 shrink-0">
                            {stats.map(({ label, value, icon, color, bar }, i) => (
                                <div key={i} className={`${CARD} p-3.5`}>
                                    <div className="flex items-start justify-between">
                                        <p className="text-gray-400 text-[11px] leading-tight">{label}</p>
                                        <Chip color={color} icon={icon} />
                                    </div>
                                    <p className="text-lg font-bold mt-1 truncate text-white">{value}</p>
                                    {typeof bar === "number" && (
                                        <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-orange-600 to-orange-400 rounded-full transition-all duration-500"
                                                style={{ width: `${bar}%` }}
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Body — 3 columns: Profile | AI Insights | Channels + Chat */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-3 flex-1 min-h-0 pb-1">
                            {/* Profile */}
                            <div className={`${CARD} p-4 flex flex-col min-h-0`}>
                                <div className="flex items-center gap-3 shrink-0">
                                    <div className="h-12 w-12 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-xl font-bold shrink-0">
                                        {initial}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-base font-bold text-white truncate">{lead.user_name || "Unnamed Lead"}</h3>
                                        <p className="text-gray-400 text-xs truncate flex items-center gap-1">
                                            <MapPin size={11} /> {lead.lead_source || "—"} · {lead.country || "—"}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-4 space-y-2 text-xs overflow-y-auto min-h-0">
                                    <div className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 ${
                                        !lead.user_email && aiContactLookup.email
                                            ? "bg-purple-500/[0.06] border border-dashed border-purple-500/40"
                                            : "bg-white/[0.03] border border-white/5"
                                    }`}>
                                        <Chip color={!lead.user_email && aiContactLookup.email ? "purple" : "orange"} icon={Mail} size={13} />
                                        {lead.user_email ? (
                                            <span className="text-gray-300 break-all">{lead.user_email}</span>
                                        ) : contactLookupLoading ? (
                                            <span className="text-gray-500 flex items-center gap-1.5">
                                                <Loader2 size={11} className="animate-spin" /> AI searching...
                                            </span>
                                        ) : aiContactLookup.email ? (
                                            <span className="min-w-0">
                                                <span className="text-purple-300 break-all">{aiContactLookup.email}</span>
                                                <span className="block text-[10px] text-purple-400/70 mt-0.5">AI suggested · unverified</span>
                                            </span>
                                        ) : (
                                            <span className="text-gray-300">—</span>
                                        )}
                                    </div>
                                    <div className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 ${
                                        !lead.user_mobile_number && aiContactLookup.phone
                                            ? "bg-purple-500/[0.06] border border-dashed border-purple-500/40"
                                            : "bg-white/[0.03] border border-white/5"
                                    }`}>
                                        <Chip color={!lead.user_mobile_number && aiContactLookup.phone ? "purple" : "blue"} icon={Phone} size={13} />
                                        {lead.user_mobile_number ? (
                                            <span className="text-gray-300">{lead.user_mobile_number}</span>
                                        ) : contactLookupLoading ? (
                                            <span className="text-gray-500 flex items-center gap-1.5">
                                                <Loader2 size={11} className="animate-spin" /> AI searching...
                                            </span>
                                        ) : aiContactLookup.phone ? (
                                            <span className="min-w-0">
                                                <span className="text-purple-300">{aiContactLookup.phone}</span>
                                                <span className="block text-[10px] text-purple-400/70 mt-0.5">AI suggested · unverified</span>
                                            </span>
                                        ) : (
                                            <span className="text-gray-300">—</span>
                                        )}
                                    </div>
                                    {(aiContactLookup.email || aiContactLookup.phone) && contactLookupNote && (
                                        <p className="text-[10px] text-gray-500 px-1 leading-snug">{contactLookupNote}</p>
                                    )}
                                    {contactLookupError && (
                                        <p className="text-[10px] text-red-400 px-1 flex items-center gap-2">
                                            {contactLookupError}
                                            <button
                                                type="button"
                                                onClick={() => findMissingContactInfo(lead)}
                                                className="text-orange-400 hover:text-orange-300 underline"
                                            >
                                                Retry
                                            </button>
                                        </p>
                                    )}
                                    <div className="flex items-center gap-2.5 bg-white/[0.03] border border-white/5 rounded-lg px-2.5 py-2">
                                        <Chip color="purple" icon={MapPin} size={13} />
                                        <span className="text-gray-300 break-words">{lead.user_address || "—"}</span>
                                    </div>
                                    <div className="flex items-center gap-2.5 bg-white/[0.03] border border-white/5 rounded-lg px-2.5 py-2">
                                        <Chip color="green" icon={ShieldAlert} size={13} />
                                        <span className="text-gray-300">GMB: {lead.gmb_status || "—"}</span>
                                    </div>
                                    <div className="flex items-center gap-2.5 bg-white/[0.03] border border-white/5 rounded-lg px-2.5 py-2">
                                        <Chip color="orange" icon={Tag} size={13} />
                                        <span className="text-gray-300">Status: {lead.current_status || "—"}</span>
                                    </div>
                                    {lead.web_url ? (
                                        <a
                                            href={lead.web_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex items-center gap-2.5 bg-white/[0.03] border border-white/5 rounded-lg px-2.5 py-2 hover:border-orange-500/30 transition"
                                        >
                                            <Chip color="blue" icon={Globe} size={13} />
                                            <span className="text-orange-400 truncate hover:underline">{lead.web_url}</span>
                                        </a>
                                    ) : (
                                        <div className="flex items-center gap-2.5 bg-white/[0.03] border border-white/5 rounded-lg px-2.5 py-2">
                                            <Chip color="blue" icon={Globe} size={13} />
                                            <span className="text-gray-300">—</span>
                                        </div>
                                    )}
                                    {lead.linkedin_url && (
                                        <a
                                            href={lead.linkedin_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="flex items-center gap-2.5 bg-white/[0.03] border border-white/5 rounded-lg px-2.5 py-2 hover:border-orange-500/30 transition"
                                        >
                                            <Chip color="purple" icon={Link} size={13} />
                                            <span className="text-orange-400 truncate hover:underline">{lead.linkedin_url}</span>
                                        </a>
                                    )}

                                    {/* AI Search prospect enrichment — populated only for leads
                                        discovered via Lead Generation's AI Search, blank for
                                        manually-added leads, so this whole block only renders
                                        when at least one of these fields is actually present. */}
                                    {(lead.decision_maker || lead.industry || lead.company_size ||
                                        lead.estimated_scale || lead.technology_used || lead.pain_points ||
                                        lead.reason) && (
                                        <>
                                            <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold pt-2">
                                                AI Prospect Research
                                            </p>
                                            {lead.decision_maker && (
                                                <div className="flex items-center gap-2.5 bg-white/[0.03] border border-white/5 rounded-lg px-2.5 py-2">
                                                    <Chip color="orange" icon={User} size={13} />
                                                    <span className="text-gray-300 truncate">
                                                        {lead.decision_maker}
                                                        {lead.designation ? ` · ${lead.designation}` : ""}
                                                    </span>
                                                </div>
                                            )}
                                            {lead.industry && (
                                                <div className="flex items-center gap-2.5 bg-white/[0.03] border border-white/5 rounded-lg px-2.5 py-2">
                                                    <Chip color="blue" icon={Building2} size={13} />
                                                    <span className="text-gray-300 truncate">{lead.industry}</span>
                                                </div>
                                            )}
                                            {(lead.company_size || lead.estimated_scale) && (
                                                <div className="flex items-center gap-2.5 bg-white/[0.03] border border-white/5 rounded-lg px-2.5 py-2">
                                                    <Chip color="green" icon={Building2} size={13} />
                                                    <span className="text-gray-300 truncate">
                                                        {[lead.company_size, lead.estimated_scale].filter(Boolean).join(" · ")}
                                                    </span>
                                                </div>
                                            )}
                                            {lead.technology_used && (
                                                <div className="flex items-start gap-2.5 bg-white/[0.03] border border-white/5 rounded-lg px-2.5 py-2">
                                                    <Chip color="purple" icon={Cpu} size={13} />
                                                    <span className="text-gray-300 leading-snug">{lead.technology_used}</span>
                                                </div>
                                            )}
                                            {lead.pain_points && (
                                                <div className="flex items-start gap-2.5 bg-white/[0.03] border border-white/5 rounded-lg px-2.5 py-2">
                                                    <Chip color="rose" icon={AlertTriangle} size={13} />
                                                    <span className="text-gray-300 leading-snug">{lead.pain_points}</span>
                                                </div>
                                            )}
                                            {lead.reason && (
                                                <div className="flex items-start gap-2.5 bg-white/[0.03] border border-white/5 rounded-lg px-2.5 py-2">
                                                    <Chip color="orange" icon={Lightbulb} size={13} />
                                                    <span className="text-gray-300 leading-snug">{lead.reason}</span>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>

                            </div>

                            {/* AI Insights */}
                            <div className={`${CARD} p-4 flex flex-col min-h-0`}>
                                <div className="flex items-center justify-between shrink-0">
                                    <h3 className="text-sm font-bold text-white">AI Customer Insights</h3>
                                    <button
                                        onClick={() => generateInsights(lead)}
                                        disabled={insightsLoading}
                                        title="Regenerate"
                                        className="text-gray-500 hover:text-orange-400 transition disabled:opacity-50"
                                    >
                                        <RefreshCw size={13} className={insightsLoading ? "animate-spin" : ""} />
                                    </button>
                                </div>
                                <div className="space-y-2 mt-3 overflow-y-auto min-h-0">
                                    {insightsLoading ? (
                                        <div className="flex items-center gap-2 text-gray-400 text-xs p-2.5">
                                            <Loader2 size={13} className="animate-spin" /> Generating...
                                        </div>
                                    ) : (
                                        insights.map((item, index) => (
                                            <div key={index} className="flex items-start gap-2.5 bg-white/[0.03] border border-white/5 rounded-lg p-2.5">
                                                <Chip color={item.color} icon={item.icon} size={13} />
                                                <p className="text-xs text-gray-200 leading-snug pt-1">{item.text}</p>
                                            </div>
                                        ))
                                    )}
                                    {insightsError && <p className="text-[11px] text-red-400 px-1">{insightsError}</p>}
                                    {lead.prospect_comment && (
                                        <div className="flex items-start gap-2.5 bg-white/[0.03] border border-white/5 rounded-lg p-2.5">
                                            <Chip color="blue" icon={MessageSquare} size={13} />
                                            <p className="text-xs text-gray-200 leading-snug pt-1">Comment: {lead.prospect_comment}</p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Channels (4 uniform clickable cards) + AI Chat below them */}
                            <div className={`${CARD} p-4 flex flex-col min-h-0`}>
                                <h3 className="text-sm font-bold text-white shrink-0">Reachable Channels</h3>
                                

                                <div className="grid grid-cols-2 gap-2.5 mt-3 shrink-0">
                                    {channelConfig.map(({ key, label, icon: Icon, color }) => {
                                        const enabled = isChannelEnabled(key);
                                        return (
                                            <button
                                                key={key}
                                                type="button"
                                                onClick={() => openChannel(key)}
                                                disabled={!enabled}
                                                className={`relative rounded-xl py-3 flex flex-col items-center justify-center gap-1.5 text-xs border transition ${
                                                    enabled
                                                        ? `${chipColors[color]} hover:brightness-125 cursor-pointer`
                                                        : "bg-white/[0.02] border-white/5 text-gray-600 cursor-not-allowed opacity-50"
                                                }`}
                                            >
                                                {customMsgs[key] && (
                                                    <span className="absolute top-1.5 right-1.5 h-1.5 w-1.5 rounded-full bg-orange-400" title="Using AI-drafted message" />
                                                )}
                                                <Icon size={16} />
                                                <span className={enabled ? "text-white" : ""}>{label}</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Use last AI reply as a channel's message */}
                                <div className="flex items-center gap-1.5 mt-3 shrink-0">
                                    {["sms", "whatsapp", "email"].map((key) => (
                                        <button
                                            key={key}
                                            type="button"
                                            onClick={() => useAsDraft(key)}
                                            disabled={!lastAssistantMessage}
                                            className="flex-1 flex items-center justify-center gap-1 text-[10px] px-2 py-1.5 rounded-lg border border-white/10 text-gray-400 hover:text-white hover:border-orange-500/40 disabled:opacity-30 disabled:cursor-not-allowed transition"
                                        >
                                            {savedFlash === key ? (
                                                <>
                                                    <Check size={11} className="text-green-400" /> Saved
                                                </>
                                            ) : (
                                                `Use AI reply for ${key === "sms" ? "SMS" : key === "whatsapp" ? "WhatsApp" : "Email"}`
                                            )}
                                        </button>
                                    ))}
                                </div>

                                {/* AI Chat */}
                                <div className="mt-3 flex-1 min-h-0 border border-white/10 rounded-xl overflow-hidden flex flex-col">
                                    <button
                                        type="button"
                                        onClick={() => setIsChatExpanded(true)}
                                        className="flex items-center gap-2 px-3 py-2.5 border-b border-white/10 shrink-0 w-full text-left hover:bg-white/[0.03] transition group"
                                        title="Expand chat"
                                    >
                                        <Chip color="purple" icon={MessageSquare} size={13} />
                                        <span className="text-xs font-bold text-white truncate flex-1">
                                            Ask AI about {lead.user_name || "this lead"}
                                        </span>
                                        <Maximize2 size={13} className="text-gray-500 group-hover:text-orange-400 transition shrink-0" />
                                    </button>
                                    {/* Clicking/focusing the search bar also pops the chat open big */}
                                    <div className="flex-1 min-h-0" onFocusCapture={() => setIsChatExpanded(true)}>
                                        <ChatPanel
                                            heightClass="flex-1"
                                            messages={messages}
                                            isLoading={isLoading}
                                            onSend={askAiAboutLead}
                                            emptyStateHint={`Ask AI to draft an SMS, WhatsApp or email for ${lead.user_name || "this lead"}, then save it above.`}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Expanded "Ask AI" chat modal — pops open big when the header
                or the search bar inside ChatPanel is clicked/focused. Reuses
                the same messages/isLoading/sendMessage state as the compact
                card, so the conversation stays in sync either way. */}
            {isChatExpanded && lead && (
                <div
                    className="fixed inset-0 z-[998] flex items-center justify-center bg-black/70 px-4 py-8"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setIsChatExpanded(false);
                    }}
                >
                    <div className="bg-[#0d0d10] border border-orange-600/30 rounded-2xl w-full max-w-2xl h-[80vh] flex flex-col shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9)]">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
                            <div className="flex items-center gap-2.5">
                                <Chip color="purple" icon={MessageSquare} size={16} />
                                <h4 className="text-white font-bold text-base">
                                    Ask AI about {lead.user_name || "this lead"}
                                </h4>
                            </div>
                            <button
                                onClick={() => setIsChatExpanded(false)}
                                className="text-gray-400 hover:text-white transition"
                                title="Close"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <div className="flex-1 min-h-0">
                            <ChatPanel
                                heightClass="h-full"
                                messages={messages}
                                isLoading={isLoading}
                                onSend={askAiAboutLead}
                                emptyStateHint={`Ask AI to draft an SMS, WhatsApp or email for ${lead.user_name || "this lead"}, then save it above.`}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Compose modal — shared by Email / SMS / WhatsApp. Recipient,
                subject (email) and message are pre-filled from the lead but
                fully editable before anything actually goes out. */}
            {composeChannel && lead && (() => {
                const meta = {
                    email: { label: "Email", icon: Mail, color: "orange", toLabel: "To", toPlaceholder: "recipient@email.com", toType: "email" },
                    sms: { label: "SMS", icon: Phone, color: "blue", toLabel: "To (phone)", toPlaceholder: "Phone number", toType: "tel" },
                    whatsapp: { label: "WhatsApp", icon: MessageSquare, color: "green", toLabel: "To (phone)", toPlaceholder: "Phone number, e.g. 91XXXXXXXXXX", toType: "tel" },
                }[composeChannel];

                const sendDisabled =
                    !composeTo.trim() || (composeChannel === "email" && emailSending);

                return (
                    <div className="fixed inset-0 z-[998] flex items-center justify-center bg-black/70 px-4 py-8">
                        <div className="bg-[#0d0d10] border border-orange-600/30 rounded-2xl p-10 max-w-3xl w-full shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9)]">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Chip color={meta.color} icon={meta.icon} size={20} />
                                    <h4 className="text-white font-bold text-xl">Send {meta.label}</h4>
                                </div>
                                <button onClick={closeCompose} className="text-gray-400 hover:text-white" disabled={emailSending}>
                                    <X size={24} />
                                </button>
                            </div>

                            <div className="mt-7 space-y-3 text-base">
                                {composeToIsAiGuess && (
                                    <div className="flex items-start gap-2.5 bg-purple-500/10 border border-dashed border-purple-500/40 rounded-lg px-4 py-3">
                                        <AlertTriangle size={15} className="text-purple-300 shrink-0 mt-0.5" />
                                        <p className="text-xs text-purple-200 leading-snug">
                                            This recipient was AI-suggested, not from a verified record. Please
                                            double-check it's correct before sending.
                                        </p>
                                    </div>
                                )}
                                <div className="flex items-center gap-3 bg-white/5 rounded-lg px-5 py-3.5">
                                    <span className="text-gray-400 shrink-0 text-sm">{meta.toLabel}</span>
                                    <input
                                        type={meta.toType}
                                        value={composeTo}
                                        onChange={(e) => {
                                            setComposeTo(e.target.value);
                                            setComposeToIsAiGuess(false);
                                        }}
                                        placeholder={meta.toPlaceholder}
                                        className="flex-1 bg-transparent text-white font-medium text-right outline-none placeholder:text-gray-600 placeholder:font-normal"
                                    />
                                </div>

                                {composeChannel === "email" && (
                                    <>
                                        <div className="flex justify-between bg-white/5 rounded-lg px-5 py-3.5">
                                            <span className="text-gray-400 text-sm">From</span>
                                            <span className="text-white font-medium">{SEND_FROM_ADDRESS}</span>
                                        </div>
                                        <div className="flex items-center gap-3 bg-white/5 rounded-lg px-5 py-3.5">
                                            <span className="text-gray-400 shrink-0 text-sm">Subject</span>
                                            <input
                                                type="text"
                                                value={composeSubject}
                                                onChange={(e) => setComposeSubject(e.target.value)}
                                                className="flex-1 bg-transparent text-white font-medium text-right outline-none"
                                            />
                                        </div>
                                    </>
                                )}

                                <div>
                                    <label className="text-gray-400 text-sm mb-1.5 block">Message</label>
                                    <textarea
                                        value={composeBody}
                                        onChange={(e) => setComposeBody(e.target.value)}
                                        rows={12}
                                        className="w-full bg-white/5 rounded-lg px-5 py-4 max-h-96 overflow-y-auto whitespace-pre-wrap text-gray-100 text-sm leading-relaxed outline-none resize-y focus:ring-1 focus:ring-orange-500/40"
                                    />
                                </div>
                            </div>

                            {composeChannel === "email" && emailResult && (
                                <div
                                    className={`mt-4 flex items-center gap-2 text-sm rounded-lg px-5 py-3.5 border ${
                                        emailResult.type === "success"
                                            ? "bg-green-500/10 border-green-500/30 text-green-400"
                                            : "bg-red-500/10 border-red-500/30 text-red-400"
                                    }`}
                                >
                                    {emailResult.type === "success" ? <Check size={16} /> : <AlertTriangle size={16} />}
                                    {emailResult.text}
                                </div>
                            )}

                            <div className="flex items-center gap-4 mt-7">
                                <button
                                    onClick={closeCompose}
                                    disabled={emailSending}
                                    className="flex-1 py-3.5 rounded-xl text-sm font-semibold text-gray-300 border border-white/10 hover:border-white/30 transition disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleComposeSend}
                                    disabled={sendDisabled}
                                    className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold bg-orange-500 hover:bg-orange-600 text-black transition disabled:opacity-60"
                                >
                                    {composeChannel === "email" && emailSending ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" /> Sending...
                                        </>
                                    ) : (
                                        <>
                                            <Send size={16} />
                                            {composeChannel === "email" ? "Send" : composeChannel === "sms" ? "Send SMS" : "Open WhatsApp"}
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* Toast */}
            {toast && (
                <div
                    className={`fixed bottom-6 right-6 z-[999] flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium shadow-lg border ${
                        toast.type === "success"
                            ? "bg-green-500/15 border-green-500/40 text-green-400"
                            : "bg-red-500/15 border-red-500/40 text-red-400"
                    }`}
                >
                    {toast.type === "success" ? <Check size={16} /> : <AlertTriangle size={16} />}
                    {toast.text}
                </div>
            )}
        </section>
    );
};

export default Customer360Section;