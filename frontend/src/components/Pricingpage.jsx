import React, { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Check, Sparkles } from "lucide-react";
import Starfield from "./Starfield";

const PLANS = [
    {
        id: "starter",
        name: "Starter",
        price: "₹999 – ₹2,999",
        period: "/month",
        tagline: "Perfect for getting going",
        features: ["CRM + basic automation", "Just enough AI to move faster", "Email support"],
        highlight: false,
    },
    {
        id: "growth",
        name: "Growth",
        price: "₹4,999 – ₹9,999",
        period: "/month",
        tagline: "For teams ready to level up",
        features: ["Full automation", "AI insights", "WhatsApp integration", "Priority support"],
        highlight: true,
    },
    {
        id: "pro",
        name: "Pro",
        price: "₹15,000 – ₹50,000",
        period: "/month",
        tagline: "Built for serious scale",
        features: ["AI agents", "Advanced analytics", "Custom workflows", "Dedicated success manager"],
        highlight: false,
    },
];

const PricingPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const productId = searchParams.get("product");

    // Defensive: covers landing here directly (e.g. a shared link, or a
    // page refresh) without having clicked a product card on Home first.
    useEffect(() => {
        if (productId) {
            localStorage.setItem("growthos_active_product_id", productId);
        }
    }, [productId]);

    const choosePlan = (planId) => {
        // No login/registration for now — go straight into the dashboard.
        // Carrying the product id forward so Lead Generation opens already
        // scoped to the product the user picked a plan for.
        const productQuery = productId ? `&product=${productId}` : "";
        navigate(`/app/dashboard-preview?plan=${planId}${productQuery}`);
    };

    return (
        <div className="min-h-screen w-full bg-black text-gray-300 relative overflow-hidden">
            <Starfield />

            <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 py-16 sm:py-20">
                <div className="text-center">
                    <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/10 border border-orange-600/30 px-4 py-1.5 text-sm mb-6">
                        <Sparkles size={16} className="text-orange-500" />
                        AI Powered Revenue Platform
                    </div>
                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white">
                        GrowthOS <span className="text-orange-500">AI</span>
                    </h1>
                    <p className="text-gray-400 mt-4 max-w-xl mx-auto">
                        Choose the plan that fits your team. Upgrade anytime as you grow.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-14">
                    {PLANS.map((plan) => (
                        <div
                            key={plan.id}
                            className={`relative flex flex-col rounded-2xl p-7 border transition duration-300 ${
                                plan.highlight
                                    ? "bg-gradient-to-b from-orange-950/40 to-black border-orange-500 shadow-[0_0_40px_rgba(249,115,22,0.15)]"
                                    : "bg-black border-orange-600/30 hover:border-orange-500/60"
                            }`}
                        >
                            {plan.highlight && (
                                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                                    MOST POPULAR
                                </span>
                            )}

                            <h3 className="text-2xl font-bold text-white">{plan.name}</h3>
                            <p className="text-gray-400 text-sm mt-1">{plan.tagline}</p>

                            <div className="mt-5">
                                <span className="text-2xl sm:text-3xl font-extrabold text-white">{plan.price}</span>
                                <span className="text-gray-500 text-sm">{plan.period}</span>
                            </div>

                            <ul className="mt-6 space-y-3 flex-1">
                                {plan.features.map((f) => (
                                    <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                                        <Check size={16} className="text-orange-500 shrink-0 mt-0.5" />
                                        {f}
                                    </li>
                                ))}
                            </ul>

                            <button
                                onClick={() => choosePlan(plan.id)}
                                className={`w-full mt-7 py-3 rounded-lg font-semibold transition duration-300 ${
                                    plan.highlight
                                        ? "bg-orange-500 text-white hover:bg-orange-600"
                                        : "border border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-white"
                                }`}
                            >
                                Choose {plan.name}
                            </button>
                        </div>
                    ))}
                </div>

                <p className="text-center text-gray-500 text-sm mt-10">
                    All plans include a free 14-day trial. Pick one to explore the dashboard.
                </p>
            </div>
        </div>
    );
};

export default PricingPage;