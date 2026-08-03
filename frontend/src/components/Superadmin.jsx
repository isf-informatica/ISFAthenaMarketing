import React, { useState, useEffect, useMemo, useRef, createContext, useContext } from "react";
import { createPortal } from "react-dom";
import {
    TrendingUp,
    LayoutDashboard,
    Building2,
    Target,
    Menu,
    X,
    Search,
    Plus,
    Loader2,
    Mail,
    Phone,
    Globe,
    MapPin,
    Briefcase,
    ChevronDown,
    CreditCard,
    CheckCircle2,
    Sparkles,
    Inbox,
    Upload,
    Trash2,
    Pencil,
    MessageSquare,
    PhoneCall,
    Send,
    AlertTriangle,
    Users,
    Clock,
    ShieldAlert,
    Check,
    RefreshCw,
    Tag,
    Link,
    User,
    Cpu,
    Lightbulb,
    Maximize2,
    Package,
    Code2,
    ShoppingCart,
    GraduationCap,
    HeartPulse,
    Landmark,
    Factory,
    Store,
    Plane,
    Car,
    Gavel,
    Megaphone,
} from "lucide-react";

import ChatPanel from "./ChatPanel";
import { useGroqChat } from "./useGroqChat";
import { GROQ_API_KEY, GROQ_MODEL } from "./groqConfig";

/* ==========================================================
   SUPERADMIN PANEL — everything (sidebar included) lives in
   this one file/component on purpose, no separate sidebar
   import. Three modules, switched locally via `activeSection`
   rather than routes:
     1. Dashboard          — platform-wide KPIs
     2. Companies           — tenant companies using GrowthOS, as cards
     3. Prospect Companies  — companies WE are pitching GrowthOS to
========================================================== */

const API_BASE_URL = "http://localhost:8000";
const COMPANIES_ENDPOINT = `${API_BASE_URL}/admin/companies`;
const PROSPECT_COMPANIES_ENDPOINT = `${API_BASE_URL}/admin/lead-companies`;
const SEND_EMAIL_ENDPOINT = `${API_BASE_URL}/send-email`;
const SEND_SMS_ENDPOINT = `${API_BASE_URL}/send-sms`;
const SEND_WHATSAPP_ENDPOINT = `${API_BASE_URL}/send-whatsapp`;

const NAV_ITEMS = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "companies", label: "Companies", icon: Building2 },
    { key: "prospects", label: "Prospect Companies", icon: Target },
    { key: "customer360", label: "Customer 360 View", icon: Users },
];

const PROSPECT_STATUS_OPTIONS = ["New", "Contacted", "Interested", "Converted", "Not Interested"];

const emptyProspectForm = {
    company_name: "",
    contact_person: "",
    email: "",
    phone: "",
    website: "",
    industry: "",
    city: "",
    status: "New",
    notes: "",
};

const initials = (name) =>
    (name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

const statusStyles = {
    New: "border-sky-500/25 bg-sky-500/10 text-sky-300",
    Contacted: "border-amber-500/25 bg-amber-500/10 text-amber-300",
    Interested: "border-orange-500/25 bg-orange-500/10 text-orange-300",
    Converted: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
    "Not Interested": "border-zinc-500/25 bg-zinc-500/10 text-zinc-400",
    Active: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
    Trial: "border-amber-500/25 bg-amber-500/10 text-amber-300",
    Suspended: "border-red-500/25 bg-red-500/10 text-red-300",
};

/* ---------------------------- small building blocks ---------------------------- */

const StatCard = ({ icon: Icon, value, label, description, onClick }) => (
    <div
        onClick={onClick}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={onClick ? (e) => (e.key === "Enter" || e.key === " ") && onClick() : undefined}
        className={`group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 backdrop-blur-xl transition hover:border-orange-500/40 hover:bg-orange-500/[0.04] ${
            onClick ? "cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500/40" : ""
        }`}
    >
        <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-orange-500/0 blur-2xl transition group-hover:bg-orange-500/10" />
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20">
            <Icon size={18} />
        </span>
        <p className="mt-4 text-2xl font-extrabold text-white">{value}</p>
        <p className="mt-0.5 text-sm font-semibold text-zinc-300">{label}</p>
        {description && <p className="mt-0.5 text-xs text-zinc-500">{description}</p>}
    </div>
);

const StatusBadge = ({ status }) => (
    <span
        className={`inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${
            statusStyles[status] || "border-white/10 bg-white/5 text-zinc-400"
        }`}
    >
        {status || "Unknown"}
    </span>
);

/* ==========================================================
   CONTACT NOW — Prospect Companies table's Actions column.
   Adapted from Lead_Management.jsx's ReachableChannelsCard: same real
   backend sends (/send-email, /send-sms, /send-whatsapp) and the same
   modal design, but self-contained — no useGroqChat/ChatPanel/
   CustomerDataContext, since those belong to the logged-in company's CRM
   and aren't available here. `lead_id` is deliberately omitted from every
   send below: a prospect company's numeric id is from a different table
   than actual leads, and passing it through would risk logging the send
   against an unrelated lead that happens to share the same id.
========================================================== */

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

const prospectSmsTemplate = (name) =>
    `Hi ${name},\nThank you for connecting with GrowthOS AI.\nYour inquiry has been received successfully.\nOur team will contact you soon for a free demo.\nVisit: https://isfathena.com/\n- GrowthOS AI Team`;

const prospectWhatsappTemplate = (name) =>
    `👋 Hello ${name},\nThank you for your interest in GrowthOS AI.\nWe received your request and our AI has analyzed your business requirements.\n🚀 GrowthOS AI can help you with:\n• Lead Generation\n• CRM Management\n• Marketing Automation\n• AI WhatsApp Campaigns\n• Email Marketing\n• Customer Analytics\nOur team will contact you shortly for a free demo.\nVisit: https://isfathena.com/\nIf you have any questions, simply reply to this message.\nThank you,\nGrowthOS AI Team`;

const prospectEmailTemplate = (name) =>
    `Dear ${name},\n\nThank you for showing interest in GrowthOS AI.\nWe have successfully received your request.\n\nOur AI platform is designed to help businesses with:\n• Lead Generation\n• CRM Management\n• AI Marketing Automation\n• WhatsApp Campaigns\n• Email Campaigns\n• Customer Analytics\n\nOne of our experts will contact you shortly to understand your business requirements and schedule a personalized demo.\n\nIf you have any questions, simply reply to this email.\n\nThank you for choosing GrowthOS AI.\n\nBest Regards,\nGrowthOS AI Team\nAutonomous Revenue Platform\nhttps://isfathena.com/`;

const PROSPECT_EMAIL_SUBJECT = "Thank you for your interest in GrowthOS AI";

const digitsOnly = (v) => (v || "").replace(/\D/g, "");

// Prospect companies don't currently have a country field (unlike leads),
// so this defaults to India's dial code — matches the actual imported
// prospect data seen so far. Worth revisiting if/when non-Indian prospects
// are added (the same way "city" was added, a "country" column could be
// added and this swapped for the real per-row value).
const DEFAULT_DIAL_CODE = "91";

const prospectChannelConfig = [
    { key: "email", label: "Email", icon: Mail, color: "orange" },
    { key: "sms", label: "SMS", icon: Phone, color: "blue" },
    { key: "whatsapp", label: "WhatsApp", icon: MessageSquare, color: "green" },
    { key: "call", label: "Call", icon: PhoneCall, color: "purple" },
];

const ContactProspectModal = ({ prospect, onClose, onStatusChange }) => {
    const name = prospect?.contact_person || prospect?.company_name || "there";

    const authHeaders = () => {
        const token = localStorage.getItem("growthos_token");
        return token ? { Authorization: `Bearer ${token}` } : {};
    };

    // Best-effort, same as ReachableChannelsCard's markContacted — a
    // failure here doesn't undo or block the send that already happened.
    const markContacted = async () => {
        if (!prospect?.id) return;
        try {
            const res = await fetch(`${PROSPECT_COMPANIES_ENDPOINT}/${prospect.id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json", ...authHeaders() },
                body: JSON.stringify({ status: "Contacted" }),
            });
            if (res.ok) onStatusChange?.(prospect.id, "Contacted");
        } catch (err) {
            // Doesn't block the send itself — just won't flip the status
            // badge this time.
        }
    };

    const [emailModalOpen, setEmailModalOpen] = useState(false);
    const [emailSending, setEmailSending] = useState(false);
    const [emailResult, setEmailResult] = useState(null);
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
    const showToast = (type, text) => {
        setToast({ type, text });
        setTimeout(() => setToast(null), 3500);
    };

    const messageFor = (channelKey) =>
        ({ sms: prospectSmsTemplate(name), whatsapp: prospectWhatsappTemplate(name), email: prospectEmailTemplate(name) }[channelKey]);

    const openChannel = (channelKey) => {
        if (!prospect) return;

        if (channelKey === "email") {
            setEmailResult(null);
            setComposeTo(prospect.email || "");
            setComposeSubject(PROSPECT_EMAIL_SUBJECT);
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
        if (channelKey === "call") {
            const phone = digitsOnly(prospect.phone);
            if (!phone) return;
            window.location.href = `tel:${phone}`;
            markContacted();
        }
    };

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
                    subject: composeSubject.trim() || PROSPECT_EMAIL_SUBJECT,
                    message: composeBody,
                }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.success) throw new Error(data?.error || "send failed");

            setEmailResult({ type: "success", text: `Email sent to ${toAddress}` });
            markContacted();
            showToast("success", `✓ Email sent to ${toAddress}`);
            setTimeout(() => setEmailModalOpen(false), 1100);
        } catch (err) {
            setEmailResult({ type: "error", text: "Provider information is not correct." });
        } finally {
            setEmailSending(false);
        }
    };

    const confirmSendSMS = async () => {
        if (!prospect?.phone) return;
        setSmsSending(true);
        setSmsResult(null);
        try {
            const res = await fetch(SEND_SMS_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ to_number: digitsOnly(prospect.phone), message: messageFor("sms") }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.success) throw new Error(data?.error || "send failed");

            setSmsResult({ type: "success", text: `SMS sent to ${prospect.phone}` });
            markContacted();
            showToast("success", `✓ SMS sent to ${prospect.phone}`);
            setTimeout(() => setSmsModalOpen(false), 1100);
        } catch (err) {
            setSmsResult({ type: "error", text: "Provider information is not correct." });
        } finally {
            setSmsSending(false);
        }
    };

    const confirmSendWhatsApp = async () => {
        if (!prospect?.phone) return;
        const phone = digitsOnly(prospect.phone);
        const waNumber = !phone.startsWith(DEFAULT_DIAL_CODE) ? `${DEFAULT_DIAL_CODE}${phone}` : phone;

        setWaSending(true);
        setWaResult(null);
        try {
            const res = await fetch(SEND_WHATSAPP_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ to_number: waNumber, name, message_for_log: messageFor("whatsapp") }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.success) throw new Error(data?.error || "send failed");

            setWaResult({ type: "success", text: `WhatsApp sent to ${prospect.phone}` });
            markContacted();
            showToast("success", `✓ WhatsApp sent to ${prospect.phone}`);
            setTimeout(() => setWaModalOpen(false), 1100);
        } catch (err) {
            setWaResult({ type: "error", text: "Provider information is not correct." });
        } finally {
            setWaSending(false);
        }
    };

    const isChannelEnabled = (channelKey) => {
        if (!prospect) return false;
        if (channelKey === "email") return true; // recipient is editable in the compose modal
        return !!prospect.phone;
    };

    if (!prospect) return null;

    return createPortal(
        <>
            <div className="fixed inset-0 z-[1997] flex items-center justify-center bg-black/80 px-4 py-6">
                <div className="bg-black border border-orange-600/30 rounded-[28px] p-7 sm:p-9 max-w-2xl w-full relative shadow-[0_0_60px_rgba(0,0,0,0.9)]">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <p className="text-xs text-gray-500 uppercase tracking-wide">Contact Prospect</p>
                            <h3 className="text-white font-bold text-2xl mt-1">{prospect.company_name || "Unnamed Company"}</h3>
                            {prospect.contact_person && <p className="text-sm text-gray-500 mt-1">{prospect.contact_person}</p>}
                        </div>
                        <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-white transition">
                            <X size={24} />
                        </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {prospectChannelConfig.map(({ key, label, icon: Icon, color }) => {
                            const enabled = isChannelEnabled(key);
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => openChannel(key)}
                                    disabled={!enabled}
                                    className={`rounded-2xl py-6 flex flex-col items-center justify-center gap-2.5 text-sm border transition ${
                                        enabled
                                            ? `${chipColors[color]} hover:brightness-125 cursor-pointer`
                                            : "bg-white/[0.02] border-white/5 text-gray-600 cursor-not-allowed opacity-50"
                                    }`}
                                >
                                    <Icon size={26} />
                                    <span className={enabled ? "text-white font-medium" : ""}>{label}</span>
                                </button>
                            );
                        })}
                    </div>
                    {!prospect.phone && (
                        <p className="mt-4 text-xs text-zinc-500">No phone number on file — SMS, WhatsApp and Call are disabled.</p>
                    )}
                </div>
            </div>

            {emailModalOpen && (
                <div className="fixed inset-0 z-[1998] flex items-center justify-center bg-black/70 px-4 py-8">
                    <div className="bg-[#0d0d10] border border-orange-600/30 rounded-2xl p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9)]">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Chip color="orange" icon={Mail} size={18} />
                                <h4 className="text-white font-bold text-lg">Send Email</h4>
                            </div>
                            <button onClick={() => setEmailModalOpen(false)} className="text-gray-400 hover:text-white" disabled={emailSending}>
                                <X size={22} />
                            </button>
                        </div>

                        <div className="mt-6 space-y-3 text-sm">
                            <div className="flex items-center gap-3 bg-white/5 rounded-lg px-4 py-3.5">
                                <span className="text-gray-400 shrink-0">To</span>
                                <input
                                    type="email"
                                    value={composeTo}
                                    onChange={(e) => setComposeTo(e.target.value)}
                                    placeholder="recipient@email.com"
                                    className="flex-1 bg-transparent text-white font-medium text-right outline-none placeholder:text-gray-600 placeholder:font-normal"
                                />
                            </div>
                            <div className="flex items-center gap-3 bg-white/5 rounded-lg px-4 py-3.5">
                                <span className="text-gray-400 shrink-0">Subject</span>
                                <input
                                    type="text"
                                    value={composeSubject}
                                    onChange={(e) => setComposeSubject(e.target.value)}
                                    className="flex-1 bg-transparent text-white font-medium text-right outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-gray-400 text-sm mb-2 block">Message</label>
                                <textarea
                                    value={composeBody}
                                    onChange={(e) => setComposeBody(e.target.value)}
                                    rows={16}
                                    className="w-full bg-white/5 rounded-lg px-4 py-3.5 max-h-[50vh] overflow-y-auto whitespace-pre-wrap text-gray-100 text-sm leading-relaxed outline-none resize-y focus:ring-1 focus:ring-orange-500/40"
                                />
                            </div>
                        </div>

                        {emailResult && (
                            <div
                                className={`mt-4 flex items-center gap-2 text-sm rounded-lg px-4 py-3 border ${
                                    emailResult.type === "success"
                                        ? "bg-green-500/10 border-green-500/30 text-green-400"
                                        : "bg-red-500/10 border-red-500/30 text-red-400"
                                }`}
                            >
                                {emailResult.type === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                                {emailResult.text}
                            </div>
                        )}

                        <div className="flex items-center gap-3 mt-6">
                            <button
                                onClick={() => setEmailModalOpen(false)}
                                disabled={emailSending}
                                className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-300 border border-white/10 hover:border-white/30 transition disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmSendEmail}
                                disabled={emailSending || !composeTo.trim()}
                                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-orange-500 hover:bg-orange-600 text-black transition disabled:opacity-60"
                            >
                                {emailSending ? (
                                    <>
                                        <Loader2 size={15} className="animate-spin" /> Sending...
                                    </>
                                ) : (
                                    <>
                                        <Send size={15} /> Send
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {smsModalOpen && (
                <div className="fixed inset-0 z-[1998] flex items-center justify-center bg-black/70 px-4">
                    <div className="bg-[#0d0d10] border border-orange-600/30 rounded-2xl p-7 max-w-xl w-full shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9)]">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Chip color="blue" icon={Phone} size={18} />
                                <h4 className="text-white font-bold text-lg">Send SMS</h4>
                            </div>
                            <button onClick={() => setSmsModalOpen(false)} className="text-gray-400 hover:text-white" disabled={smsSending}>
                                <X size={22} />
                            </button>
                        </div>

                        <div className="mt-6 space-y-3 text-sm">
                            <div className="flex justify-between bg-white/5 rounded-lg px-4 py-3">
                                <span className="text-gray-400">To</span>
                                <span className="text-white font-medium">{prospect.phone}</span>
                            </div>
                            <div className="bg-white/5 rounded-lg px-4 py-3 max-h-56 overflow-y-auto whitespace-pre-wrap text-gray-300 leading-relaxed">
                                {messageFor("sms")}
                            </div>
                        </div>

                        {smsResult && (
                            <div
                                className={`mt-4 flex items-center gap-2 text-sm rounded-lg px-4 py-3 border ${
                                    smsResult.type === "success"
                                        ? "bg-green-500/10 border-green-500/30 text-green-400"
                                        : "bg-red-500/10 border-red-500/30 text-red-400"
                                }`}
                            >
                                {smsResult.type === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                                {smsResult.text}
                            </div>
                        )}

                        <div className="flex items-center gap-3 mt-6">
                            <button
                                onClick={() => setSmsModalOpen(false)}
                                disabled={smsSending}
                                className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-300 border border-white/10 hover:border-white/30 transition disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmSendSMS}
                                disabled={smsSending}
                                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-orange-500 hover:bg-orange-600 text-black transition disabled:opacity-60"
                            >
                                {smsSending ? (
                                    <>
                                        <Loader2 size={15} className="animate-spin" /> Sending...
                                    </>
                                ) : (
                                    <>
                                        <Send size={15} /> Send
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {waModalOpen && (
                <div className="fixed inset-0 z-[1998] flex items-center justify-center bg-black/70 px-4">
                    <div className="bg-[#0d0d10] border border-orange-600/30 rounded-2xl p-7 max-w-xl w-full shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9)]">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Chip color="green" icon={MessageSquare} size={18} />
                                <h4 className="text-white font-bold text-lg">Send WhatsApp</h4>
                            </div>
                            <button onClick={() => setWaModalOpen(false)} className="text-gray-400 hover:text-white" disabled={waSending}>
                                <X size={22} />
                            </button>
                        </div>

                        <div className="mt-6 space-y-3 text-sm">
                            <div className="flex justify-between bg-white/5 rounded-lg px-4 py-3">
                                <span className="text-gray-400">To</span>
                                <span className="text-white font-medium">{prospect.phone}</span>
                            </div>
                            <div className="bg-white/5 rounded-lg px-4 py-3 text-gray-300 leading-relaxed">
                                Sends the approved <span className="text-white font-medium">growthos_intro</span> template to{" "}
                                <span className="text-white font-medium">{name}</span> via Meta WhatsApp Cloud API.
                            </div>
                            <div className="bg-white/5 rounded-lg px-4 py-3 max-h-56 overflow-y-auto whitespace-pre-wrap text-gray-300 leading-relaxed">
                                {messageFor("whatsapp")}
                            </div>
                        </div>

                        {waResult && (
                            <div
                                className={`mt-4 flex items-center gap-2 text-sm rounded-lg px-4 py-3 border ${
                                    waResult.type === "success"
                                        ? "bg-green-500/10 border-green-500/30 text-green-400"
                                        : "bg-red-500/10 border-red-500/30 text-red-400"
                                }`}
                            >
                                {waResult.type === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                                {waResult.text}
                            </div>
                        )}

                        <div className="flex items-center gap-3 mt-6">
                            <button
                                onClick={() => setWaModalOpen(false)}
                                disabled={waSending}
                                className="flex-1 py-3 rounded-xl text-sm font-semibold text-gray-300 border border-white/10 hover:border-white/30 transition disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmSendWhatsApp}
                                disabled={waSending}
                                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold bg-orange-500 hover:bg-orange-600 text-black transition disabled:opacity-60"
                            >
                                {waSending ? (
                                    <>
                                        <Loader2 size={15} className="animate-spin" /> Sending...
                                    </>
                                ) : (
                                    <>
                                        <Send size={15} /> Send
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {toast && (
                <div
                    className={`fixed bottom-6 right-6 z-[1999] flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium shadow-lg border ${
                        toast.type === "success"
                            ? "bg-green-500/15 border-green-500/40 text-green-400"
                            : "bg-red-500/15 border-red-500/40 text-red-400"
                    }`}
                >
                    {toast.type === "success" ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
                    {toast.text}
                </div>
            )}
        </>,
        document.body
    );
};

/* ================================ MAIN ================================ */

/* ==========================================================
   CUSTOMER 360 VIEW (SuperAdmin panel) — everything below,
   through the closing of Customer360SectionAdmin, is inlined
   directly in this file (no separate component files) at the
   user's request. Reuses the real Customer360Section.jsx's
   UI/logic unchanged — only the data source is swapped to
   GrowthOS AI's onboarded companies instead of one company's
   own leads.
========================================================== */

/* ==========================================================
   SUPERADMIN CUSTOMER DATA CONTEXT
   Same hook shape as the real "./CustomerDataContext" that
   Customer360Section.jsx already uses (leads, leadsLoading,
   leadsError, selectedLead, selectedLeadKey, setSelectedLeadKey)
   — but sourced from GrowthOS AI's onboarded COMPANIES instead
   of one company's leads. This lets Customer360SectionAdmin below
   (an unmodified-UI copy of Customer360Section.jsx, inlined here)
   work as-is, just fed different data.

   This is intentionally separate from the real
   "./CustomerDataContext" so the actual per-company CRM
   dashboard (Growthosdashboard.jsx) is completely untouched.
========================================================== */

// API_BASE_URL, COMPANIES_ENDPOINT and authHeaders() are already defined
// above (shared with the rest of this SuperAdmin panel) — reused here as-is.

// Maps one GrowthOS company record onto the field names
// Customer360Section.jsx reads off a "lead". Fields with no real
// company equivalent are left undefined on purpose — the component
// already renders those as "—" / "Unassigned" / hides the block
// entirely, rather than showing a made-up value.
const companyToLeadShape = (c) => ({
    id: c.id,
    user_name: c.company_name,
    user_email: c.email,
    user_mobile_number: c.contact_number,
    web_url: c.website,
    user_address: [c.address_city, c.address_state, c.address_country].filter(Boolean).join(", "),
    country: c.address_country,
    lead_source: c.company_type || "GrowthOS AI Company",
    customer_since: c.created_at,
    gmb_status: undefined,
    assigned_prospect: undefined,
    current_status: c.phase || "Active",
    // These are onboarded, paying companies — already "contacted" by
    // definition, unlike a fresh prospect lead.
    is_contacted: true,
    ai_score: undefined,
    industry: c.industry_sector,
    decision_maker: undefined,
    designation: undefined,
    company_size: undefined,
    estimated_scale: undefined,
    technology_used: undefined,
    pain_points: undefined,
    reason: undefined,
    prospect_comment: undefined,
});

const CustomerDataContext = createContext(null);

const CustomerDataProvider = ({ children }) => {
    const authHeaders = () => {
        const token = localStorage.getItem("growthos_admin_token") || localStorage.getItem("growthos_token");
        return token ? { Authorization: `Bearer ${token}` } : {};
    };

    const [companies, setCompanies] = useState([]);
    const [leadsLoading, setLeadsLoading] = useState(true);
    const [leadsError, setLeadsError] = useState("");
    const [selectedLeadKey, setSelectedLeadKey] = useState(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLeadsLoading(true);
            setLeadsError("");
            try {
                const res = await fetch(COMPANIES_ENDPOINT, { method: "GET", headers: authHeaders() });
                if (!res.ok) throw new Error(`Request failed (${res.status})`);
                const data = await res.json();
                // Real API shape is { success, data: [...] } — same as the
                // Companies tab's fetchCompanies(). Also tolerate a bare
                // array or { companies: [...] } just in case.
                const list = Array.isArray(data)
                    ? data
                    : Array.isArray(data?.data)
                    ? data.data
                    : data?.companies || [];
                if (!cancelled) setCompanies(list);
            } catch (err) {
                if (!cancelled) setLeadsError("Couldn't load companies.");
            } finally {
                if (!cancelled) setLeadsLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const leads = useMemo(() => companies.map(companyToLeadShape), [companies]);

    // Default to the first company once the list loads, same as the
    // dropdown auto-selecting the first lead in the real dashboard.
    useEffect(() => {
        if (leads.length > 0 && (selectedLeadKey === null || !leads.some((l) => String(l.id) === String(selectedLeadKey)))) {
            setSelectedLeadKey(String(leads[0].id));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [leads]);

    const selectedLead = leads.find((l) => String(l.id) === String(selectedLeadKey)) || leads[0] || null;

    const value = { leads, leadsLoading, leadsError, selectedLead, selectedLeadKey, setSelectedLeadKey };

    return <CustomerDataContext.Provider value={value}>{children}</CustomerDataContext.Provider>;
};

const useCustomerData = () => {
    const ctx = useContext(CustomerDataContext);
    if (!ctx) throw new Error("useCustomerData must be used within a CustomerDataProvider");
    return ctx;
};

// API_BASE_URL and SEND_EMAIL_ENDPOINT are already defined above (shared
// with the rest of this SuperAdmin panel) — reused here as-is.
// The mailbox the backend's SMTP config actually sends from — shown for
// reference in the compose modal, matching Lead_Management's Send Email card.
const CUSTOMER360_SEND_FROM_ADDRESS = "isfinformaticaanalytica@gmail.com";

const CARD = "bg-[#0d0d10] border border-white/10 rounded-2xl";

// chipColors + Chip are already defined above (shared with the Prospect
// Companies contact card) — reused here as-is, now including "rose".

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

// digitsOnly is already defined above — reused here as-is.

// Circular "Company Health" gauge for the Customer 360 header — driven by
// the same real engagementScore (ai_score) used in the stat cards, so it
// never shows a made-up number.
const HealthGauge = ({ score }) => {
    const hasScore = typeof score === "number" && score > 0;
    const radius = 32;
    const circumference = 2 * Math.PI * radius;
    const pct = Math.max(0, Math.min(100, score || 0));
    const offset = circumference - (pct / 100) * circumference;
    const label = !hasScore ? "No data" : pct >= 80 ? "Excellent" : pct >= 60 ? "Good" : pct >= 40 ? "Fair" : "Needs Attention";

    return (
        <div className="flex flex-col items-center justify-center bg-white/[0.03] border border-white/10 rounded-2xl px-5 py-3.5 w-full sm:w-[152px] shrink-0">
            <p className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">Company Health</p>
            <div className="relative mt-1.5 h-[76px] w-[76px]">
                <svg viewBox="0 0 76 76" className="h-full w-full -rotate-90">
                    <circle cx="38" cy="38" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
                    {hasScore && (
                        <circle
                            cx="38"
                            cy="38"
                            r={radius}
                            fill="none"
                            stroke="#f97316"
                            strokeWidth="7"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={offset}
                            className="transition-all duration-500"
                        />
                    )}
                </svg>
                <div className="absolute inset-0 flex items-center justify-center text-lg font-bold text-white">
                    {hasScore ? pct : "—"}
                </div>
            </div>
            <p className="mt-1 text-[11px] font-semibold text-orange-400">{label}</p>
        </div>
    );
};

// Mirrors Products.jsx's category -> icon mapping so a company's real
// products render with the same icon they'd see on their own Products page.
const PRODUCT_CATEGORY_ICONS = {
    "Real Estate": Building2,
    "SaaS / Software": Code2,
    "E-commerce": ShoppingCart,
    Education: GraduationCap,
    Healthcare: HeartPulse,
    "Finance & Banking": Landmark,
    Manufacturing: Factory,
    Retail: Store,
    "Hospitality & Travel": Plane,
    Automotive: Car,
    "Legal Services": Gavel,
    "Marketing & Advertising": Megaphone,
};
const productCategoryIcon = (category) => PRODUCT_CATEGORY_ICONS[category] || Package;

const formatProductPrice = (num) => {
    const n = Number(num) || 0;
    return `₹${n.toLocaleString("en-IN")}`;
};

const channelConfig = [
    { key: "email", label: "Email", icon: Mail, color: "orange" },
    { key: "sms", label: "SMS", icon: Phone, color: "blue" },
    { key: "whatsapp", label: "WhatsApp", icon: MessageSquare, color: "green" },
    { key: "call", label: "Call", icon: PhoneCall, color: "purple" },
];

// Only tabs backed by real, already-available data (unlike the mockup's
// Users/Products/Subscriptions/Transactions counts, which we have no table
// or endpoint for yet — those would have to be fabricated).
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

const Customer360SectionAdmin = () => {
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

    // ai_score is computed server-side (main.py's compute_ai_score) from the
    // lead's own form fields — not a per-status guess. Feeds the Company
    // Health gauge in the header.
    const engagementScore = lead ? (Number(lead.ai_score) || 0) : 0;

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
                (missingFields ? `\nFields NOT available for this company (do not guess these): ${missingFields}.\n` : "") +
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

    /* ---------------- Active Products (real data) ----------------
       Same isfathena.products table/fields the company sees on its own
       Products page (product_name, category, price, billing_cycle, status)
       — just fetched for the SELECTED company via the admin endpoint
       instead of the caller's own token-scoped company. If this admin
       route doesn't exist on the backend yet, this fails quietly into the
       empty state below rather than showing anything made up. */
    const [companyProducts, setCompanyProducts] = useState([]);
    const [companyProductsLoading, setCompanyProductsLoading] = useState(false);
    const [companyProductsError, setCompanyProductsError] = useState("");

    const fetchCompanyProducts = async (companyId) => {
        if (!companyId) return;
        setCompanyProductsLoading(true);
        setCompanyProductsError("");
        try {
            const token = localStorage.getItem("growthos_admin_token") || localStorage.getItem("growthos_token");
            const headers = token ? { Authorization: `Bearer ${token}` } : {};
            const res = await fetch(`${COMPANIES_ENDPOINT}/${companyId}/products`, { method: "GET", headers });
            if (!res.ok) throw new Error(`Request failed (${res.status})`);
            const resp = await res.json();
            const list = Array.isArray(resp) ? resp : Array.isArray(resp?.data) ? resp.data : [];
            setCompanyProducts(list);
        } catch (err) {
            setCompanyProductsError("Couldn't load products for this company.");
            setCompanyProducts([]);
        } finally {
            setCompanyProductsLoading(false);
        }
    };

    useEffect(() => {
        setCompanyProducts([]);
        setCompanyProductsError("");
        if (lead?.id) fetchCompanyProducts(lead.id);
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

    return (
        <section id="sec-customer-360" className="h-full flex flex-col overflow-hidden relative z-10 py-3 sm:py-4">
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 w-full h-full flex flex-col min-h-0 overflow-y-auto">
                {/* Section label + company switcher */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
                    <span className="inline-block bg-orange-500/10 text-orange-400 border border-orange-600/30 px-3 py-1 rounded-full font-semibold text-[11px] tracking-wide w-fit">
                        Customer Intelligence
                    </span>

                    {!leadsLoading && !leadsError && lead && (
                        <div className="relative w-full sm:w-64">
                            <select
                                value={selectedLeadKey ?? ""}
                                onChange={(e) => {
                                    setSelectedLeadKey(e.target.value);
                                    setCustomMsgs({});
                                    resetChat();
                                }}
                                disabled={leadsLoading || leads.length === 0}
                                className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-4 pr-10 py-2.5 text-sm text-white outline-none focus:border-orange-500/60 appearance-none cursor-pointer disabled:opacity-50"
                            >
                                {leads.length === 0 && <option value="">No companies yet</option>}
                                {leads.map((l, i) => (
                                    <option key={l.id ?? i} value={l.id ?? String(i)} className="bg-black text-white">
                                        {l.user_name || `Company #${i + 1}`}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />
                        </div>
                    )}
                </div>

                {/* Company overview card + Active Products, side by side */}
                {!leadsLoading && !leadsError && lead && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-3 shrink-0">
                    <div className={`${CARD} p-6 sm:p-8 lg:col-span-2`}>
                        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                            {/* Identity + contacts */}
                            <div className="flex items-start gap-5 min-w-0 flex-1">
                                <div className="h-20 w-20 shrink-0 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-orange-500/20">
                                    {initial}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <h2 className="text-2xl sm:text-3xl font-extrabold text-white truncate tracking-tight">
                                            {lead.user_name || "Unnamed Company"}
                                        </h2>
                                        <span className="inline-flex items-center gap-1.5 rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs font-semibold text-green-400 shrink-0">
                                            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
                                            {lead.current_status || "Active"}
                                        </span>
                                    </div>
                                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                                        {lead.industry && (
                                            <span className="inline-block rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-gray-300">
                                                {lead.industry}
                                            </span>
                                        )}
                                        {lead.lead_source && (
                                            <span className="inline-block rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-gray-300">
                                                {lead.lead_source}
                                            </span>
                                        )}
                                    </div>

                                    <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-300">
                                        <span className="flex items-center gap-2 min-w-0">
                                            <Mail size={14} className="text-orange-500/80 shrink-0" />
                                            <span className="truncate">{lead.user_email || "—"}</span>
                                        </span>
                                        <span className="flex items-center gap-2">
                                            <Phone size={14} className="text-orange-500/80 shrink-0" />
                                            {lead.user_mobile_number || "—"}
                                        </span>
                                        {lead.web_url ? (
                                            <a
                                                href={lead.web_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex items-center gap-2 min-w-0 hover:text-orange-400 transition"
                                            >
                                                <Globe size={14} className="text-orange-500/80 shrink-0" />
                                                <span className="truncate">{lead.web_url}</span>
                                            </a>
                                        ) : (
                                            <span className="flex items-center gap-2">
                                                <Globe size={14} className="text-orange-500/80 shrink-0" /> —
                                            </span>
                                        )}
                                        <span className="flex items-center gap-2 min-w-0">
                                            <MapPin size={14} className="text-orange-500/80 shrink-0" />
                                            <span className="truncate">{lead.user_address || "—"}</span>
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Health gauge (company switcher moved above the card) */}
                            <div className="flex flex-row lg:flex-col items-stretch gap-3 w-full lg:w-auto shrink-0">
                                <HealthGauge score={lead.ai_score ? Number(lead.ai_score) : engagementScore} />
                            </div>
                        </div>

                        {/* Meta row */}
                        <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-5">
                            <div>
                                <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Customer Since</p>
                                <p className="mt-1.5 text-base font-semibold text-white truncate">
                                    {lead.customer_since ? String(lead.customer_since).slice(0, 10) : "—"}
                                </p>
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Company Type</p>
                                <p className="mt-1.5 text-base font-semibold text-white truncate">{lead.lead_source || "—"}</p>
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Account Owner</p>
                                <p className="mt-1.5 text-base font-semibold text-white truncate">{lead.assigned_prospect || "Unassigned"}</p>
                            </div>
                            <div>
                                <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">Status</p>
                                <p className="mt-1.5 text-base font-semibold text-white truncate">{lead.current_status || "—"}</p>
                            </div>
                        </div>
                    </div>

                    {/* Active Products — real data from isfathena.products,
                        fetched per-company (see fetchCompanyProducts above). */}
                    <div className={`${CARD} p-4 flex flex-col`}>
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-white">Active Products</h3>
                            {companyProducts.length > 0 && (
                                <span className="text-[11px] text-gray-500">{companyProducts.length} total</span>
                            )}
                        </div>

                        {companyProductsLoading ? (
                            <div className="mt-3 flex-1 flex items-center justify-center gap-2 text-gray-400 text-xs py-6">
                                <Loader2 size={13} className="animate-spin" /> Loading products...
                            </div>
                        ) : companyProductsError ? (
                            <div className="mt-3 flex-1 flex flex-col items-center justify-center gap-2 text-center py-6">
                                <p className="text-xs text-red-400">{companyProductsError}</p>
                                <button
                                    type="button"
                                    onClick={() => fetchCompanyProducts(lead.id)}
                                    className="text-[11px] text-orange-400 hover:text-orange-300 underline"
                                >
                                    Retry
                                </button>
                            </div>
                        ) : companyProducts.length === 0 ? (
                            <div className="mt-3 flex-1 flex items-center justify-center text-center py-6">
                                <p className="text-xs text-gray-500 leading-relaxed">
                                    No products added by this company yet.
                                </p>
                            </div>
                        ) : (
                            <div className="mt-3 space-y-2 overflow-y-auto min-h-0">
                                {companyProducts.map((p) => {
                                    const CatIcon = productCategoryIcon(p.category);
                                    const status = p.status || "Active";
                                    return (
                                        <div
                                            key={p.id}
                                            className="flex items-center gap-2.5 bg-white/[0.03] border border-white/5 rounded-lg px-2.5 py-2"
                                        >
                                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-300">
                                                <CatIcon size={15} />
                                            </span>
                                            <div className="min-w-0 flex-1">
                                                <p className="text-xs font-semibold text-white truncate">{p.product_name}</p>
                                                <p className="text-[11px] text-gray-500 truncate">
                                                    {p.category || "—"}
                                                    {p.price ? ` · ${formatProductPrice(p.price)}` : ""}
                                                </p>
                                            </div>
                                            <span
                                                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                                    status === "Active"
                                                        ? "border border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                                                        : "border border-zinc-500/25 bg-zinc-500/10 text-zinc-400"
                                                }`}
                                            >
                                                {status}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                    </div>
                )}

                {/* Snapshot KPI row — Current Plan is real (same "phase" field
                    used as the plan/tier indicator on the Companies tab).
                    Revenue/Products/Users/Leads/Expiry have no backing table
                    or endpoint yet, so they show "—" rather than a made-up
                    number, until that data exists. */}
                {!leadsLoading && !leadsError && lead && (
                    <div className="flex flex-wrap gap-3 mt-3 shrink-0">
                        {[
                            { label: "Total Revenue", value: "—", sub: "Not tracked yet", icon: CreditCard, color: "green" },
                            { label: "Products", value: companyProductsLoading ? "—" : companyProducts.length, sub: companyProductsLoading ? "Loading..." : "Active", icon: Building2, color: "blue" },
                            { label: "Users", value: "—", sub: "Not tracked yet", icon: User, color: "purple" },
                            { label: "Leads Generated", value: "—", sub: "Not tracked yet", icon: TrendingUp, color: "orange" },
                            { label: "Current Plan", value: lead.current_status || "—", sub: lead.current_status ? "Active" : "Not set", icon: Sparkles, color: "blue" },
                            { label: "Plan Expiry", value: "—", sub: "Not tracked yet", icon: Clock, color: "rose" },
                        ].map(({ label, value, sub, icon, color }, i) => (
                            <div key={i} className={`${CARD} p-4 flex-1 min-w-[150px]`}>
                                <div className="flex items-center gap-2.5">
                                    <Chip color={color} icon={icon} size={15} />
                                    <p className="text-xs text-gray-400 font-medium truncate">{label}</p>
                                </div>
                                <p className="mt-2.5 text-lg font-bold text-white truncate">{value}</p>
                                <p className="mt-0.5 text-[11px] text-gray-500 truncate">{sub}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Snapshot 3-column: Company Information | Recent Activity | Reachable Channels.
                    Company Information reuses real fields already on the lead record.
                    Recent Activity has no data source for a per-company feed yet,
                    so it shows an honest empty state instead of fabricated entries.
                    (Active Products now lives next to the overview card above.) */}
                {!leadsLoading && !leadsError && lead && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-3 shrink-0">
                        {/* Company Information */}
                        <div className={`${CARD} p-4`}>
                            <h3 className="text-sm font-bold text-white">Company Information</h3>
                            <div className="mt-3 divide-y divide-white/5">
                                {[
                                    ["Company Name", lead.user_name],
                                    ["Industry", lead.industry],
                                    ["Company Type", lead.lead_source],
                                    ["Email", lead.user_email],
                                    ["Phone", lead.user_mobile_number],
                                    ["Website", lead.web_url],
                                    ["Address", lead.user_address],
                                ].map(([label, value]) => (
                                    <div key={label} className="flex items-center justify-between gap-3 py-2 text-xs">
                                        <span className="text-gray-500 shrink-0">{label}</span>
                                        <span className="text-white text-right truncate">{value || "—"}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Recent Activity */}
                        <div className={`${CARD} p-4 flex flex-col`}>
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-bold text-white">Recent Activity</h3>
                                <button type="button" disabled className="text-[11px] text-gray-600 border border-white/10 rounded-lg px-2.5 py-1 cursor-not-allowed">
                                    View All
                                </button>
                            </div>
                            <div className="mt-3 flex-1 flex items-center justify-center text-center py-6">
                                <p className="text-xs text-gray-500 leading-relaxed">
                                    No activity feed available yet for this company.
                                </p>
                            </div>
                        </div>

                        {/* Reachable Channels — quick channel launcher (same channelConfig/openChannel used in the overview tab below). */}
                        <div className={`${CARD} p-4 flex flex-col`}>
                            <h3 className="text-sm font-bold text-white shrink-0">Reachable Channels</h3>
                            <div className="grid grid-cols-2 gap-2.5 mt-3">
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
                        </div>
                    </div>
                )}


                {leadsLoading && (
                    <div className="flex-1 flex items-center justify-center gap-2 text-gray-400 text-sm">
                        <Loader2 size={16} className="animate-spin" /> Loading companies...
                    </div>
                )}

                {!leadsLoading && leadsError && (
                    <div className="flex-1 flex items-center justify-center text-red-400 text-sm">{leadsError}</div>
                )}

                {!leadsLoading && !leadsError && leads.length === 0 && (
                    <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
                        No companies yet.
                    </div>
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
                                    Ask AI about {lead.user_name || "this company"}
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
                                emptyStateHint={`Ask AI to draft an SMS, WhatsApp or email for ${lead.user_name || "this company"}, then save it above.`}
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
                                            <span className="text-white font-medium">{CUSTOMER360_SEND_FROM_ADDRESS}</span>
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

const SuperAdmin = () => {
    const [activeSection, setActiveSection] = useState("dashboard");
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    const [companies, setCompanies] = useState([]);
    const [companiesLoading, setCompaniesLoading] = useState(true);
    const [companySearch, setCompanySearch] = useState("");

    const [prospectCompanies, setProspectCompanies] = useState([]);
    const [prospectCompaniesLoading, setProspectCompaniesLoading] = useState(true);
    const [prospectSearch, setProspectSearch] = useState("");
    const [prospectStatusFilter, setProspectStatusFilter] = useState("All");

    const [modalOpen, setModalOpen] = useState(false);
    const [editingProspectId, setEditingProspectId] = useState(null);
    const [prospectForm, setProspectForm] = useState(emptyProspectForm);
    const [prospectFormError, setProspectFormError] = useState("");
    const [savingProspect, setSavingProspect] = useState(false);

    const [importing, setImporting] = useState(false);
    const [importMessage, setImportMessage] = useState(null); // { type: "success" | "error", text }
    const fileInputRef = useRef(null);

    const [selectedProspectIds, setSelectedProspectIds] = useState([]);
    const [deletingProspects, setDeletingProspects] = useState(false);
    const [deleteError, setDeleteError] = useState("");

    const [impersonatingId, setImpersonatingId] = useState(null);
    const [impersonateError, setImpersonateError] = useState("");

    const [contactProspect, setContactProspect] = useState(null);

    const authHeaders = () => {
        const token = localStorage.getItem("growthos_admin_token") || localStorage.getItem("growthos_token");
        return token ? { Authorization: `Bearer ${token}` } : {};
    };

    const fetchCompanies = async () => {
        setCompaniesLoading(true);
        try {
            const res = await fetch(COMPANIES_ENDPOINT, { method: "GET", headers: authHeaders() });
            const resp = await res.json().catch(() => null);
            setCompanies(res.ok && resp?.success && Array.isArray(resp.data) ? resp.data : []);
        } catch (err) {
            setCompanies([]);
        } finally {
            setCompaniesLoading(false);
        }
    };

    const fetchProspectCompanies = async () => {
        setProspectCompaniesLoading(true);
        try {
            const res = await fetch(PROSPECT_COMPANIES_ENDPOINT, { method: "GET", headers: authHeaders() });
            const resp = await res.json().catch(() => null);
            setProspectCompanies(res.ok && resp?.success && Array.isArray(resp.data) ? resp.data : []);
        } catch (err) {
            setProspectCompanies([]);
        } finally {
            setProspectCompaniesLoading(false);
        }
    };

    // "Import" button — accepts .csv / .xlsx / .xls / .pdf, hands the raw
    // file to the backend to parse and bulk-insert, then refreshes the list.
    const handleImportFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = ""; // let the same file be re-selected later if needed
        if (!file) return;

        const allowedExt = [".csv", ".xlsx", ".xls", ".pdf"];
        const ext = "." + (file.name.split(".").pop() || "").toLowerCase();
        if (!allowedExt.includes(ext)) {
            setImportMessage({ type: "error", text: "Please upload a .csv, .xlsx, .xls, or .pdf file." });
            return;
        }

        setImporting(true);
        setImportMessage(null);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch(`${PROSPECT_COMPANIES_ENDPOINT}/import`, {
                method: "POST",
                headers: authHeaders(), // no Content-Type — the browser sets the multipart boundary
                body: formData,
            });
            const resp = await res.json().catch(() => null);
            if (!res.ok || !resp?.success) throw new Error(resp?.message || `Import failed (${res.status})`);
            setProspectCompanies(Array.isArray(resp.data) ? resp.data : []);
            setImportMessage({ type: "success", text: resp.message || "Import complete." });
        } catch (err) {
            setImportMessage({ type: "error", text: err.message || "Could not import that file. Please try again." });
        } finally {
            setImporting(false);
        }
    };

    // ---- Prospect Companies: row selection + delete ----
    const toggleProspectSelected = (id) => {
        setSelectedProspectIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };

    const toggleSelectAllProspects = (ids) => {
        setSelectedProspectIds((prev) => (ids.every((id) => prev.includes(id)) ? prev.filter((id) => !ids.includes(id)) : Array.from(new Set([...prev, ...ids]))));
    };

    const deleteProspectCompanies = async (ids) => {
        if (!ids.length) return;
        const label = ids.length === 1 ? "this prospect company" : `these ${ids.length} prospect companies`;
        if (!window.confirm(`Delete ${label}? This can't be undone.`)) return;

        setDeletingProspects(true);
        setDeleteError("");
        try {
            const res = await fetch(`${PROSPECT_COMPANIES_ENDPOINT}/bulk-delete`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeaders() },
                body: JSON.stringify({ ids }),
            });
            const resp = await res.json().catch(() => null);
            if (!res.ok || !resp?.success) throw new Error(resp?.message || `Delete failed (${res.status})`);
            setProspectCompanies((prev) => prev.filter((p) => !ids.includes(p.id)));
            setSelectedProspectIds((prev) => prev.filter((id) => !ids.includes(id)));
        } catch (err) {
            setDeleteError(err.message || "Could not delete. Please try again.");
        } finally {
            setDeletingProspects(false);
        }
    };

    // Companies section: "open this company's Home page" — mints a real
    // session token for that company on the backend (same shape Login.jsx
    // produces), stores it exactly where Login.jsx does, then hands off to
    // the normal /home route so nothing downstream needs to know this
    // wasn't a real login.
    const openCompanyHome = async (companyId) => {
        setImpersonateError("");
        setImpersonatingId(companyId);
        try {
            const res = await fetch(`${COMPANIES_ENDPOINT}/${companyId}/impersonate`, {
                method: "POST",
                headers: authHeaders(),
            });
            const resp = await res.json().catch(() => null);
            if (!res.ok || !resp?.success || !resp?.token) {
                throw new Error(resp?.message || `Could not open that company (${res.status})`);
            }
            localStorage.setItem("growthos_token", resp.token);
            localStorage.setItem("growthos_company", JSON.stringify(resp.company));
            // Normally the browser navigates away before this ever fires —
            // it's just a safety net in case the redirect gets blocked
            // (e.g. by a browser extension), so the card doesn't spin forever.
            setTimeout(() => setImpersonatingId((cur) => (cur === companyId ? null : cur)), 8000);
            window.location.href = "/home";
        } catch (err) {
            setImpersonateError(err.message || "Could not open that company's dashboard.");
            setImpersonatingId(null);
        }
    };

    useEffect(() => {
        fetchCompanies();
        fetchProspectCompanies();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // If the user clicks a company card, we do a full navigation to /home
    // (window.location.href), which unmounts this app entirely. Some
    // browsers restore the page from back/forward cache instead of a fresh
    // load when the user hits Back — which would otherwise leave that
    // card frozen mid-spinner forever, since no new render ever runs to
    // clear it. `pageshow` with `event.persisted` fires specifically for
    // that bfcache-restore case, so we clear the stuck state right then.
    useEffect(() => {
        const handlePageShow = (event) => {
            if (event.persisted) {
                setImpersonatingId(null);
                setImpersonateError("");
            }
        };
        window.addEventListener("pageshow", handlePageShow);
        return () => window.removeEventListener("pageshow", handlePageShow);
    }, []);

    const filteredCompanies = useMemo(() => {
        const q = companySearch.trim().toLowerCase();
        if (!q) return companies;
        return companies.filter((c) =>
            [c.company_name, c.email, c.industry_sector, c.company_type, c.website]
                .filter(Boolean)
                .some((v) => String(v).toLowerCase().includes(q))
        );
    }, [companies, companySearch]);

    const filteredProspectCompanies = useMemo(() => {
        const q = prospectSearch.trim().toLowerCase();
        return prospectCompanies.filter((l) => {
            const matchesSearch =
                !q ||
                [l.company_name, l.contact_person, l.email, l.industry, l.city].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
            const matchesStatus = prospectStatusFilter === "All" || l.status === prospectStatusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [prospectCompanies, prospectSearch, prospectStatusFilter]);

    const dashboardStats = useMemo(() => {
        const now = new Date();
        const newThisMonth = companies.filter((c) => {
            if (!c.created_at) return false;
            const d = new Date(c.created_at);
            return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        }).length;
        const converted = prospectCompanies.filter((l) => l.status === "Converted").length;
        const interested = prospectCompanies.filter((l) => l.status === "Interested" || l.status === "Contacted").length;
        return { newThisMonth, converted, interested };
    }, [companies, prospectCompanies]);

    const updateProspectForm = (field) => (e) => setProspectForm((f) => ({ ...f, [field]: e.target.value }));

    const closeProspectModal = () => {
        setModalOpen(false);
        setEditingProspectId(null);
    };

    const openAddProspectModal = () => {
        setEditingProspectId(null);
        setProspectForm(emptyProspectForm);
        setProspectFormError("");
        setModalOpen(true);
    };

    const openEditProspectModal = (l) => {
        setEditingProspectId(l.id);
        setProspectForm({
            company_name: l.company_name || "",
            contact_person: l.contact_person || "",
            email: l.email || "",
            phone: l.phone || "",
            website: l.website || "",
            industry: l.industry || "",
            city: l.city || "",
            status: l.status || "New",
            notes: l.notes || "",
        });
        setProspectFormError("");
        setModalOpen(true);
    };

    const handleSubmitProspect = async (e) => {
        e.preventDefault();
        if (!prospectForm.company_name.trim()) return setProspectFormError("Company name is required.");
        if (!prospectForm.contact_person.trim()) return setProspectFormError("Contact person is required.");
        if (!prospectForm.email.trim()) return setProspectFormError("Email is required.");

        setSavingProspect(true);
        setProspectFormError("");
        try {
            const isEditing = editingProspectId !== null;
            const res = await fetch(isEditing ? `${PROSPECT_COMPANIES_ENDPOINT}/${editingProspectId}` : PROSPECT_COMPANIES_ENDPOINT, {
                method: isEditing ? "PUT" : "POST",
                headers: { "Content-Type": "application/json", ...authHeaders() },
                body: JSON.stringify(prospectForm),
            });
            const resp = await res.json().catch(() => null);
            if (!res.ok || !resp?.success) throw new Error(resp?.message || `Request failed (${res.status})`);
            setModalOpen(false);
            setEditingProspectId(null);
            setProspectForm(emptyProspectForm);
            if (Array.isArray(resp.data)) {
                setProspectCompanies(resp.data);
            } else {
                fetchProspectCompanies();
            }
        } catch (err) {
            setProspectFormError(err.message || "Could not save this prospect company. Please try again.");
        } finally {
            setSavingProspect(false);
        }
    };

    const NavButton = ({ item, onClick }) => {
        const active = activeSection === item.key;
        return (
            <button
                type="button"
                onClick={() => {
                    setActiveSection(item.key);
                    onClick?.();
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-semibold transition ${
                    active ? "bg-orange-600 text-white" : "text-zinc-400 hover:bg-white/5 hover:text-white"
                }`}
            >
                <item.icon size={17} />
                {item.label}
            </button>
        );
    };

    const SidebarBody = ({ onNavigate }) => (
        <div className="flex h-full flex-col bg-[#0a0a0a]">
            <div className="flex shrink-0 items-center gap-2.5 px-6 py-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20">
                    <TrendingUp size={18} />
                </span>
                <div>
                    <p className="text-base font-extrabold leading-tight text-white">
                        GrowthOS <span className="text-orange-500">AI</span>
                    </p>
                    <p className="text-[11px] font-medium tracking-wide text-zinc-500">SuperAdmin</p>
                </div>
            </div>

            <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3">
                {NAV_ITEMS.map((item) => (
                    <NavButton key={item.key} item={item} onClick={onNavigate} />
                ))}
            </nav>

            <div className="shrink-0 px-3 pb-5 pt-3">
                <div className="rounded-2xl border border-orange-500/25 bg-orange-500/[0.05] p-4">
                    <p className="text-xs font-bold text-white">Platform overview</p>
                    <p className="mt-1 text-[11px] text-zinc-500">
                        {companies.length} companies · {prospectCompanies.length} in the pipeline
                    </p>
                </div>
            </div>
        </div>
    );

    return (
        <div className="relative min-h-screen w-full bg-[#050505] text-zinc-300">
            <style>{`
                .prospect-table-scroll {
                    scrollbar-width: thin;
                    scrollbar-color: rgba(249,115,22,0.5) transparent;
                }
                .prospect-table-scroll::-webkit-scrollbar {
                    height: 10px;
                    width: 10px;
                }
                .prospect-table-scroll::-webkit-scrollbar:vertical {
                    width: 0;
                }
                .prospect-table-scroll::-webkit-scrollbar-track {
                    background: rgba(255,255,255,0.04);
                }
                .prospect-table-scroll::-webkit-scrollbar-track:vertical {
                    background: transparent;
                }
                .prospect-table-scroll::-webkit-scrollbar-thumb {
                    background-color: rgba(249,115,22,0.5);
                    border-radius: 999px;
                }
                .prospect-table-scroll::-webkit-scrollbar-thumb:vertical {
                    background-color: transparent;
                }
                .prospect-table-scroll::-webkit-scrollbar-thumb:hover {
                    background-color: rgba(249,115,22,0.75);
                }
                .prospect-table-scroll::-webkit-scrollbar-corner {
                    background: transparent;
                }
            `}</style>
            {/* Desktop sidebar */}
            <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 shrink-0 border-r border-white/[0.07] lg:block">
                <SidebarBody />
            </aside>

            {/* Mobile top bar */}
            <div className="sticky top-0 z-30 flex items-center justify-between border-b border-white/[0.07] bg-[#0a0a0a] px-4 py-3 lg:hidden">
                <div className="flex items-center gap-2">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10 text-orange-400 ring-1 ring-orange-500/20">
                        <TrendingUp size={16} />
                    </span>
                    <p className="text-sm font-extrabold text-white">
                        GrowthOS <span className="text-orange-500">AI</span> <span className="text-zinc-500">· SuperAdmin</span>
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setMobileNavOpen(true)}
                    aria-label="Open menu"
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-zinc-300"
                >
                    <Menu size={18} />
                </button>
            </div>

            {mobileNavOpen && (
                <div className="fixed inset-0 z-40 lg:hidden">
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileNavOpen(false)} />
                    <aside className="absolute inset-y-0 left-0 w-72 border-r border-white/[0.07]">
                        <button
                            type="button"
                            onClick={() => setMobileNavOpen(false)}
                            aria-label="Close menu"
                            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 text-zinc-300"
                        >
                            <X size={16} />
                        </button>
                        <SidebarBody onNavigate={() => setMobileNavOpen(false)} />
                    </aside>
                </div>
            )}

            {/* Content */}
            <div className="flex h-screen w-full flex-col overflow-hidden lg:pl-64">
                <div className="mx-auto w-full flex-1 space-y-8 overflow-y-auto px-4 py-10 sm:px-6 sm:py-14 lg:px-10">
                    {/* ---------------------------- DASHBOARD ---------------------------- */}
                    {activeSection === "dashboard" && (
                        <div className="space-y-8">
                            <div>
                                <h1 className="text-2xl font-extrabold text-white sm:text-3xl">Dashboard</h1>
                                <p className="mt-1 text-sm text-zinc-500">Platform-wide overview across all companies on GrowthOS AI.</p>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                                <StatCard icon={Building2} value={companiesLoading ? "—" : companies.length} label="Total Companies" description="On GrowthOS AI" onClick={() => setActiveSection("companies")} />
                                <StatCard icon={CheckCircle2} value={companiesLoading ? "—" : dashboardStats.newThisMonth} label="New This Month" description="Companies registered" />
                                <StatCard icon={Target} value={prospectCompaniesLoading ? "—" : prospectCompanies.length} label="Prospect Companies" description="In the sales pipeline" onClick={() => setActiveSection("prospects")} />
                                <StatCard icon={Sparkles} value={prospectCompaniesLoading ? "—" : dashboardStats.converted} label="Converted" description="Became customers" />
                            </div>

                            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                                <div className="rounded-[24px] border border-white/[0.07] bg-white/[0.02] p-6 backdrop-blur-xl">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-sm font-semibold text-white">Recent Companies</h2>
                                        <button
                                            type="button"
                                            onClick={() => setActiveSection("companies")}
                                            className="text-xs font-semibold text-orange-400 hover:text-orange-300"
                                        >
                                            View all
                                        </button>
                                    </div>
                                    <div className="mt-4 space-y-2">
                                        {companiesLoading ? (
                                            <div className="flex items-center gap-2 text-sm text-zinc-500">
                                                <Loader2 size={14} className="animate-spin" /> Loading...
                                            </div>
                                        ) : companies.length === 0 ? (
                                            <p className="text-xs text-zinc-500">No companies yet.</p>
                                        ) : (
                                            companies.slice(0, 5).map((c) => (
                                                <div
                                                    key={c.id ?? c.company_name}
                                                    className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
                                                >
                                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-[11px] font-bold text-orange-300 ring-1 ring-orange-500/20">
                                                        {initials(c.company_name)}
                                                    </span>
                                                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-200">{c.company_name}</p>
                                                    {c.industry_sector && (
                                                        <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-medium text-zinc-400">
                                                            {c.industry_sector}
                                                        </span>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                <div className="rounded-[24px] border border-white/[0.07] bg-white/[0.02] p-6 backdrop-blur-xl">
                                    <div className="flex items-center justify-between">
                                        <h2 className="text-sm font-semibold text-white">Recent Prospect Companies</h2>
                                        <button
                                            type="button"
                                            onClick={() => setActiveSection("prospects")}
                                            className="text-xs font-semibold text-orange-400 hover:text-orange-300"
                                        >
                                            View all
                                        </button>
                                    </div>
                                    <div className="mt-4 space-y-2">
                                        {prospectCompaniesLoading ? (
                                            <div className="flex items-center gap-2 text-sm text-zinc-500">
                                                <Loader2 size={14} className="animate-spin" /> Loading...
                                            </div>
                                        ) : prospectCompanies.length === 0 ? (
                                            <p className="text-xs text-zinc-500">No prospect companies yet.</p>
                                        ) : (
                                            prospectCompanies.slice(0, 5).map((l) => (
                                                <div
                                                    key={l.id ?? l.company_name}
                                                    className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
                                                >
                                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-[11px] font-bold text-orange-300 ring-1 ring-orange-500/20">
                                                        {initials(l.company_name)}
                                                    </span>
                                                    <p className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-200">{l.company_name}</p>
                                                    <StatusBadge status={l.status} />
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ---------------------------- COMPANIES ---------------------------- */}
                    {activeSection === "companies" && (
                        <div className="space-y-6">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <h1 className="flex items-center gap-2 text-2xl font-extrabold text-white sm:text-3xl">
                                        <Building2 size={22} className="text-orange-500" /> Companies
                                    </h1>
                                    <p className="mt-1 text-sm text-zinc-500">Every company currently using GrowthOS AI.</p>
                                </div>
                                <div className="relative">
                                    <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                                    <input
                                        type="text"
                                        value={companySearch}
                                        onChange={(e) => setCompanySearch(e.target.value)}
                                        placeholder="Search companies..."
                                        className="w-56 rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-orange-600/50"
                                    />
                                </div>
                            </div>

                            {impersonateError && (
                                <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-2.5 text-xs font-medium text-red-300">
                                    {impersonateError}
                                </div>
                            )}

                            {companiesLoading ? (
                                <div className="flex items-center gap-2 text-sm text-zinc-500">
                                    <Loader2 size={14} className="animate-spin" /> Loading companies...
                                </div>
                            ) : filteredCompanies.length === 0 ? (
                                <div className="flex flex-col items-center gap-2 rounded-[24px] border border-dashed border-orange-600/30 py-14">
                                    <Building2 size={28} className="text-zinc-600" />
                                    <p className="text-sm text-zinc-500">
                                        {companies.length === 0 ? "No companies yet." : "No companies match your search."}
                                    </p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                                    {filteredCompanies.map((c) => {
                                        const location = [c.address_city, c.address_state, c.address_country].filter(Boolean).join(", ");
                                        const isOpening = impersonatingId === c.id;
                                        return (
                                            <div
                                                key={c.id ?? c.company_name}
                                                onClick={() => !isOpening && openCompanyHome(c.id)}
                                                role="button"
                                                tabIndex={0}
                                                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !isOpening && openCompanyHome(c.id)}
                                                title={`Open ${c.company_name}'s dashboard`}
                                                className={`relative flex flex-col rounded-[24px] border border-white/[0.08] bg-white/[0.02] p-5 backdrop-blur-xl transition hover:-translate-y-1 hover:border-orange-500/50 hover:shadow-[0_0_0_1px_rgba(255,107,0,0.25),0_20px_50px_-20px_rgba(255,107,0,0.35)] ${
                                                    isOpening ? "cursor-wait opacity-70" : "cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                                                }`}
                                            >
                                                {isOpening && (
                                                    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[24px] bg-black/50 backdrop-blur-sm">
                                                        <Loader2 size={20} className="animate-spin text-orange-400" />
                                                    </div>
                                                )}
                                                <div className="flex items-start justify-between gap-2">
                                                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 text-sm font-bold text-orange-300 ring-1 ring-orange-500/20">
                                                        {initials(c.company_name)}
                                                    </span>
                                                    {c.company_type && (
                                                        <span className="inline-flex shrink-0 rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-medium text-zinc-400">
                                                            {c.company_type}
                                                        </span>
                                                    )}
                                                </div>

                                                <h3 className="mt-3 truncate text-[15px] font-semibold text-white">{c.company_name}</h3>
                                                {c.industry_sector && (
                                                    <p className="flex items-center gap-1.5 text-xs text-zinc-500">
                                                        <Briefcase size={12} className="text-orange-500/70" /> {c.industry_sector}
                                                    </p>
                                                )}

                                                <div className="mt-4 space-y-1.5">
                                                    {c.email && (
                                                        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                                                            <Mail size={12} className="shrink-0 text-orange-500/70" />
                                                            <span className="truncate">{c.email}</span>
                                                        </div>
                                                    )}
                                                    {c.contact_number && (
                                                        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                                                            <Phone size={12} className="shrink-0 text-orange-500/70" />
                                                            {c.contact_number}
                                                        </div>
                                                    )}
                                                    {c.website && (
                                                        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                                                            <Globe size={12} className="shrink-0 text-orange-500/70" />
                                                            <span className="truncate">{c.website}</span>
                                                        </div>
                                                    )}
                                                    {location && (
                                                        <div className="flex items-start gap-1.5 text-xs text-zinc-500">
                                                            <MapPin size={12} className="mt-0.5 shrink-0 text-orange-500/70" />
                                                            <span className="leading-snug">{location}</span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3">
                                                    <span className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
                                                        <CreditCard size={12} className="text-orange-500/70" />
                                                        {c.phase || "—"}
                                                    </span>
                                                    {c.created_at && (
                                                        <span className="text-[11px] text-zinc-500">
                                                            Joined {String(c.created_at).slice(0, 10)}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ---------------------------- PROSPECT COMPANIES ---------------------------- */}
                    {activeSection === "prospects" && (
                        <div className="flex h-full min-h-0 flex-col space-y-6">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <h1 className="flex items-center gap-2 text-2xl font-extrabold text-white sm:text-3xl">
                                        <Target size={22} className="text-orange-500" /> Prospect Companies
                                    </h1>
                                    <p className="mt-1 text-sm text-zinc-500">Companies we're pitching GrowthOS AI to.</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".csv,.xlsx,.xls,.pdf"
                                        onChange={handleImportFile}
                                        className="hidden"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={importing}
                                        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-zinc-200 transition hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-orange-300 disabled:opacity-60"
                                    >
                                        {importing ? (
                                            <>
                                                <Loader2 size={16} className="animate-spin" /> Importing...
                                            </>
                                        ) : (
                                            <>
                                                <Upload size={16} /> Import
                                            </>
                                        )}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={openAddProspectModal}
                                        className="flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-500"
                                    >
                                        <Plus size={16} /> Add Prospect Company
                                    </button>
                                </div>
                            </div>

                            {importMessage && (
                                <div
                                    className={`rounded-xl border px-4 py-2.5 text-xs font-medium ${
                                        importMessage.type === "success"
                                            ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                                            : "border-red-500/25 bg-red-500/10 text-red-300"
                                    }`}
                                >
                                    {importMessage.text}
                                </div>
                            )}

                            <div className="flex flex-wrap items-center gap-3">
                                <div className="relative">
                                    <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                                    <input
                                        type="text"
                                        value={prospectSearch}
                                        onChange={(e) => setProspectSearch(e.target.value)}
                                        placeholder="Search prospect companies..."
                                        className="w-64 rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-orange-600/50"
                                    />
                                </div>
                                <div className="relative">
                                    <select
                                        value={prospectStatusFilter}
                                        onChange={(e) => setProspectStatusFilter(e.target.value)}
                                        className="cursor-pointer appearance-none rounded-xl border border-white/10 bg-white/5 py-2.5 pl-3.5 pr-8 text-sm text-white outline-none transition focus:border-orange-600/50"
                                    >
                                        <option value="All" className="bg-[#0a0a0a]">All statuses</option>
                                        {PROSPECT_STATUS_OPTIONS.map((s) => (
                                            <option key={s} value={s} className="bg-[#0a0a0a]">{s}</option>
                                        ))}
                                    </select>
                                    <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                                </div>

                                {selectedProspectIds.length > 0 && (
                                    <div className="ml-auto flex items-center gap-3 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-2">
                                        <span className="text-xs font-medium text-red-200">
                                            {selectedProspectIds.length} selected
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => deleteProspectCompanies(selectedProspectIds)}
                                            disabled={deletingProspects}
                                            className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-500 disabled:opacity-60"
                                        >
                                            {deletingProspects ? (
                                                <>
                                                    <Loader2 size={13} className="animate-spin" /> Deleting...
                                                </>
                                            ) : (
                                                <>
                                                    <Trash2 size={13} /> Delete selected
                                                </>
                                            )}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedProspectIds([])}
                                            className="text-xs text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                )}
                            </div>

                            {deleteError && (
                                <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-2.5 text-xs font-medium text-red-300">
                                    {deleteError}
                                </div>
                            )}

                            <div className="min-h-0 flex-1">
                                {prospectCompaniesLoading ? (
                                    <div className="flex items-center gap-2 text-sm text-zinc-500">
                                        <Loader2 size={14} className="animate-spin" /> Loading prospect companies...
                                    </div>
                                ) : filteredProspectCompanies.length === 0 ? (
                                    <div className="flex flex-col items-center gap-2 rounded-[24px] border border-dashed border-orange-600/30 py-14">
                                        <Inbox size={28} className="text-zinc-600" />
                                        <p className="text-sm text-zinc-500">
                                            {prospectCompanies.length === 0
                                                ? 'No prospect companies yet — import a list or click "Add Prospect Company" to add your first one.'
                                                : "No prospect companies match your filters."}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="prospect-table-scroll h-full overflow-y-auto overflow-x-hidden rounded-[24px] border border-white/[0.07] bg-white/[0.02] backdrop-blur-xl">
                                        <table className="w-full table-fixed text-left text-sm">
                                            <colgroup>
                                                <col className="w-[3%]" />
                                                <col className="w-[3%]" />
                                                <col className="w-[10%]" />
                                                <col className="w-[13%]" />
                                                <col className="w-[10%]" />
                                                <col className="w-[8%]" />
                                                <col className="w-[13%]" />
                                                <col className="w-[8%]" />
                                                <col className="w-[7%]" />
                                                <col className="w-[7%]" />
                                                <col className="w-[9%]" />
                                                <col className="w-[9%]" />
                                            </colgroup>
                                            <thead>
                                                <tr className="border-b border-white/[0.07] text-xs uppercase tracking-wide text-zinc-500">
                                                    <th className="px-2 py-3.5 font-semibold">
                                                    <input
                                                        type="checkbox"
                                                        className="h-4 w-4 cursor-pointer rounded border-white/20 bg-white/5 accent-orange-600"
                                                        checked={
                                                            filteredProspectCompanies.length > 0 &&
                                                            filteredProspectCompanies.every((l) => selectedProspectIds.includes(l.id))
                                                        }
                                                        onChange={() => toggleSelectAllProspects(filteredProspectCompanies.map((l) => l.id))}
                                                    />
                                                </th>
                                                <th className="px-2 py-3.5 font-semibold">SR</th>
                                                <th className="truncate px-2 py-3.5 font-semibold">Contact Person</th>
                                                <th className="truncate px-2 py-3.5 font-semibold">Company Name</th>
                                                <th className="truncate px-2 py-3.5 font-semibold">Website</th>
                                                <th className="truncate px-2 py-3.5 font-semibold">Category</th>
                                                <th className="truncate px-2 py-3.5 font-semibold">Email</th>
                                                <th className="truncate px-2 py-3.5 font-semibold">Contact No</th>
                                                <th className="truncate px-2 py-3.5 font-semibold">City</th>
                                                <th className="truncate px-2 py-3.5 font-semibold">Status</th>
                                                <th className="truncate px-2 py-3.5 font-semibold">Comments</th>
                                                <th className="truncate px-2 py-3.5 text-right font-semibold">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredProspectCompanies.map((l, i) => (
                                                <tr
                                                    key={l.id ?? `${l.company_name}-${i}`}
                                                    className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]"
                                                >
                                                    <td className="px-2 py-3.5">
                                                        <input
                                                            type="checkbox"
                                                            className="h-4 w-4 cursor-pointer rounded border-white/20 bg-white/5 accent-orange-600"
                                                            checked={selectedProspectIds.includes(l.id)}
                                                            onChange={() => toggleProspectSelected(l.id)}
                                                        />
                                                    </td>
                                                    <td className="truncate px-2 py-3.5 text-zinc-500">{i + 1}</td>
                                                    <td className="truncate px-2 py-3.5 text-zinc-300" title={l.contact_person || ""}>{l.contact_person || "—"}</td>
                                                    <td className="px-2 py-3.5">
                                                        <div className="flex items-center gap-2">
                                                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-500/10 text-[10px] font-bold text-orange-300 ring-1 ring-orange-500/20">
                                                                {initials(l.company_name)}
                                                            </span>
                                                            <p className="truncate font-medium text-white" title={l.company_name || ""}>{l.company_name}</p>
                                                        </div>
                                                    </td>
                                                    <td className="truncate px-2 py-3.5 text-xs text-zinc-400">
                                                        {l.website ? (
                                                            <a
                                                                href={l.website.startsWith("http") ? l.website : `https://${l.website}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                title={l.website}
                                                                className="text-orange-300 hover:text-orange-200 hover:underline"
                                                            >
                                                                {l.website}
                                                            </a>
                                                        ) : (
                                                            "—"
                                                        )}
                                                    </td>
                                                    <td className="truncate px-2 py-3.5 text-zinc-400" title={l.industry || ""}>{l.industry || "—"}</td>
                                                    <td className="truncate px-2 py-3.5 text-xs text-zinc-500" title={l.email || ""}>{l.email || "—"}</td>
                                                    <td className="truncate px-2 py-3.5 text-xs text-zinc-500" title={l.phone || ""}>{l.phone || "—"}</td>
                                                    <td className="truncate px-2 py-3.5 text-zinc-400" title={l.city || ""}>{l.city || "—"}</td>
                                                    <td className="truncate px-2 py-3.5">
                                                        <StatusBadge status={l.status} />
                                                    </td>
                                                    <td className="px-2 py-3.5 text-xs text-zinc-500">
                                                        <span className="line-clamp-2" title={l.notes || ""}>{l.notes || "—"}</span>
                                                    </td>
                                                    <td className="px-2 py-3.5 text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => setContactProspect(l)}
                                                                title="Contact this prospect"
                                                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-orange-500/40 text-orange-400 transition hover:bg-orange-500 hover:text-white hover:border-orange-500"
                                                            >
                                                                <PhoneCall size={13} />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => openEditProspectModal(l)}
                                                                title="Edit this prospect company"
                                                                className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-white/10 text-zinc-400 transition hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-orange-300"
                                                            >
                                                                <Pencil size={13} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ---------------------------- CUSTOMER 360 VIEW ---------------------------- */}
                    {/* Reuses Customer360Section.jsx's UI/logic unchanged (inlined above as
                        Customer360SectionAdmin) — only the data source is swapped, via the
                        CustomerDataContext/Provider inlined above it, which feeds it GrowthOS
                        AI's onboarded companies (mapped into the same field shape the component
                        already expects from a "lead"), instead of one company's own leads. */}
                    {activeSection === "customer360" && (
                        <div className="h-full min-h-0">
                            <CustomerDataProvider>
                                <Customer360SectionAdmin />
                            </CustomerDataProvider>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Prospect Company modal */}
            {modalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm"
                    onClick={() => closeProspectModal()}
                >
                    <div
                        className="relative flex max-h-[88vh] w-full max-w-lg flex-col rounded-2xl border border-orange-600/30 bg-[#0a0a0a] p-6 sm:p-8"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button
                            onClick={() => closeProspectModal()}
                            className="absolute right-5 top-5 text-zinc-500 transition hover:text-white"
                            aria-label="Close"
                        >
                            <X size={20} />
                        </button>

                        <h2 className="shrink-0 text-xl font-bold text-white">
                            {editingProspectId !== null ? "Edit Prospect Company" : "Add Prospect Company"}
                        </h2>

                        <form onSubmit={handleSubmitProspect} className="mt-5 flex min-h-0 flex-1 flex-col">
                            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold text-zinc-400">
                                        Company Name <span className="text-orange-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={prospectForm.company_name}
                                        onChange={updateProspectForm("company_name")}
                                        placeholder="e.g. Orbitrix Technologies"
                                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-orange-600/50"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-zinc-400">
                                            Contact Person <span className="text-orange-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={prospectForm.contact_person}
                                            onChange={updateProspectForm("contact_person")}
                                            placeholder="Full name"
                                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-orange-600/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-zinc-400">Industry</label>
                                        <input
                                            type="text"
                                            value={prospectForm.industry}
                                            onChange={updateProspectForm("industry")}
                                            placeholder="e.g. Real Estate"
                                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-orange-600/50"
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-zinc-400">
                                            Email <span className="text-orange-500">*</span>
                                        </label>
                                        <input
                                            type="email"
                                            value={prospectForm.email}
                                            onChange={updateProspectForm("email")}
                                            placeholder="name@company.com"
                                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-orange-600/50"
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-xs font-semibold text-zinc-400">Phone</label>
                                        <input
                                            type="text"
                                            value={prospectForm.phone}
                                            onChange={updateProspectForm("phone")}
                                            placeholder="+91..."
                                            className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-orange-600/50"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold text-zinc-400">City</label>
                                    <input
                                        type="text"
                                        value={prospectForm.city}
                                        onChange={updateProspectForm("city")}
                                        placeholder="e.g. Pune"
                                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-orange-600/50"
                                    />
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold text-zinc-400">Website</label>
                                    <input
                                        type="text"
                                        value={prospectForm.website}
                                        onChange={updateProspectForm("website")}
                                        placeholder="https://..."
                                        className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-orange-600/50"
                                    />
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold text-zinc-400">Status</label>
                                    <div className="relative">
                                        <select
                                            value={prospectForm.status}
                                            onChange={updateProspectForm("status")}
                                            className="w-full cursor-pointer appearance-none rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 pr-8 text-sm text-white outline-none transition focus:border-orange-600/50"
                                        >
                                            {PROSPECT_STATUS_OPTIONS.map((s) => (
                                                <option key={s} value={s} className="bg-[#0a0a0a]">{s}</option>
                                            ))}
                                        </select>
                                        <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-1.5 block text-xs font-semibold text-zinc-400">Notes</label>
                                    <textarea
                                        value={prospectForm.notes}
                                        onChange={updateProspectForm("notes")}
                                        rows={3}
                                        placeholder="Any context on this prospect..."
                                        className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-orange-600/50"
                                    />
                                </div>
                            </div>

                            {prospectFormError && <p className="mt-3 shrink-0 text-xs text-red-400">{prospectFormError}</p>}

                            <div className="flex shrink-0 justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => closeProspectModal()}
                                    disabled={savingProspect}
                                    className="rounded-lg px-4 py-2.5 text-sm font-semibold text-zinc-300 transition hover:bg-white/5 hover:text-white disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={savingProspect}
                                    className="rounded-lg bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:opacity-60"
                                >
                                    {savingProspect ? "Saving..." : editingProspectId !== null ? "Save Changes" : "Add Prospect Company"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {contactProspect && (
                <ContactProspectModal
                    prospect={contactProspect}
                    onClose={() => setContactProspect(null)}
                    onStatusChange={(id, status) => {
                        setProspectCompanies((prev) => prev.map((p) => (p.id === id ? { ...p, status } : p)));
                    }}
                />
            )}
        </div>
    );
};

export default SuperAdmin;