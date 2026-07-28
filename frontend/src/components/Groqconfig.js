/* ==========================================================
   GROQ CONFIG
   Reads the free Groq API key from your local .env file
   (VITE_GROQ_API_KEY) instead of being hardcoded here — this
   is what the chat (both AIAssistantSection and the floating
   bot) reads from. No key-entry form is shown in the UI.

   Setup: create a ".env" file in the project root (same level
   as package.json) with:
       VITE_GROQ_API_KEY=your-key-here
       VITE_GROQ_MODEL=llama-3.3-70b-versatile
   Get a free key at: https://console.groq.com/keys
   ".env" is in .gitignore — it never gets committed, so the
   real key never reaches GitHub. Restart "npm run dev" after
   creating/editing .env (Vite only reads it at startup).

   NOTE: since this is a plain client-side React app (no
   backend), whatever key ends up here still ships inside the
   JS bundle and is visible to anyone who opens devtools/network
   tab on your DEPLOYED site — .env only keeps it out of git,
   not out of the browser. That's an acceptable tradeoff for a
   personal project or internal demo. If this ever goes to real,
   public users, move this call behind your own backend route
   instead so the key never reaches the browser at all.
========================================================== */

export const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY || "";

export const GROQ_MODEL = import.meta.env.VITE_GROQ_MODEL || "llama-3.3-70b-versatile";