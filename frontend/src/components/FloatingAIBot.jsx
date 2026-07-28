import React, { useEffect, useState } from "react";
import { Bot, X } from "lucide-react";
import ChatPanel from "./ChatPanel";
import { useGroqChat } from "./useGroqChat";

/* ==========================================================
   FLOATING AI BOT
   Fixed to the bottom-right corner of the viewport (position:
   fixed + high z-index), so it stays in place while the page
   scrolls — same pattern as Intercom/Crisp-style launchers.
   Deliberately just a chat window: no capability chip list,
   no API key form — those live elsewhere (groqConfig.js and
   the AIAssistantSection capability cards respectively).
========================================================== */

const FloatingAIBot = () => {
    const [open, setOpen] = useState(false);
    const [mounted, setMounted] = useState(false);
    const { messages, isLoading, sendMessage } = useGroqChat();

    useEffect(() => {
        if (open) {
            setMounted(true);
        } else {
            const t = setTimeout(() => setMounted(false), 180);
            return () => clearTimeout(t);
        }
    }, [open]);

    return (
        <div className="fixed bottom-6 right-6 z-[999] flex flex-col items-end">
            {mounted && (
                <div
                    className={`mb-4 w-[360px] max-w-[92vw] bg-black border border-orange-600/30 rounded-3xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.85)] overflow-hidden transition-all duration-200 origin-bottom-right ${
                        open ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 translate-y-2"
                    }`}
                >
                    <ChatPanel
                        showHeader
                        title="GrowthOS AI"
                        subtitle="How can I help?"
                        onRequestClose={() => setOpen(false)}
                        heightClass="h-[460px]"
                        messages={messages}
                        isLoading={isLoading}
                        onSend={sendMessage}
                        emptyStateHint="Hi, I'm the GrowthOS AI copilot. Ask me anything about campaigns, leads or revenue."
                    />
                </div>
            )}

            <button
                onClick={() => setOpen((v) => !v)}
                title="GrowthOS AI Assistant"
                className="h-14 w-14 rounded-full bg-orange-500 hover:bg-orange-600 shadow-[0_8px_30px_rgba(249,115,22,0.45)] flex items-center justify-center transition duration-200 hover:scale-105 active:scale-95 relative shrink-0"
            >
                {open ? (
                    <X size={22} className="text-black" />
                ) : (
                    <>
                        <Bot size={24} className="text-black" />
                        <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-green-500 border-2 border-black" />
                    </>
                )}
            </button>
        </div>
    );
};

export default FloatingAIBot;