/* ==========================================================
   OPENAI CONFIG
   Reads your OpenAI API key from your local .env file
   (VITE_OPENAI_API_KEY) instead of being hardcoded here — this
   is what the "ChatGPT" lead source on the Lead Generation page
   reads from. No key-entry form is shown in the UI.

   Setup: create a ".env" file in the project root (same level
   as package.json) with:
       VITE_OPENAI_API_KEY=your-key-here
       VITE_OPENAI_MODEL=gpt-4o-mini
   Get a key at: https://platform.openai.com/api-keys
   (This is a PAID API, unlike Groq — OpenAI bills per token,
   there's no free tier. Check current pricing before generating
   a lot of leads.)
   ".env" is in .gitignore — it never gets committed, so the
   real key never reaches GitHub. Restart "npm run dev" after
   creating/editing .env (Vite only reads it at startup).

   NOTE: since this is a plain client-side React app (no
   backend proxy for this call), whatever key ends up here still
   ships inside the JS bundle and is visible to anyone who opens
   devtools/network tab on your DEPLOYED site — .env only keeps
   it out of git, not out of the browser. That's an acceptable
   tradeoff for a personal project or internal demo (same
   tradeoff groqConfig.js already documents). If this ever goes
   to real, public users, move this call behind your own backend
   route instead so the key never reaches the browser at all.
========================================================== */

export const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || "";

// gpt-4o-mini is the cost-efficient default — swap to "gpt-4o" for
// higher-quality prospect research at a higher per-token cost.
export const OPENAI_MODEL = import.meta.env.VITE_OPENAI_MODEL || "gpt-4o-mini";