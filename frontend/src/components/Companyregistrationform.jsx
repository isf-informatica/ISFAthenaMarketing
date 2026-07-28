import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Building2,
  Upload,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  MapPin,
  Home,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  GrowthOS AI — Company Registration (3-step wizard)                 */
/*  Same dark theme as the rest of the app: #050505 bg, orange-600 /   */
/*  #FF6B00 accents, 20px rounded cards, glassmorphism.                */
/* ------------------------------------------------------------------ */

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const CURRENCIES = ["USD", "EUR", "GBP", "INR", "AED", "SGD", "AUD", "CAD", "Other"];

const PHASES = ["Idea", "Pre-Seed", "Seed", "Series A", "Series B", "Series C", "Growth", "Pre-IPO", "Other"];

const INDUSTRY_SECTORS = [
  "Technology", "Healthcare", "Finance & Fintech", "Retail & E-commerce",
  "Manufacturing", "Energy", "Real Estate", "Education", "Logistics", "Other",
];

const COMPANY_TYPES = [
  "Private Limited", "Public Limited", "LLP", "Partnership", "Sole Proprietorship", "Other",
];

// Compact list — dial code shown in the select so it doubles as the
// "country" selector for phone fields without needing an extra package.
const COUNTRIES = [
  { code: "US", name: "United States", dial: "+1", flag: "🇺🇸" },
  { code: "IN", name: "India", dial: "+91", flag: "🇮🇳" },
  { code: "GB", name: "United Kingdom", dial: "+44", flag: "🇬🇧" },
  { code: "AE", name: "United Arab Emirates", dial: "+971", flag: "🇦🇪" },
  { code: "SG", name: "Singapore", dial: "+65", flag: "🇸🇬" },
  { code: "AU", name: "Australia", dial: "+61", flag: "🇦🇺" },
  { code: "CA", name: "Canada", dial: "+1", flag: "🇨🇦" },
  { code: "DE", name: "Germany", dial: "+49", flag: "🇩🇪" },
  { code: "FR", name: "France", dial: "+33", flag: "🇫🇷" },
  { code: "JP", name: "Japan", dial: "+81", flag: "🇯🇵" },
];

const STEPS = ["Company Details", "Account & Contact", "Address"];

const emptyForm = {
  company_logo_url: "",
  company_name: "",
  date_of_incorporation: "",
  phase: "",
  industry_sector: "",
  company_type: "",
  registration_number: "",
  project_name: "",
  net_worth_currency: "USD",
  net_worth: "",
  raise_currency: "USD",
  amount_to_be_raised: "",
  corporate_jurisdiction: "",
  company_location: "",

  email: "",
  website: "",
  password: "",
  confirm_password: "",
  contact_country: "US",
  contact_number: "",
  contact_country_2: "US",
  contact_number_2: "",

  address_house: "",
  address_street: "",
  address_city: "",
  address_state: "",
  address_postal_code: "",
  address_country: "US",
  corr_house: "",
  corr_street: "",
  corr_city: "",
  corr_state: "",
  corr_postal_code: "",
  corr_country: "US",
};

/* ------------------------------ Bits ------------------------------ */

function Label({ children }) {
  return <label className="mb-1.5 block text-xs font-medium text-zinc-400">{children}</label>;
}

function TextInput({ label, value, onChange, placeholder, type = "text", error, ...rest }) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-xl border bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none transition focus:border-orange-500/60 focus:bg-white/[0.05] ${
          error ? "border-red-500/60" : "border-white/10"
        }`}
        {...rest}
      />
      {error && (
        <div className="mt-1 flex items-center gap-1 text-[11px] text-red-400">
          <AlertCircle size={12} />
          {error}
        </div>
      )}
    </div>
  );
}

// Shared by every "Other"-aware field: fetches previously-saved custom
// values for `field` on mount, and exposes a function to save a new one.
// Reused by SelectWithOther, CurrencyAmountInput, and PhoneInput so the
// fetch/save logic (and its de-dupe behavior) lives in exactly one place.
function useSavedDropdownOptions(field) {
  const [savedOptions, setSavedOptions] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/dropdown-options/${field}`);
        const data = await res.json();
        if (!cancelled && data?.success) setSavedOptions(data.data || []);
      } catch {
        // Static list still works even if this fetch fails.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [field]);

  const saveOption = async (typed) => {
    try {
      const res = await fetch(`${API_BASE}/dropdown-options/${field}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: typed }),
      });
      const data = await res.json();
      if (data?.success) setSavedOptions(data.data || []);
    } catch {
      // Still let the caller proceed with the typed value even if saving failed.
    }
  };

  return [savedOptions, saveOption];
}

function SelectInput({ label, value, onChange, options, placeholder = "Select" }) {
  return (
    <div>
      <Label>{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-orange-500/60 focus:bg-white/[0.05]"
      >
        <option value="" className="bg-[#0a0a0a]">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o} className="bg-[#0a0a0a]">{o}</option>
        ))}
      </select>
    </div>
  );
}

// Same as SelectInput, but for fields whose list ends in "Other". Picking
// "Other" reveals a text box; confirming it saves the typed value to the
// backend (custom_dropdown_options table) so it shows up as a normal
// option for every user from then on — de-duped case-insensitively,
// server-side, so two people typing "Fintech" and "fintech" collapse
// into one saved entry.
function SelectWithOther({ label, field, baseOptions, value, onChange, placeholder = "Select" }) {
  const [savedOptions, saveOption] = useSavedDropdownOptions(field);
  const [addingOther, setAddingOther] = useState(false);
  const [otherValue, setOtherValue] = useState("");
  const [saving, setSaving] = useState(false);

  const options = useMemo(() => {
    const fixed = baseOptions.filter((o) => o !== "Other");
    const merged = [...fixed];
    savedOptions.forEach((o) => {
      if (!merged.some((m) => m.toLowerCase() === o.toLowerCase())) merged.push(o);
    });
    merged.sort((a, b) => a.localeCompare(b));
    merged.push("Other");
    return merged;
  }, [baseOptions, savedOptions]);

  const handleSelect = (v) => {
    if (v === "Other") {
      setAddingOther(true);
      setOtherValue("");
      onChange("");
    } else {
      setAddingOther(false);
      onChange(v);
    }
  };

  const confirmOther = async () => {
    const typed = otherValue.trim();
    if (!typed) return;

    // If someone already saved this exact value (any case), just use it —
    // don't create a near-duplicate.
    const existing = options.find((o) => o !== "Other" && o.toLowerCase() === typed.toLowerCase());
    if (existing) {
      onChange(existing);
      setAddingOther(false);
      return;
    }

    setSaving(true);
    await saveOption(typed);
    setSaving(false);
    onChange(typed);
    setAddingOther(false);
  };

  return (
    <div>
      <Label>{label}</Label>
      <select
        value={addingOther ? "Other" : value}
        onChange={(e) => handleSelect(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white outline-none transition focus:border-orange-500/60 focus:bg-white/[0.05]"
      >
        <option value="" className="bg-[#0a0a0a]">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o} className="bg-[#0a0a0a]">{o}</option>
        ))}
      </select>

      {addingOther && (
        <div className="mt-2 flex gap-2">
          <input
            autoFocus
            value={otherValue}
            onChange={(e) => setOtherValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirmOther();
              }
            }}
            placeholder={`Type your ${label.toLowerCase()}`}
            className="flex-1 rounded-xl border border-orange-500/50 bg-white/[0.03] px-3.5 py-2 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-orange-500/70"
          />
          <button
            type="button"
            onClick={confirmOther}
            disabled={!otherValue.trim() || saving}
            className="shrink-0 rounded-xl bg-orange-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Add"}
          </button>
        </div>
      )}
    </div>
  );
}

function CurrencyAmountInput({ label, currency, onCurrencyChange, amount, onAmountChange }) {
  const [savedOptions, saveOption] = useSavedDropdownOptions("currency");
  const [addingOther, setAddingOther] = useState(false);
  const [otherValue, setOtherValue] = useState("");
  const [saving, setSaving] = useState(false);

  const options = useMemo(() => {
    const fixed = CURRENCIES.filter((c) => c !== "Other");
    const merged = [...fixed];
    savedOptions.forEach((o) => {
      if (!merged.some((m) => m.toLowerCase() === o.toLowerCase())) merged.push(o);
    });
    merged.push("Other");
    return merged;
  }, [savedOptions]);

  const handleSelect = (v) => {
    if (v === "Other") {
      setAddingOther(true);
      setOtherValue("");
      onCurrencyChange("");
    } else {
      setAddingOther(false);
      onCurrencyChange(v);
    }
  };

  const confirmOther = async () => {
    const typed = otherValue.trim().toUpperCase();
    if (!typed) return;
    const existing = options.find((o) => o !== "Other" && o.toLowerCase() === typed.toLowerCase());
    if (existing) {
      onCurrencyChange(existing);
      setAddingOther(false);
      return;
    }
    setSaving(true);
    await saveOption(typed);
    setSaving(false);
    onCurrencyChange(typed);
    setAddingOther(false);
  };

  return (
    <div>
      <div className="grid grid-cols-[100px_1fr] gap-2">
        <div>
          <Label>Currency</Label>
          <select
            value={addingOther ? "Other" : currency}
            onChange={(e) => handleSelect(e.target.value)}
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-2 py-2.5 text-sm text-white outline-none focus:border-orange-500/60"
          >
            {options.map((c) => (
              <option key={c} value={c} className="bg-[#0a0a0a]">{c}</option>
            ))}
          </select>
        </div>
        <div>
          <Label>{label}</Label>
          <input
            type="number"
            min="0"
            value={amount}
            onChange={(e) => onAmountChange(e.target.value)}
            placeholder="0.00"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-orange-500/60"
          />
        </div>
      </div>

      {addingOther && (
        <div className="mt-2 flex gap-2">
          <input
            autoFocus
            value={otherValue}
            onChange={(e) => setOtherValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirmOther();
              }
            }}
            placeholder="Type currency code (e.g. JPY)"
            maxLength={10}
            className="flex-1 rounded-xl border border-orange-500/50 bg-white/[0.03] px-3.5 py-2 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-orange-500/70"
          />
          <button
            type="button"
            onClick={confirmOther}
            disabled={!otherValue.trim() || saving}
            className="shrink-0 rounded-xl bg-orange-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Add"}
          </button>
        </div>
      )}
    </div>
  );
}

function PhoneInput({ label, country, onCountryChange, number, onNumberChange }) {
  const [savedOptions, saveOption] = useSavedDropdownOptions("phone_country");
  const [addingOther, setAddingOther] = useState(false);
  const [otherValue, setOtherValue] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSelect = (v) => {
    if (v === "Other") {
      setAddingOther(true);
      setOtherValue("");
      onCountryChange("");
    } else {
      setAddingOther(false);
      onCountryChange(v);
    }
  };

  const confirmOther = async () => {
    const typed = otherValue.trim();
    if (!typed) return;
    const existing = savedOptions.find((o) => o.toLowerCase() === typed.toLowerCase());
    if (existing) {
      onCountryChange(existing);
      setAddingOther(false);
      return;
    }
    setSaving(true);
    await saveOption(typed);
    setSaving(false);
    onCountryChange(typed);
    setAddingOther(false);
  };

  return (
    <div>
      <Label>{label}</Label>
      <div className="flex overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] focus-within:border-orange-500/60">
        <select
          value={addingOther ? "Other" : country}
          onChange={(e) => handleSelect(e.target.value)}
          className="border-r border-white/10 bg-transparent px-2 py-2.5 text-sm text-white outline-none"
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code} className="bg-[#0a0a0a]">
              {c.flag} {c.dial}
            </option>
          ))}
          {savedOptions.map((o) => (
            <option key={o} value={o} className="bg-[#0a0a0a]">{o}</option>
          ))}
          <option value="Other" className="bg-[#0a0a0a]">Other</option>
        </select>
        <input
          type="tel"
          value={number}
          onChange={(e) => onNumberChange(e.target.value)}
          placeholder="(201) 555-0123"
          className="flex-1 bg-transparent px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 outline-none"
        />
      </div>

      {addingOther && (
        <div className="mt-2 flex gap-2">
          <input
            autoFocus
            value={otherValue}
            onChange={(e) => setOtherValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                confirmOther();
              }
            }}
            placeholder="Type dial code + country (e.g. +992 Tajikistan)"
            className="flex-1 rounded-xl border border-orange-500/50 bg-white/[0.03] px-3.5 py-2 text-sm text-white placeholder:text-zinc-600 outline-none focus:border-orange-500/70"
          />
          <button
            type="button"
            onClick={confirmOther}
            disabled={!otherValue.trim() || saving}
            className="shrink-0 rounded-xl bg-orange-600 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Add"}
          </button>
        </div>
      )}
    </div>
  );
}

function StepIndicator({ step }) {
  return (
    <div className="mb-8 flex items-center">
      {STEPS.map((label, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step;
        return (
          <React.Fragment key={label}>
            <div className="flex flex-col items-center gap-2">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold transition ${
                  active
                    ? "bg-orange-600 text-white shadow-[0_0_20px_-4px_rgba(255,107,0,0.7)]"
                    : done
                    ? "bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/40"
                    : "bg-white/[0.04] text-zinc-500 ring-1 ring-white/10"
                }`}
              >
                {done ? <Check size={16} /> : n}
              </div>
              <span className={`text-[11px] ${active ? "text-white" : "text-zinc-500"}`}>{label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`mx-2 mb-5 h-px flex-1 ${n < step ? "bg-orange-500/50" : "bg-white/10"}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

/* ------------------------------ Page ------------------------------ */

export default function CompanyRegistrationForm({ onRegistered }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoFileName, setLogoFileName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [emailStatus, setEmailStatus] = useState("idle"); // idle | checking | taken | available
  const emailCheckTimer = useRef(null);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  /* ---- live "email already in use" check, debounced ---- */
  useEffect(() => {
    if (!form.email || !form.email.includes("@")) {
      setEmailStatus("idle");
      return;
    }
    setEmailStatus("checking");
    clearTimeout(emailCheckTimer.current);
    emailCheckTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API_BASE}/company-registrations/check-email?email=${encodeURIComponent(form.email)}`);
        const data = await res.json();
        setEmailStatus(data.exists ? "taken" : "available");
      } catch {
        setEmailStatus("idle");
      }
    }, 500);
    return () => clearTimeout(emailCheckTimer.current);
  }, [form.email]);

  const handleLogoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoFileName(file.name);
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API_BASE}/upload/company-logo`, { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      set("company_logo_url")(data.company_logo_url);
    } catch {
      setErrors((er) => ({ ...er, company_logo_url: "Could not upload logo — try again" }));
    } finally {
      setLogoUploading(false);
    }
  };

  const validateStep = (n) => {
    const e = {};
    if (n === 1) {
      if (!form.company_name.trim()) e.company_name = "Company name is required";
    }
    if (n === 2) {
      if (!form.email.includes("@")) e.email = "Enter a valid email";
      if (emailStatus === "taken") e.email = "Email already in use";
      if (form.password.length < 6) e.password = "At least 6 characters";
      if (form.password !== form.confirm_password) e.confirm_password = "Passwords do not match";
    }
    if (n === 3) {
      if (!form.address_house.trim()) e.address_house = "Required";
      if (!form.address_city.trim()) e.address_city = "Required";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const next = () => {
    if (validateStep(step)) setStep((s) => Math.min(3, s + 1));
  };
  const prev = () => setStep((s) => Math.max(1, s - 1));

  const copyAddressToCorrespondence = (checked) => {
    if (!checked) return;
    setForm((f) => ({
      ...f,
      corr_house: f.address_house,
      corr_street: f.address_street,
      corr_city: f.address_city,
      corr_state: f.address_state,
      corr_postal_code: f.address_postal_code,
      corr_country: f.address_country,
    }));
  };

  const submit = async () => {
    if (!validateStep(3)) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const payload = {
        ...form,
        net_worth: Number(form.net_worth) || 0,
        amount_to_be_raised: Number(form.amount_to_be_raised) || 0,
        contact_number: form.contact_number
          ? `${COUNTRIES.find((c) => c.code === form.contact_country)?.dial || form.contact_country || ""} ${form.contact_number}`
          : "",
        contact_number_2: form.contact_number_2
          ? `${COUNTRIES.find((c) => c.code === form.contact_country_2)?.dial || form.contact_country_2 || ""} ${form.contact_number_2}`
          : "",
      };
      const res = await fetch(`${API_BASE}/company-registrations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Registration failed");
      setSubmitted(true);
      onRegistered?.(data.data);
    } catch (err) {
      setSubmitError(err.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] px-4">
        <div className="max-w-md rounded-[20px] border border-orange-500/20 bg-white/[0.02] p-8 text-center backdrop-blur-xl">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-orange-500/15 text-orange-400">
            <Check size={26} />
          </div>
          <h2 className="text-xl font-semibold text-white">Registration submitted</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Your company has been registered. You can now log in with your email and password.
          </p>
          <a
            href="/login"
            className="mt-6 inline-block rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-500"
          >
            Go to Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-extrabold text-white">
            GrowthOS <span className="text-orange-500">AI</span>
          </h1>
          <p className="mt-1 text-sm text-zinc-500">Company Registration</p>
        </div>

        <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.02] p-6 shadow-[0_0_50px_-20px_rgba(255,107,0,0.25)] backdrop-blur-xl sm:p-8">
          <StepIndicator step={step} />

          {/* ---------------- Step 1 ---------------- */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <Label>Company Logo</Label>
                <div className="flex items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-orange-500/40">
                    {logoUploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                    Choose File
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                  </label>
                  <span className="text-xs text-zinc-500">{logoFileName || "No file chosen"}</span>
                </div>
                {errors.company_logo_url && (
                  <div className="mt-1 flex items-center gap-1 text-[11px] text-red-400">
                    <AlertCircle size={12} /> {errors.company_logo_url}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <TextInput label="Company Name" value={form.company_name} onChange={set("company_name")} placeholder="Name" error={errors.company_name} />
                <TextInput label="Date of Incorporation" type="date" value={form.date_of_incorporation} onChange={set("date_of_incorporation")} />
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
                <SelectWithOther label="Phase" field="phase" baseOptions={PHASES} value={form.phase} onChange={set("phase")} placeholder="Select Phase" />
                <SelectWithOther label="Industry Sector" field="industry_sector" baseOptions={INDUSTRY_SECTORS} value={form.industry_sector} onChange={set("industry_sector")} placeholder="Select Sector" />
                <SelectWithOther label="Company Type" field="company_type" baseOptions={COMPANY_TYPES} value={form.company_type} onChange={set("company_type")} placeholder="Select Type" />
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <TextInput label="Registration Number" value={form.registration_number} onChange={set("registration_number")} />
                <TextInput label="Name of the Project" value={form.project_name} onChange={set("project_name")} />
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <CurrencyAmountInput
                  label="Net Worth"
                  currency={form.net_worth_currency}
                  onCurrencyChange={set("net_worth_currency")}
                  amount={form.net_worth}
                  onAmountChange={set("net_worth")}
                />
                <CurrencyAmountInput
                  label="Amount to be Raised"
                  currency={form.raise_currency}
                  onCurrencyChange={set("raise_currency")}
                  amount={form.amount_to_be_raised}
                  onAmountChange={set("amount_to_be_raised")}
                />
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <TextInput label="Corporate Jurisdiction" value={form.corporate_jurisdiction} onChange={set("corporate_jurisdiction")} />
                <TextInput label="Location of the Company" value={form.company_location} onChange={set("company_location")} />
              </div>
            </div>
          )}

          {/* ---------------- Step 2 ---------------- */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <TextInput label="Email" type="email" value={form.email} onChange={set("email")} placeholder="you@company.com" error={errors.email} />
                  {!errors.email && emailStatus === "taken" && (
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-red-400">
                      <AlertCircle size={12} /> Email already in use!
                    </div>
                  )}
                  {!errors.email && emailStatus === "available" && (
                    <div className="mt-1 flex items-center gap-1 text-[11px] text-emerald-400">
                      <Check size={12} /> Email available
                    </div>
                  )}
                </div>
                <TextInput label="Website" value={form.website} onChange={set("website")} placeholder="https://" />
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <TextInput label="Password" type="password" value={form.password} onChange={set("password")} error={errors.password} />
                <TextInput label="Confirm Password" type="password" value={form.confirm_password} onChange={set("confirm_password")} error={errors.confirm_password} />
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <PhoneInput
                  label="Contact Number"
                  country={form.contact_country}
                  onCountryChange={set("contact_country")}
                  number={form.contact_number}
                  onNumberChange={set("contact_number")}
                />
                <PhoneInput
                  label="Another Contact Number"
                  country={form.contact_country_2}
                  onCountryChange={set("contact_country_2")}
                  number={form.contact_number_2}
                  onNumberChange={set("contact_number_2")}
                />
              </div>
            </div>
          )}

          {/* ---------------- Step 3 ---------------- */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-white">
                  <Home size={15} className="text-orange-500" />
                  Address
                </div>
                <div className="space-y-5">
                  <TextInput label="House / Building" value={form.address_house} onChange={set("address_house")} error={errors.address_house} />
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <TextInput label="Street Name" value={form.address_street} onChange={set("address_street")} />
                    <TextInput label="Town / City" value={form.address_city} onChange={set("address_city")} error={errors.address_city} />
                  </div>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <TextInput label="State" value={form.address_state} onChange={set("address_state")} />
                    <TextInput label="Postal Code" value={form.address_postal_code} onChange={set("address_postal_code")} />
                  </div>
                  <SelectInput
                    label="Country"
                    value={form.address_country}
                    onChange={set("address_country")}
                    options={COUNTRIES.map((c) => c.name)}
                    placeholder="Select Country"
                  />
                </div>
              </div>

              <div className="border-t border-white/[0.06] pt-6">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <MapPin size={15} className="text-orange-500" />
                    Correspondence Address
                  </div>
                  <label className="flex items-center gap-2 text-xs text-zinc-400">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 rounded border-white/20 bg-white/5 accent-orange-600"
                      onChange={(e) => copyAddressToCorrespondence(e.target.checked)}
                    />
                    Same As Entered
                  </label>
                </div>
                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <TextInput label="House / Building" value={form.corr_house} onChange={set("corr_house")} />
                    <TextInput label="Street Name" value={form.corr_street} onChange={set("corr_street")} />
                  </div>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <TextInput label="Town / City" value={form.corr_city} onChange={set("corr_city")} />
                    <TextInput label="State" value={form.corr_state} onChange={set("corr_state")} />
                  </div>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <TextInput label="Postal Code" value={form.corr_postal_code} onChange={set("corr_postal_code")} />
                    <SelectInput
                      label="Country"
                      value={form.corr_country}
                      onChange={set("corr_country")}
                      options={COUNTRIES.map((c) => c.name)}
                      placeholder="Select Country"
                    />
                  </div>
                </div>
              </div>

              {submitError && (
                <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                  <AlertCircle size={15} />
                  {submitError}
                </div>
              )}
            </div>
          )}

          {/* ---------------- Nav buttons ---------------- */}
          <div className="mt-8 flex items-center justify-between border-t border-white/[0.06] pt-6">
            <button
              onClick={prev}
              disabled={step === 1}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={15} />
              Previous
            </button>

            {step < 3 ? (
              <button
                onClick={next}
                className="inline-flex items-center gap-1.5 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-500"
              >
                Next
                <ChevronRight size={15} />
              </button>
            ) : (
              <button
                onClick={submit}
                disabled={submitting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-orange-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting && <Loader2 size={15} className="animate-spin" />}
                Submit
              </button>
            )}
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-zinc-500">
          Already registered?{" "}
          <a href="/login" className="font-medium text-orange-500 hover:text-orange-400">
            Log in
          </a>
        </p>
      </div>
    </div>
  );
}