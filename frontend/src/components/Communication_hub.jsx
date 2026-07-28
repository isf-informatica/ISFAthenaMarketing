import React, { useState, useRef, useEffect } from "react";
import {
    Search,
    MessageCircle,
    Mail,
    MessageSquare,
    Phone,
    Send,
    Paperclip,
    Smile,
    MoreVertical,
    Sparkles,
    RefreshCw,
    Check,
    CheckCheck,
    Loader2,
    Wand2,
} from "lucide-react";
import { GROQ_API_KEY, GROQ_MODEL } from "./groqConfig";

/* ==========================================================
   COMMUNICATION HUB (id="sec-communication-hub")
   3-column inbox: conversation list | chat thread | AI
   Assistant suggestions — matches the uploaded mock. Dummy
   conversation data for now (no `conversations`/`messages`
   table exists yet); "Generate More" / "Use AI Reply" call
   real Groq using the same key already used elsewhere in the
   app. Nothing sends automatically — the person always hits
   Send themselves (same Human Approval principle as the rest
   of GrowthOS AI).
========================================================== */

const CHANNELS = [
    { id: "all", label: "All", icon: MessageCircle },
    { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
    { id: "email", label: "Email", icon: Mail },
    { id: "sms", label: "SMS", icon: MessageSquare },
    { id: "calls", label: "Calls", icon: Phone },
];

const initials = (name) =>
    (name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";

const avatarColors = ["from-orange-400 to-orange-600", "from-blue-400 to-blue-600", "from-purple-400 to-purple-600", "from-green-400 to-green-600"];

const API_BASE_URL = "http://localhost:8000";
const CONVERSATIONS_ENDPOINT = `${API_BASE_URL}/conversations`;
const SEND_EMAIL_ENDPOINT = `${API_BASE_URL}/send-email`;
const SEND_SMS_ENDPOINT = `${API_BASE_URL}/send-sms`;
const SEND_WHATSAPP_ENDPOINT = `${API_BASE_URL}/send-whatsapp`;
const EMAIL_SUBJECT = "Message from GrowthOS AI";

const channelIcon = { whatsapp: MessageCircle, email: Mail, sms: MessageSquare, calls: Phone };

const formatConvoTime = (dbTimestamp) => {
    if (!dbTimestamp) return "";
    const then = new Date(dbTimestamp.replace(" ", "T"));
    const diffMs = Date.now() - then.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins} min ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs} hr${hrs > 1 ? "s" : ""} ago`;
    const days = Math.floor(hrs / 24);
    if (days < 2) return "Yesterday";
    return then.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
};

const CommunicationHub = () => {
    const [activeChannel, setActiveChannel] = useState("all");
    const [search, setSearch] = useState("");
    const [conversations, setConversations] = useState([]);
    const [conversationsLoading, setConversationsLoading] = useState(true);
    const [conversationsError, setConversationsError] = useState("");
    const [selectedId, setSelectedId] = useState(null);
    const [draft, setDraft] = useState("");
    const [sending, setSending] = useState(false);
    const [sendError, setSendError] = useState("");
    const scrollRef = useRef(null);

    const [messages, setMessages] = useState([]);
    const [messagesLoading, setMessagesLoading] = useState(false);

    const [suggestions, setSuggestions] = useState([
        "Sure! Sharing the details now.",
        "Great! Please let me know your budget range.",
        "Would you prefer a call to discuss in detail?",
    ]);
    const [generating, setGenerating] = useState(false);
    const [genError, setGenError] = useState("");

    const selected = conversations.find((c) => c.id === selectedId) || null;

    const fetchConversations = async () => {
        setConversationsLoading(true);
        setConversationsError("");
        try {
            const res = await fetch(CONVERSATIONS_ENDPOINT, { method: "GET" });
            const resp = await res.json();
            if (res.ok && resp.success && Array.isArray(resp.data)) {
                setConversations(resp.data);
                setSelectedId((prev) => (resp.data.some((c) => c.id === prev) ? prev : resp.data[0]?.id ?? null));
            } else {
                setConversations([]);
                setConversationsError("Couldn't load conversations.");
            }
        } catch (err) {
            setConversations([]);
            setConversationsError("Couldn't load conversations. Check your connection and try again.");
        } finally {
            setConversationsLoading(false);
        }
    };

    useEffect(() => {
        fetchConversations();
    }, []);

    const fetchMessages = async (conversationId) => {
        if (!conversationId) return;
        setMessagesLoading(true);
        try {
            const res = await fetch(`${CONVERSATIONS_ENDPOINT}/${conversationId}/messages`, { method: "GET" });
            const resp = await res.json();
            setMessages(res.ok && resp.success && Array.isArray(resp.data) ? resp.data : []);
        } catch (err) {
            setMessages([]);
        } finally {
            setMessagesLoading(false);
        }
    };

    useEffect(() => {
        if (selected?.id) fetchMessages(selected.id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected?.id]);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }, [messages]);

    const filteredConversations = conversations.filter((c) => {
        if (activeChannel !== "all" && c.channel !== activeChannel) return false;
        if (search.trim() && !c.lead_name.toLowerCase().includes(search.trim().toLowerCase())) return false;
        return true;
    });

    // Actually sends via the real channel endpoint (Email/SMS/WhatsApp),
    // same backend the Reachable Channels card uses — then refetches this
    // conversation's messages so the sent one shows up for real.
    const sendMessage = async (text) => {
        const trimmed = (text ?? draft).trim();
        if (!trimmed || !selected) return;
        setSending(true);
        setSendError("");
        try {
            let res;
            if (selected.channel === "email") {
                if (!selected.lead_email) throw new Error("This lead has no email on file.");
                res = await fetch(SEND_EMAIL_ENDPOINT, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        to_email: selected.lead_email,
                        to_name: selected.lead_name,
                        subject: EMAIL_SUBJECT,
                        message: trimmed,
                        lead_id: selected.lead_id,
                    }),
                });
            } else if (selected.channel === "sms") {
                if (!selected.lead_mobile_number) throw new Error("This lead has no phone number on file.");
                res = await fetch(SEND_SMS_ENDPOINT, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        to_number: selected.lead_mobile_number,
                        message: trimmed,
                        lead_id: selected.lead_id,
                    }),
                });
            } else if (selected.channel === "whatsapp") {
                // WhatsApp only sends the pre-approved template (see
                // ReachableChannelsCard) — free-text isn't possible outside
                // Meta's 24-hour reply window, so this box can't send raw
                // text here. Use the Reachable Channels card for WhatsApp.
                throw new Error("WhatsApp only supports the approved template — send from Lead Management/Customer 360 instead.");
            } else {
                throw new Error("Calls aren't sendable as messages yet — needs a telephony integration.");
            }

            const data = await res.json().catch(() => null);
            if (!res.ok || !data?.success) throw new Error(data?.error || "Send failed");

            setDraft("");
            fetchMessages(selected.id);
            fetchConversations(); // refresh last-message preview in the list
        } catch (err) {
            setSendError(err.message || "Couldn't send that message.");
        } finally {
            setSending(false);
        }
    };

    const isGroqConfigured =
        Boolean(GROQ_API_KEY) && GROQ_API_KEY !== "PASTE_YOUR_GROQ_API_KEY_HERE";

    const generateReplies = async () => {
        if (!selected) return;
        if (!isGroqConfigured) {
            setGenError("AI unavailable — add a Groq API key in groqConfig.js.");
            return;
        }
        setGenerating(true);
        setGenError("");
        try {
            const lastReceived = [...messages].reverse().find((m) => m.direction === "received");
            const context = lastReceived?.body || `${selected.lead_name}'s enquiry — no reply received yet, this is the first outreach`;
            const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_API_KEY}` },
                body: JSON.stringify({
                    model: GROQ_MODEL,
                    temperature: 0.7,
                    max_tokens: 250,
                    messages: [
                        {
                            role: "user",
                            content: `You are a helpful CRM sales assistant replying on behalf of the business. The customer (${selected.lead_name}) last said: "${context}". Suggest exactly 3 short, natural reply options (each under 15 words) the salesperson could send back. Return ONLY the 3 lines, no numbering, no extra text.`,
                        },
                    ],
                }),
            });
            if (!res.ok) throw new Error(`Groq responded with ${res.status}`);
            const data = await res.json();
            const text = data?.choices?.[0]?.message?.content?.trim() || "";
            const lines = text.split("\n").map((l) => l.replace(/^[-•\d.)\s]+/, "").trim()).filter(Boolean).slice(0, 3);
            if (lines.length) setSuggestions(lines);
        } catch (err) {
            setGenError("Couldn't reach the AI right now — try again in a moment.");
        } finally {
            setGenerating(false);
        }
    };

    return (
        <section id="sec-communication-hub" className="h-full flex flex-col overflow-hidden relative z-10 py-3 sm:py-4">
            <div className="w-full h-full flex flex-col min-h-0 px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="shrink-0">
                    <h2 className="text-2xl sm:text-3xl font-bold text-white">Communication Hub</h2>
                    <p className="text-gray-400 text-sm mt-1">All your conversations — WhatsApp, Email, SMS and Calls in one place.</p>
                </div>

                {/* Channel tabs */}
                <div className="flex items-center gap-1 mt-4 border-b border-white/10 shrink-0">
                    {CHANNELS.map((ch) => (
                        <button
                            key={ch.id}
                            onClick={() => setActiveChannel(ch.id)}
                            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition ${
                                activeChannel === ch.id
                                    ? "border-orange-500 text-orange-400"
                                    : "border-transparent text-gray-400 hover:text-white"
                            }`}
                        >
                            <ch.icon size={14} /> {ch.label}
                        </button>
                    ))}
                </div>

                {/* 3-column body */}
                <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr_300px] gap-3 mt-4 flex-1 min-h-0">
                    {/* Conversation list */}
                    <div className="bg-[#0d0d10] border border-white/10 rounded-2xl flex flex-col min-h-0 overflow-hidden">
                        <div className="p-3 border-b border-white/10 shrink-0">
                            <div className="relative">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search conversations..."
                                    className="w-full bg-black border border-white/10 rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-orange-500/60"
                                />
                            </div>
                        </div>
                        <div className="flex-1 min-h-0 overflow-y-auto">
                            {conversationsLoading && (
                                <p className="text-center text-xs text-gray-500 mt-6">Loading conversations...</p>
                            )}
                            {!conversationsLoading && conversationsError && (
                                <p className="text-center text-xs text-red-400 mt-6 px-3">{conversationsError}</p>
                            )}
                            {!conversationsLoading && !conversationsError && filteredConversations.length === 0 && (
                                <p className="text-center text-xs text-gray-500 mt-6 px-3">
                                    No conversations yet — send a message from Lead Management or Customer 360 to start one.
                                </p>
                            )}
                            {filteredConversations.map((c, i) => {
                                const ChIcon = channelIcon[c.channel] || MessageCircle;
                                return (
                                    <button
                                        key={c.id}
                                        onClick={() => setSelectedId(c.id)}
                                        className={`w-full text-left px-3 py-3 border-b border-white/5 flex items-start gap-2.5 transition ${
                                            selected?.id === c.id ? "bg-orange-500/10" : "hover:bg-white/[0.03]"
                                        }`}
                                    >
                                        <div className="relative shrink-0">
                                            <div className={`h-9 w-9 rounded-full bg-gradient-to-br ${avatarColors[i % avatarColors.length]} text-white text-xs font-bold flex items-center justify-center`}>
                                                {initials(c.lead_name)}
                                            </div>
                                            <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-black flex items-center justify-center">
                                                <ChIcon size={9} className="text-orange-400" />
                                            </span>
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-sm font-semibold text-white truncate">{c.lead_name}</p>
                                                <span className="text-[10px] text-gray-500 shrink-0">{formatConvoTime(c.last_message_at)}</span>
                                            </div>
                                            <p className="text-[11px] text-gray-500 truncate mt-0.5">{c.last_message_body || "No messages yet"}</p>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Chat thread */}
                    <div className="bg-[#0d0d10] border border-white/10 rounded-2xl flex flex-col min-h-0 overflow-hidden">
                        {selected ? (
                            <>
                                <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className={`h-9 w-9 rounded-full bg-gradient-to-br ${avatarColors[0]} text-white text-xs font-bold flex items-center justify-center shrink-0`}>
                                            {initials(selected.lead_name)}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-white truncate">{selected.lead_name}</p>
                                            <p className="text-[11px] text-gray-500 capitalize">{selected.channel}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 text-gray-400 shrink-0">
                                        <Phone size={15} className="hover:text-white cursor-pointer transition" />
                                        <Mail size={15} className="hover:text-white cursor-pointer transition" />
                                        <MoreVertical size={15} className="hover:text-white cursor-pointer transition" />
                                    </div>
                                </div>

                                <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3">
                                    {messagesLoading && <p className="text-center text-xs text-gray-500">Loading messages...</p>}
                                    {!messagesLoading && messages.length === 0 && (
                                        <p className="text-center text-xs text-gray-500 mt-4">No messages in this conversation yet.</p>
                                    )}
                                    {messages.map((m) => (
                                        <div key={m.id} className={`flex ${m.direction === "sent" ? "justify-end" : "justify-start"}`}>
                                            <div
                                                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed border ${
                                                    m.direction === "sent"
                                                        ? "bg-orange-500/15 border-orange-500/30 text-white rounded-br-sm"
                                                        : "bg-white/[0.06] border-white/10 text-gray-100 rounded-bl-sm"
                                                }`}
                                            >
                                                {m.body}
                                                <div className={`flex items-center gap-1 mt-1.5 ${m.direction === "sent" ? "justify-end text-orange-300/70" : "text-gray-500"}`}>
                                                    <span className="text-[10px]">{formatConvoTime(m.created_at)}</span>
                                                    {m.direction === "sent" && <CheckCheck size={11} />}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="px-4 py-3 border-t border-white/10 shrink-0">
                                    {sendError && <p className="text-[11px] text-red-400 mb-2">{sendError}</p>}
                                    <div className="flex items-center gap-2 bg-black border border-white/10 focus-within:border-orange-500/50 rounded-xl px-3 py-2.5">
                                        <Paperclip size={15} className="text-gray-500 shrink-0" />
                                        <Smile size={15} className="text-gray-500 shrink-0" />
                                        <input
                                            type="text"
                                            value={draft}
                                            onChange={(e) => setDraft(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                                            placeholder={
                                                selected.channel === "whatsapp"
                                                    ? "WhatsApp: use Lead Management/Customer 360 to send"
                                                    : selected.channel === "calls"
                                                    ? "Calls aren't sendable as messages yet"
                                                    : "Type a message..."
                                            }
                                            disabled={selected.channel === "whatsapp" || selected.channel === "calls" || sending}
                                            className="flex-1 min-w-0 bg-transparent outline-none text-sm text-white placeholder:text-gray-500 disabled:cursor-not-allowed"
                                        />
                                        <button
                                            onClick={() => sendMessage()}
                                            disabled={!draft.trim() || sending || selected.channel === "whatsapp" || selected.channel === "calls"}
                                            className="h-8 w-8 rounded-lg bg-orange-500 disabled:bg-orange-500/30 disabled:cursor-not-allowed hover:bg-orange-600 flex items-center justify-center shrink-0 transition"
                                        >
                                            {sending ? <Loader2 size={14} className="text-black animate-spin" /> : <Send size={14} className="text-black" />}
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">
                                {conversationsLoading ? "Loading..." : "Select a conversation"}
                            </div>
                        )}
                    </div>

                    {/* AI Assistant */}
                    <div className="bg-[#0d0d10] border border-white/10 rounded-2xl p-4 flex flex-col min-h-0 overflow-y-auto">
                        <h3 className="text-sm font-bold text-white flex items-center gap-1.5 shrink-0">
                            AI Assistant <Sparkles size={14} className="text-orange-500" />
                        </h3>
                        <p className="text-[11px] text-gray-500 mt-1 shrink-0">Suggested Replies</p>

                        <div className="space-y-2 mt-3 shrink-0">
                            {generating ? (
                                <div className="flex items-center gap-2 text-gray-400 text-xs p-3">
                                    <Loader2 size={13} className="animate-spin" /> Generating...
                                </div>
                            ) : (
                                suggestions.map((s, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setDraft(s)}
                                        className="w-full text-left bg-white/5 hover:bg-orange-500/10 border border-white/10 hover:border-orange-500/30 rounded-xl px-3 py-2.5 text-xs text-gray-200 transition"
                                    >
                                        {s}
                                    </button>
                                ))
                            )}
                        </div>

                        {genError && <p className="text-[11px] text-red-400 mt-2">{genError}</p>}

                        <button
                            onClick={generateReplies}
                            disabled={generating}
                            className="flex items-center justify-center gap-1.5 mt-3 text-xs font-semibold text-orange-400 hover:text-orange-300 disabled:opacity-50 shrink-0"
                        >
                            <RefreshCw size={12} className={generating ? "animate-spin" : ""} /> Generate More
                        </button>

                        <button
                            onClick={() => suggestions[0] && setDraft(suggestions[0])}
                            className="flex items-center justify-center gap-1.5 mt-3 bg-orange-500 hover:bg-orange-600 text-black text-xs font-bold py-2.5 rounded-lg transition shrink-0"
                        >
                            <Wand2 size={12} /> Use AI Reply
                        </button>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default CommunicationHub;