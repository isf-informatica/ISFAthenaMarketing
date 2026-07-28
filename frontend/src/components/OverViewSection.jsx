import React from "react";
import { Sparkles, BrainCircuit, Bot, BarChart3, Workflow } from "lucide-react";
import { getGreeting } from "./Greeting";

/* ==========================================================
   HERO SECTION (id="sec-overview")
   Fit-screen layout: fills the routed content area exactly,
   no internal page scroll needed.
========================================================== */
const HeroOverviewSection = () => {
    return (
        <section id="sec-overview" className="relative h-full overflow-hidden text-white z-10">
            <div className="absolute inset-0 bg-gradient-to-b from-orange-950/40 via-black to-black"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_40%)]"></div>

            <div className="h-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-4 sm:py-6 relative flex items-center">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 items-center w-full">
                    <div>
                        <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/10 border border-orange-600/30 px-4 py-1.5 text-xs sm:text-sm mb-4 backdrop-blur">
                            <Sparkles size={16} />
                            AI Powered Revenue Platform
                        </div>

                        <p className="text-orange-400 text-sm sm:text-base font-semibold mb-1">
                            {getGreeting()}, Aman 👋
                        </p>

                        <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold leading-tight text-white">
                            GrowthOS AI
                        </h1>

                        <p className="text-gray-300 text-lg sm:text-xl mt-3 font-semibold">
                            Autonomous Revenue Platform
                        </p>

                        <p className="mt-4 text-sm sm:text-base text-gray-300 leading-6 max-w-xl">
                            AI that generates, nurtures and closes revenue automatically.
                            A unified platform combining CRM, Marketing Automation,
                            Sales Enablement, AI Agents, Analytics and Business Intelligence
                            into one enterprise ecosystem.
                        </p>

                        <div className="flex flex-wrap gap-3 mt-6">
                            <button className="bg-orange-500 text-white font-semibold px-6 py-3 rounded-md hover:bg-orange-600 duration-300 text-sm">
                                Explore Platform
                            </button>
                            <button className="border border-orange-500 text-orange-500 px-6 py-3 rounded-md hover:bg-orange-500 hover:text-white duration-300 text-sm">
                                Request Demo
                            </button>
                        </div>
                    </div>

                    <div>
                        <div className="grid grid-cols-2 gap-3 sm:gap-4">
                            <div className="bg-black border border-orange-600/30 rounded-2xl p-4 sm:p-5">
                                <BrainCircuit className="text-orange-500 mb-3" size={32} />
                                <h3 className="text-base sm:text-lg font-bold text-white">AI Decision Engine</h3>
                                <p className="text-gray-300 mt-2 text-xs sm:text-sm">Predictive intelligence for marketing and sales.</p>
                            </div>

                            <div className="bg-black border border-orange-600/30 rounded-2xl p-4 sm:p-5">
                                <Bot className="text-orange-500 mb-3" size={32} />
                                <h3 className="text-base sm:text-lg font-bold text-white">AI Agents</h3>
                                <p className="text-gray-300 mt-2 text-xs sm:text-sm">Autonomous digital employees working 24x7.</p>
                            </div>

                            <div className="bg-black border border-orange-600/30 rounded-2xl p-4 sm:p-5">
                                <BarChart3 className="text-green-500 mb-3" size={32} />
                                <h3 className="text-base sm:text-lg font-bold text-white">Analytics</h3>
                                <p className="text-gray-300 mt-2 text-xs sm:text-sm">Real-time dashboards with predictive insights.</p>
                            </div>

                            <div className="bg-black border border-orange-600/30 rounded-2xl p-4 sm:p-5">
                                <Workflow className="text-orange-500 mb-3" size={32} />
                                <h3 className="text-base sm:text-lg font-bold text-white">Automation</h3>
                                <p className="text-gray-300 mt-2 text-xs sm:text-sm">AI powered workflows and omnichannel campaigns.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default HeroOverviewSection;