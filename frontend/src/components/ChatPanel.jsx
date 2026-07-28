import React, { useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send, X } from "lucide-react";

/* ==========================================================
   CHAT PANEL
   Deliberately minimal: a message list and an input row, full
   stop. No settings gear, no key-entry form, no chip list
   competing for attention — just a working conversation. Both
   AIAssistantSection.jsx and FloatingAIBot.jsx render this the
   same way; the API key lives in groqConfig.js instead.
========================================================== */

const TypingDots = () => (
    <div className="flex items-center gap-1.5 px-1 py-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-bounce [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-bounce [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-bounce" />
    </div>
);

const ChatPanel = ({
    messages,
    isLoading,
    onSend,
    emptyStateHint = "Ask me to generate a campaign, predict revenue, draft a WhatsApp message, or analyze customer behaviour.",
    showHeader = false,
    title = "GrowthOS AI",
    subtitle = "How can I help?",
    onRequestClose,
    heightClass = "h-full",
}) => {
    const [input, setInput] = useState("");
    const scrollRef = useRef(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isLoading]);

    const submit = (text) => {
        const value = (text ?? input).trim();
        if (!value) return;
        setInput("");
        onSend(value);
    };

    return (
        <div className={`flex flex-col ${heightClass} min-h-0 bg-black`}>
            {showHeader && (
                <div className="flex items-center justify-between px-5 py-4 border-b border-orange-600/20 shrink-0">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
                            <Bot size={18} className="text-black" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-bold text-white leading-none truncate">{title}</p>
                            <p className="text-xs text-gray-500 mt-1 truncate">{subtitle}</p>
                        </div>
                    </div>
                    {onRequestClose && (
                        <button
                            onClick={onRequestClose}
                            title="Close"
                            className="h-8 w-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-gray-400 hover:text-white transition shrink-0"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>
            )}

            {/* messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-5 space-y-4 min-h-0">
                {messages.length === 0 && (
                    <div className="bg-black border border-orange-600/30 rounded-2xl p-4 max-w-[90%]">
                        <p className="text-gray-300 text-sm leading-6">{emptyStateHint}</p>
                    </div>
                )}

                {messages.map((m, i) => (
                    <div
                        key={i}
                        className={`rounded-2xl p-4 max-w-[85%] text-sm leading-6 whitespace-pre-wrap break-words ${
                            m.role === "user"
                                ? "bg-orange-500 text-black ml-auto"
                                : `bg-black border ${m.isError ? "border-red-500/40" : "border-orange-600/30"} text-gray-200`
                        }`}
                    >
                        {m.content}
                    </div>
                ))}

                {isLoading && (
                    <div className="bg-black border border-orange-600/30 rounded-2xl p-3 w-fit">
                        <TypingDots />
                    </div>
                )}
            </div>

            {/* input row */}
            <div className="px-5 py-4 border-t border-orange-600/20 shrink-0">
                <div className="flex items-center gap-2 bg-white/5 border border-white/10 focus-within:border-orange-600/50 rounded-xl px-3 py-2.5 transition">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && submit()}
                        placeholder="Ask GrowthOS AI anything..."
                        className="flex-1 min-w-0 bg-transparent outline-none text-sm text-white placeholder:text-gray-500"
                    />
                    <button
                        onClick={() => submit()}
                        disabled={isLoading || !input.trim()}
                        className="h-8 w-8 rounded-lg bg-orange-500 disabled:bg-orange-500/30 disabled:cursor-not-allowed hover:bg-orange-600 flex items-center justify-center shrink-0 transition"
                    >
                        {isLoading ? (
                            <Loader2 size={15} className="text-black animate-spin" />
                        ) : (
                            <Send size={15} className="text-black" />
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ChatPanel;