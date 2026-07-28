import React, { useMemo, useState } from "react";
import {
    Sparkles,
    MessageSquare,
    Mail,
    Phone,
    PhoneCall,
    Check,
    X,
    Send,
    AlertTriangle,
    Loader2,
} from "lucide-react";
import ChatPanel from "./ChatPanel";
import { useGroqChat } from "./useGroqChat";
import { useCustomerData } from "./CustomerDataContext";

// Same growthos_backend (main.py) instance used everywhere else —
// keep this in sync with Lead_Management.jsx / CustomerDataContext.jsx.
const API_BASE_URL = "http://localhost:8000";
const SEND_EMAIL_ENDPOINT = `${API_BASE_URL}/send-email`;
const SEND_SMS_ENDPOINT = `${API_BASE_URL}/send-sms`;
const SEND_WHATSAPP_ENDPOINT = `${API_BASE_URL}/send-whatsapp`;
const markContactedEndpoint = (leadId) => `${API_BASE_URL}/leads/${leadId}/mark-contacted`;

// Same pattern as Lead_Management.jsx/Home.jsx — mark-contacted is a
// company-scoped, auth-required endpoint.
const authHeaders = () => {
    const token = localStorage.getItem("growthos_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
};

/* ==========================================================
   REACHABLE CHANNELS CARD
   Extracted from Customer360Section.jsx so it can be reused
   anywhere a single lead's outreach actions are needed — e.g.
   the Lead Management double-click modal. Self-contained: owns
   its own chat session, AI-draft state and email confirm modal.
   Takes one prop: `lead` (same shape as CustomerDataContext rows).
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
    <div className={`h-8 w-8 rounded-lg border flex items-center justify-center shrink-0 ${chipColors[color]}`}>
        <Icon size={size} />
    </div>
);

const smsTemplate = (name) =>
    `Hi ${name},\nThank you for connecting with GrowthOS AI.\nYour inquiry has been received successfully.\nOur team will contact you soon for a free demo.\nVisit: https://isfathena.com/\n- GrowthOS AI Team`;

const whatsappTemplate = (name) =>
    `👋 Hello ${name},\nThank you for your interest in GrowthOS AI.\nWe received your request and our AI has analyzed your business requirements.\n🚀 GrowthOS AI can help you with:\n• Lead Generation\n• CRM Management\n• Marketing Automation\n• AI WhatsApp Campaigns\n• Email Marketing\n• Customer Analytics\nOur team will contact you shortly for a free demo.\nVisit: https://isfathena.com/\nIf you have any questions, simply reply to this message.\nThank you,\nGrowthOS AI Team`;

const emailBodyTemplate = (name) =>
    `Dear ${name},\n\nThank you for showing interest in GrowthOS AI.\nWe have successfully received your request.\n\nOur AI platform is designed to help businesses with:\n• Lead Generation\n• CRM Management\n• AI Marketing Automation\n• WhatsApp Campaigns\n• Email Campaigns\n• Customer Analytics\n\nOne of our experts will contact you shortly to understand your business requirements and schedule a personalized demo.\n\nIf you have any questions, simply reply to this email.\n\nThank you for choosing GrowthOS AI.\n\nBest Regards,\nGrowthOS AI Team\nAutonomous Revenue Platform\nhttps://isfathena.com/`;

const EMAIL_SUBJECT = "Thank you for your interest in GrowthOS AI";

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

const ReachableChannelsCard = ({ lead }) => {
    const { messages, isLoading, sendMessage } = useGroqChat();
    const { fetchLeads } = useCustomerData();

    const [customMsgs, setCustomMsgs] = useState({});
    const [savedFlash, setSavedFlash] = useState("");

    // Flips this lead from "Due" to "Contacted" in Lead Management —
    // called after any successful Email/SMS/WhatsApp send, or a Call
    // attempt. Best-effort: a failure here doesn't block the actual
    // send/call, it just won't update the status badge until retried.
    const markContacted = async () => {
        if (!lead?.id) return;
        try {
            const res = await fetch(markContactedEndpoint(lead.id), { method: "POST", headers: authHeaders() });
            if (!res.ok) {
                console.error(`mark-contacted failed with status ${res.status} — is the backend running the latest main.py?`);
                return;
            }
            fetchLeads();
        } catch (err) {
            // Doesn't block the send/call itself — just won't flip the
            // status badge this time. Logged so it's visible in devtools
            // instead of failing invisibly.
            console.error("mark-contacted request failed:", err);
        }
    };

    const [emailModalOpen, setEmailModalOpen] = useState(false);
    const [emailSending, setEmailSending] = useState(false);
    const [emailResult, setEmailResult] = useState(null);

    // Editable copy of the To/Subject/Message shown in the compose modal —
    // pre-filled from the lead/default template but the user can change any
    // of it right up until they hit Send.
    const [composeTo, setComposeTo] = useState("");
    const [composeSubject, setComposeSubject] = useState("");
    const [composeBody, setComposeBody] = useState("");

    const [smsModalOpen, setSmsModalOpen] = useState(false);
    const [smsSending, setSmsSending] = useState(false);
    const [smsResult, setSmsResult] = useState(null);

    const [waModalOpen, setWaModalOpen] = useState(false);
    const [waSending, setWaSending] = useState(false);
    const [waResult, setWaResult] = useState(null);

    const [toast, setToast] = useState(null);

    const name = lead?.user_name || "there";

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

    const openChannel = (channelKey) => {
        if (!lead) return;

        if (channelKey === "email") {
            setEmailResult(null);
            setComposeTo(lead.user_email || "");
            setComposeSubject(EMAIL_SUBJECT);
            setComposeBody(messageFor("email"));
            setEmailModalOpen(true);
            return;
        }

        if (channelKey === "sms") {
            setSmsResult(null);
            setSmsModalOpen(true);
            return;
        }

        if (channelKey === "whatsapp") {
            setWaResult(null);
            setWaModalOpen(true);
            return;
        }

        const message = messageFor(channelKey);

        if (channelKey === "call") {
            const phone = digitsOnly(lead.user_mobile_number);
            if (!phone) return;
            window.location.href = `tel:${phone}`;
            markContacted();
        }
    };

    // Sends via growthos_backend's /send-email (real SMTP, no third-party
    // service) instead of opening a mail client.
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
                    lead_id: lead?.id,
                }),
            });
            const data = await res.json().catch(() => null);

            if (!res.ok || !data?.success) {
                throw new Error(data?.error || "send failed");
            }

            setEmailResult({ type: "success", text: `Email sent to ${toAddress}` });
            markContacted();
            showToast("success", `✓ Email sent to ${toAddress}`);
            setTimeout(() => setEmailModalOpen(false), 1100);
        } catch (err) {
            // Any backend/SMTP failure (bad host/port/credentials, network
            // issue, blocked CORS origin) surfaces as this single message.
            setEmailResult({ type: "error", text: "Provider information is not correct." });
        } finally {
            setEmailSending(false);
        }
    };

    // Sends via growthos_backend's /send-sms (Fast2SMS Quick SMS route).
    const confirmSendSMS = async () => {
        if (!lead?.user_mobile_number) return;

        setSmsSending(true);
        setSmsResult(null);
        try {
            const res = await fetch(SEND_SMS_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    to_number: digitsOnly(lead.user_mobile_number),
                    message: messageFor("sms"),
                    lead_id: lead?.id,
                }),
            });
            const data = await res.json().catch(() => null);

            if (!res.ok || !data?.success) {
                throw new Error(data?.error || "send failed");
            }

            setSmsResult({ type: "success", text: `SMS sent to ${lead.user_mobile_number}` });
            markContacted();
            showToast("success", `✓ SMS sent to ${lead.user_mobile_number}`);
            setTimeout(() => setSmsModalOpen(false), 1100);
        } catch (err) {
            setSmsResult({ type: "error", text: "Provider information is not correct." });
        } finally {
            setSmsSending(false);
        }
    };

    // Sends via growthos_backend's /send-whatsapp (Meta WhatsApp Cloud API,
    // approved template message) — no wa.me tab opens.
    const confirmSendWhatsApp = async () => {
        if (!lead?.user_mobile_number) return;

        const phone = digitsOnly(lead.user_mobile_number);
        const dial = dialCodeForCountry(lead.country);
        const waNumber = dial && !phone.startsWith(dial) ? `${dial}${phone}` : phone;

        setWaSending(true);
        setWaResult(null);
        try {
            const res = await fetch(SEND_WHATSAPP_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    to_number: waNumber,
                    name,
                    lead_id: lead?.id,
                    message_for_log: messageFor("whatsapp"),
                }),
            });
            const data = await res.json().catch(() => null);

            if (!res.ok || !data?.success) {
                throw new Error(data?.error || "send failed");
            }

            setWaResult({ type: "success", text: `WhatsApp sent to ${lead.user_mobile_number}` });
            markContacted();
            showToast("success", `✓ WhatsApp sent to ${lead.user_mobile_number}`);
            setTimeout(() => setWaModalOpen(false), 1100);
        } catch (err) {
            setWaResult({ type: "error", text: "Provider information is not correct." });
        } finally {
            setWaSending(false);
        }
    };

    const isChannelEnabled = (channelKey) => {
        if (!lead) return false;
        if (channelKey === "email") return true; // recipient is editable in the compose modal
        return !!lead.user_mobile_number;
    };

    return (
        <>
            <div className={`${CARD} p-4 flex flex-col min-h-0 h-full`}>
                <h3 className="text-sm font-bold text-white shrink-0">Reachable Channels</h3>
                <p className="text-[10px] text-gray-500 mt-0.5 shrink-0">
                    Email, SMS & WhatsApp send in-app. Call opens your device's dialer.
                </p>

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
                    <div className="flex items-center gap-2 px-3 py-2.5 border-b border-white/10 shrink-0">
                        <Chip color="purple" icon={MessageSquare} size={13} />
                        <span className="text-xs font-bold text-white truncate">
                            Ask AI about {lead?.user_name || "this lead"}
                        </span>
                    </div>
                    <ChatPanel
                        heightClass="flex-1"
                        messages={messages}
                        isLoading={isLoading}
                        onSend={sendMessage}
                        emptyStateHint={`Ask AI to draft an SMS, WhatsApp or email for ${lead?.user_name || "this lead"}, then save it above.`}
                    />
                </div>
            </div>

            {/* Email compose modal — To/Subject/Message are all editable */}
            {emailModalOpen && lead && (
                <div className="fixed inset-0 z-[1998] flex items-center justify-center bg-black/70 px-4 py-8">
                    <div className="bg-[#0d0d10] border border-orange-600/30 rounded-2xl p-6 max-w-xl w-full max-h-[85vh] overflow-y-auto shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9)]">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Chip color="orange" icon={Mail} size={14} />
                                <h4 className="text-white font-bold text-sm">Send Email</h4>
                            </div>
                            <button
                                onClick={() => setEmailModalOpen(false)}
                                className="text-gray-400 hover:text-white"
                                disabled={emailSending}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="mt-4 space-y-2 text-xs">
                            <div className="flex items-center gap-3 bg-white/5 rounded-lg px-3 py-2.5">
                                <span className="text-gray-400 shrink-0">To</span>
                                <input
                                    type="email"
                                    value={composeTo}
                                    onChange={(e) => setComposeTo(e.target.value)}
                                    placeholder="recipient@email.com"
                                    className="flex-1 bg-transparent text-white font-medium text-right outline-none placeholder:text-gray-600 placeholder:font-normal"
                                />
                            </div>
                            <div className="flex justify-between bg-white/5 rounded-lg px-3 py-2.5">
                                <span className="text-gray-400">From</span>
                                <span className="text-white font-medium">isfinformaticaanalytica@gmail.com</span>
                            </div>
                            <div className="flex items-center gap-3 bg-white/5 rounded-lg px-3 py-2.5">
                                <span className="text-gray-400 shrink-0">Subject</span>
                                <input
                                    type="text"
                                    value={composeSubject}
                                    onChange={(e) => setComposeSubject(e.target.value)}
                                    className="flex-1 bg-transparent text-white font-medium text-right outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-gray-400 text-xs mb-1.5 block">Message</label>
                                <textarea
                                    value={composeBody}
                                    onChange={(e) => setComposeBody(e.target.value)}
                                    rows={10}
                                    className="w-full bg-white/5 rounded-lg px-3 py-2.5 max-h-72 overflow-y-auto whitespace-pre-wrap text-gray-100 text-xs leading-relaxed outline-none resize-y focus:ring-1 focus:ring-orange-500/40"
                                />
                            </div>
                        </div>

                        {emailResult && (
                            <div
                                className={`mt-3 flex items-center gap-2 text-xs rounded-lg px-3 py-2 border ${
                                    emailResult.type === "success"
                                        ? "bg-green-500/10 border-green-500/30 text-green-400"
                                        : "bg-red-500/10 border-red-500/30 text-red-400"
                                }`}
                            >
                                {emailResult.type === "success" ? <Check size={14} /> : <AlertTriangle size={14} />}
                                {emailResult.text}
                            </div>
                        )}

                        <div className="flex items-center gap-3 mt-4">
                            <button
                                onClick={() => setEmailModalOpen(false)}
                                disabled={emailSending}
                                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-gray-300 border border-white/10 hover:border-white/30 transition disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmSendEmail}
                                disabled={emailSending || !composeTo.trim()}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold bg-orange-500 hover:bg-orange-600 text-black transition disabled:opacity-60"
                            >
                                {emailSending ? (
                                    <>
                                        <Loader2 size={13} className="animate-spin" /> Sending...
                                    </>
                                ) : (
                                    <>
                                        <Send size={13} /> Send
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* SMS confirm-before-send modal */}
            {smsModalOpen && lead && (
                <div className="fixed inset-0 z-[1998] flex items-center justify-center bg-black/70 px-4">
                    <div className="bg-[#0d0d10] border border-orange-600/30 rounded-2xl p-5 max-w-md w-full shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9)]">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Chip color="blue" icon={Phone} size={14} />
                                <h4 className="text-white font-bold text-sm">Send SMS</h4>
                            </div>
                            <button
                                onClick={() => setSmsModalOpen(false)}
                                className="text-gray-400 hover:text-white"
                                disabled={smsSending}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="mt-4 space-y-2 text-xs">
                            <div className="flex justify-between bg-white/5 rounded-lg px-3 py-2">
                                <span className="text-gray-400">To</span>
                                <span className="text-white font-medium">{lead.user_mobile_number}</span>
                            </div>
                            <div className="bg-white/5 rounded-lg px-3 py-2 max-h-32 overflow-y-auto whitespace-pre-wrap text-gray-300">
                                {messageFor("sms")}
                            </div>
                        </div>

                        {smsResult && (
                            <div
                                className={`mt-3 flex items-center gap-2 text-xs rounded-lg px-3 py-2 border ${
                                    smsResult.type === "success"
                                        ? "bg-green-500/10 border-green-500/30 text-green-400"
                                        : "bg-red-500/10 border-red-500/30 text-red-400"
                                }`}
                            >
                                {smsResult.type === "success" ? <Check size={14} /> : <AlertTriangle size={14} />}
                                {smsResult.text}
                            </div>
                        )}

                        <div className="flex items-center gap-3 mt-4">
                            <button
                                onClick={() => setSmsModalOpen(false)}
                                disabled={smsSending}
                                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-gray-300 border border-white/10 hover:border-white/30 transition disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmSendSMS}
                                disabled={smsSending}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold bg-orange-500 hover:bg-orange-600 text-black transition disabled:opacity-60"
                            >
                                {smsSending ? (
                                    <>
                                        <Loader2 size={13} className="animate-spin" /> Sending...
                                    </>
                                ) : (
                                    <>
                                        <Send size={13} /> Send
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* WhatsApp confirm-before-send modal */}
            {waModalOpen && lead && (
                <div className="fixed inset-0 z-[1998] flex items-center justify-center bg-black/70 px-4">
                    <div className="bg-[#0d0d10] border border-orange-600/30 rounded-2xl p-5 max-w-md w-full shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9)]">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Chip color="green" icon={MessageSquare} size={14} />
                                <h4 className="text-white font-bold text-sm">Send WhatsApp</h4>
                            </div>
                            <button
                                onClick={() => setWaModalOpen(false)}
                                className="text-gray-400 hover:text-white"
                                disabled={waSending}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="mt-4 space-y-2 text-xs">
                            <div className="flex justify-between bg-white/5 rounded-lg px-3 py-2">
                                <span className="text-gray-400">To</span>
                                <span className="text-white font-medium">{lead.user_mobile_number}</span>
                            </div>
                            <div className="bg-white/5 rounded-lg px-3 py-2 text-gray-300">
                                Sends the approved <span className="text-white font-medium">growthos_intro</span> template
                                to <span className="text-white font-medium">{name}</span> via Meta WhatsApp Cloud API.
                            </div>
                            <div className="bg-white/5 rounded-lg px-3 py-2 max-h-32 overflow-y-auto whitespace-pre-wrap text-gray-300">
                                {messageFor("whatsapp")}
                            </div>
                        </div>

                        {waResult && (
                            <div
                                className={`mt-3 flex items-center gap-2 text-xs rounded-lg px-3 py-2 border ${
                                    waResult.type === "success"
                                        ? "bg-green-500/10 border-green-500/30 text-green-400"
                                        : "bg-red-500/10 border-red-500/30 text-red-400"
                                }`}
                            >
                                {waResult.type === "success" ? <Check size={14} /> : <AlertTriangle size={14} />}
                                {waResult.text}
                            </div>
                        )}

                        <div className="flex items-center gap-3 mt-4">
                            <button
                                onClick={() => setWaModalOpen(false)}
                                disabled={waSending}
                                className="flex-1 py-2.5 rounded-xl text-xs font-semibold text-gray-300 border border-white/10 hover:border-white/30 transition disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmSendWhatsApp}
                                disabled={waSending}
                                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold bg-orange-500 hover:bg-orange-600 text-black transition disabled:opacity-60"
                            >
                                {waSending ? (
                                    <>
                                        <Loader2 size={13} className="animate-spin" /> Sending...
                                    </>
                                ) : (
                                    <>
                                        <Send size={13} /> Send
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Toast */}
            {toast && (
                <div
                    className={`fixed bottom-6 right-6 z-[1999] flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium shadow-lg border ${
                        toast.type === "success"
                            ? "bg-green-500/15 border-green-500/40 text-green-400"
                            : "bg-red-500/15 border-red-500/40 text-red-400"
                    }`}
                >
                    {toast.type === "success" ? <Check size={16} /> : <AlertTriangle size={16} />}
                    {toast.text}
                </div>
            )}
        </>
    );
};

export default ReachableChannelsCard;