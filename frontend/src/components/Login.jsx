import React, { useState } from "react";
import {
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  Building2,
  ShieldCheck,
  Sparkles,
  BarChart3,
  Users,
  BrainCircuit,
  ArrowRight,
} from "lucide-react";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export default function Login({ onLoggedIn }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok)
        throw new Error(data.detail || "Invalid email or password");

      localStorage.setItem("growthos_token", data.token);
      localStorage.setItem(
        "growthos_company",
        JSON.stringify(data.company)
      );

      onLoggedIn?.(data);

      window.location.href = "/home";
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050505]">

  {/* Background Glow */}
  <div className="absolute -left-40 top-20 h-96 w-96 rounded-full bg-orange-500/10 blur-[140px]" />
  <div className="absolute bottom-0 right-0 h-[450px] w-[450px] rounded-full bg-orange-600/5 blur-[170px]" />

  <div className="relative flex min-h-screen">

    {/* ================= LEFT SIDE ================= */}

    <div className="hidden lg:flex w-[45%] flex-col justify-between border-r border-white/5 p-14">

      {/* Logo */}

      <div>

        <div className="flex items-center gap-4">

          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/10 ring-1 ring-orange-500/20">

            <Building2 className="text-orange-500" size={28} />

          </div>

          <div>

            <h1 className="text-3xl font-black tracking-tight text-white">
              GrowthOS <span className="text-orange-500">AI</span>
            </h1>

            <p className="text-sm text-zinc-500">
              Autonomous Revenue Platform
            </p>

          </div>

        </div>

        <div className="mt-20">

          <h2 className="max-w-lg text-5xl font-black leading-tight text-white">

            Welcome back to
            <br />
            <span className="text-orange-500">GrowthOS AI</span>

          </h2>

          <p className="mt-8 max-w-xl text-lg leading-8 text-zinc-400">

            Manage leads, automate campaigns, nurture customers,
            close more deals and accelerate business growth with one
            intelligent AI powered CRM.

          </p>

        </div>

      </div>

      {/* Features */}

      <div className="grid grid-cols-2 gap-5">

        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-6 backdrop-blur-xl transition hover:border-orange-500/30 hover:bg-white/[0.05]">

          <Sparkles className="mb-4 text-orange-500" size={26} />

          <h3 className="font-semibold text-white">
            AI Powered Insights
          </h3>

          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Real-time business recommendations generated using AI.
          </p>

        </div>

        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-6 backdrop-blur-xl transition hover:border-orange-500/30 hover:bg-white/[0.05]">

          <Users className="mb-4 text-orange-500" size={26} />

          <h3 className="font-semibold text-white">
            Customer 360
          </h3>

          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Complete customer profile with timeline and AI intelligence.
          </p>

        </div>

        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-6 backdrop-blur-xl transition hover:border-orange-500/30 hover:bg-white/[0.05]">

          <BarChart3 className="mb-4 text-orange-500" size={26} />

          <h3 className="font-semibold text-white">
            Analytics & BI
          </h3>

          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Interactive dashboards and business performance reports.
          </p>

        </div>

        <div className="rounded-2xl border border-white/5 bg-white/[0.03] p-6 backdrop-blur-xl transition hover:border-orange-500/30 hover:bg-white/[0.05]">

          <BrainCircuit className="mb-4 text-orange-500" size={26} />

          <h3 className="font-semibold text-white">
            AI Command Center
          </h3>

          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Your autonomous AI workforce helping your business grow.
          </p>

        </div>

      </div>

      {/* Footer */}

      <div className="mt-16 flex items-center justify-between border-t border-white/5 pt-8">

        <div className="flex items-center gap-3">

          <ShieldCheck className="text-orange-500" size={22} />

          <div>

            <h4 className="text-sm font-semibold text-white">
              Enterprise Security
            </h4>

            <p className="text-xs text-zinc-500">
              Secure • Reliable • Privacy First
            </p>

          </div>

        </div>

      </div>

    </div>

    {/* ================= RIGHT SIDE ================= */}

    <div className="flex w-full items-center justify-center px-6 py-12 lg:w-[55%]">
        <div className="w-full max-w-xl">

  {/* Login Card */}

  <div className="rounded-[32px] border border-white/10 bg-white/[0.03] p-10 shadow-[0_30px_80px_rgba(255,107,0,0.15)] backdrop-blur-2xl">

    {/* Logo */}

    <div className="mb-10 text-center">

      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-orange-500/10 ring-1 ring-orange-500/20">

        <Building2 className="text-orange-500" size={38} />

      </div>

      <h2 className="mt-6 text-4xl font-black text-white">

        GrowthOS <span className="text-orange-500">AI</span>

      </h2>

      <p className="mt-3 text-base text-zinc-500">
        Sign in to your company account
      </p>

    </div>

    <form onSubmit={submit} className="space-y-7">

      {/* Email */}

      <div>

        <label className="mb-2 block text-sm font-medium text-zinc-400">
          Email Address
        </label>

        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className="h-14 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-white placeholder:text-zinc-600 outline-none transition focus:border-orange-500/60 focus:bg-white/[0.06]"
        />

      </div>

      {/* Password */}

      <div>

        <div className="mb-2 flex items-center justify-between">

          <label className="text-sm font-medium text-zinc-400">
            Password
          </label>

          <a
            href="/forgot-password"
            className="text-sm text-orange-500 hover:text-orange-400"
          >
            Forgot Password?
          </a>

        </div>

        <div className="relative">

          <input
            type={showPassword ? "text" : "password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="h-14 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-5 pr-14 text-white placeholder:text-zinc-600 outline-none transition focus:border-orange-500/60 focus:bg-white/[0.06]"
          />

          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
          >
            {showPassword ? (
              <EyeOff size={20} />
            ) : (
              <Eye size={20} />
            )}
          </button>

        </div>

      </div>

      {/* Remember */}

      <div className="flex items-center justify-between">

        <label className="flex items-center gap-3 text-sm text-zinc-400">

          <input
            type="checkbox"
            className="h-4 w-4 rounded border-zinc-700 bg-zinc-900 accent-orange-500"
          />

          Remember Me

        </label>

      </div>

      {/* Error */}

      {error && (

        <div className="flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-400">

          <AlertCircle size={18} />

          <span>{error}</span>

        </div>

      )}

      {/* Login Button */}

      <button
        type="submit"
        disabled={submitting}
        className="flex h-14 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 text-lg font-semibold text-white transition hover:scale-[1.02] hover:shadow-[0_0_35px_rgba(249,115,22,0.45)] disabled:cursor-not-allowed disabled:opacity-60"
      >

        {submitting && (
          <Loader2 size={20} className="animate-spin" />
        )}

        Sign In

        {!submitting && <ArrowRight size={18} />}

      </button>

    </form>

    {/* Register */}

    <div className="mt-10 border-t border-white/10 pt-8 text-center">

      <p className="text-sm text-zinc-500">

        Don't have a company account?

      </p>

      <a
        href="/register"
        className="mt-3 inline-flex items-center gap-2 text-orange-500 transition hover:text-orange-400"
      >

        Register Your Company

        <ArrowRight size={16} />

      </a>

    </div>

  </div>

</div>
        </div>

  </div>

  {/* Mobile Branding */}

  <div className="mt-10 block lg:hidden">

    <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">

      <div className="flex items-center gap-4">

        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-500/10">

          <Building2 className="text-orange-500" size={28} />

        </div>

        <div>

          <h3 className="text-xl font-bold text-white">

            GrowthOS <span className="text-orange-500">AI</span>

          </h3>

          <p className="text-sm text-zinc-500">

            Autonomous Revenue Platform

          </p>

        </div>

      </div>

      <p className="mt-6 text-sm leading-7 text-zinc-400">

        Manage leads, automate campaigns, nurture customers and
        accelerate your business with one intelligent CRM platform.

      </p>

    </div>

  </div>

</div>



);
}