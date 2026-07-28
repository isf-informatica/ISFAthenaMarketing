import { useCallback, useState } from "react";
import { GROQ_API_KEY, GROQ_MODEL } from "./groqConfig";

/* ==========================================================
   GROQ CHAT HOOK
   Talks to Groq's free-tier chat completions API directly
   from the browser (OpenAI-compatible /chat/completions).
   The API key comes from groqConfig.js — set it there once
   and both the AIAssistantSection panel and the floating bot
   widget use it automatically.
========================================================== */

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = `You are the GrowthOS AI assistant — a helpful copilot embedded inside the GrowthOS AI CRM & marketing automation platform.
You help users with: generating marketing campaigns, predicting revenue, drafting WhatsApp/email messages, analyzing customer behaviour, optimizing sales pipelines, writing landing page copy, forecasting conversions, and recommending next actions.
Answer concisely in plain, confident language. Use short paragraphs or bullet points. When numbers are requested but not truly known, give a clearly-labelled illustrative estimate rather than inventing false certainty.`;

const isKeyConfigured = () =>
    Boolean(GROQ_API_KEY) && GROQ_API_KEY !== "PASTE_YOUR_GROQ_API_KEY_HERE";

export function useGroqChat() {
    const [messages, setMessages] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const sendMessage = useCallback(
        async (text, extraContext) => {
            const trimmed = (text || "").trim();
            if (!trimmed || isLoading) return;

            const userMessage = { role: "user", content: trimmed };
            const history = [...messages, userMessage];
            setMessages(history);

            if (!isKeyConfigured()) {
                setMessages((prev) => [
                    ...prev,
                    {
                        role: "assistant",
                        content:
                            "This assistant isn't wired up to a live model yet — add a Groq API key in groqConfig.js (get a free one at console.groq.com/keys) and I'll start replying for real.",
                        isSystemNotice: true,
                    },
                ]);
                return;
            }

            setIsLoading(true);
            try {
                // extraContext is optional and additive only — callers that
                // don't pass it (AI Assistant panel, floating widget) get
                // the exact same SYSTEM_PROMPT as before, unchanged.
                const systemContent = extraContext ? `${SYSTEM_PROMPT}\n\n${extraContext}` : SYSTEM_PROMPT;
                const res = await fetch(GROQ_ENDPOINT, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${GROQ_API_KEY}`,
                    },
                    body: JSON.stringify({
                        model: GROQ_MODEL,
                        temperature: 0.6,
                        max_tokens: 700,
                        messages: [
                            { role: "system", content: systemContent },
                            ...history.map((m) => ({ role: m.role, content: m.content })),
                        ],
                    }),
                });

                if (!res.ok) {
                    const body = await res.text().catch(() => "");
                    throw new Error(`Groq responded with ${res.status}. ${body.slice(0, 180)}`);
                }

                const data = await res.json();
                const reply =
                    data?.choices?.[0]?.message?.content?.trim() ||
                    "I didn't get a usable reply back — try rephrasing that.";

                setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
            } catch (err) {
                setMessages((prev) => [
                    ...prev,
                    {
                        role: "assistant",
                        content: `⚠️ Couldn't reach Groq (${err.message || "network error"}). Check the API key in groqConfig.js and try again.`,
                        isError: true,
                    },
                ]);
            } finally {
                setIsLoading(false);
            }
        },
        [messages, isLoading]
    );

    const resetChat = useCallback(() => setMessages([]), []);

    return {
        messages,
        isLoading,
        sendMessage,
        resetChat,
    };
}