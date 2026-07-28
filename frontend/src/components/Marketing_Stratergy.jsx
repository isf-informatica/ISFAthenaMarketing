import React from "react";
import {
    Sparkles,
    BrainCircuit,
    Bot,
    BarChart3,
    Users,
    ArrowRight,
    CheckCircle,
    CheckCircle2,
    ShieldCheck,
    Workflow,
    Cloud,
    TrendingUp,
    Rocket,
    Gem,
    Settings,
    Star,
    Zap,
    Lock,
    AlertTriangle,
    XCircle,
    Check,
    IndianRupee,
} from "lucide-react";

const MarketingStrategy = () => {
    return (
        <div className="bg-black text-gray-300 min-h-screen w-full overflow-x-hidden relative">

            {/* ---------------- BACKGROUND STARFIELD ---------------- */}

            <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">

                {[...Array(80)].map((_, i) => (
                    <div
                        key={i}
                        className="absolute bg-white rounded-full opacity-50"
                        style={{
                            width: Math.random() * 2 + 1 + "px",
                            height: Math.random() * 2 + 1 + "px",
                            top: Math.random() * 100 + "%",
                            left: Math.random() * 100 + "%",
                        }}
                    />
                ))}

            </div>

            {/* ---------------- HERO SECTION ---------------- */}

            <section className="relative overflow-hidden text-white z-10">

                <div className="absolute inset-0 bg-gradient-to-b from-orange-950/40 via-black to-black"></div>

                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_40%)]"></div>

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 py-16 sm:py-20 lg:py-24 relative">

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">

                        <div>

                            <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/10 border border-orange-600/30 px-5 py-2 text-sm mb-6 backdrop-blur">

                                <Sparkles size={18} />

                                AI Powered Revenue Platform

                            </div>

                            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold leading-tight text-white">

                                GrowthOS AI

                            </h1>

                            <p className="text-gray-300 text-2xl mt-6 font-semibold">

                                Autonomous Revenue Platform

                            </p>

                            <p className="mt-8 text-lg text-gray-300 leading-8">

                                AI that generates, nurtures and closes revenue automatically.

                                A unified platform combining CRM, Marketing Automation,
                                Sales Enablement, AI Agents, Analytics and Business Intelligence
                                into one enterprise ecosystem.
                            </p>

                            <div className="flex flex-wrap gap-5 mt-10">

                                <button className="bg-orange-500 text-white font-semibold px-8 py-4 rounded-md hover:bg-orange-600 duration-300">

                                    Explore Platform

                                </button>

                                <button className="border border-orange-500 text-orange-500 px-8 py-4 rounded-md hover:bg-orange-500 hover:text-white duration-300">

                                    Request Demo

                                </button>

                            </div>

                        </div>

                        <div>

                            <div className="grid grid-cols-2 gap-4 sm:gap-6">

                                <div className="bg-black border border-orange-600/30 rounded-2xl p-6 sm:p-8">

                                    <BrainCircuit className="text-orange-500 mb-5" size={50} />

                                    <h3 className="text-xl font-bold text-white">

                                        AI Decision Engine

                                    </h3>

                                    <p className="text-gray-300 mt-3">

                                        Predictive intelligence for marketing and sales.

                                    </p>

                                </div>

                                <div className="bg-black border border-orange-600/30 rounded-2xl p-6 sm:p-8">

                                    <Bot className="text-orange-500 mb-5" size={50} />

                                    <h3 className="text-xl font-bold text-white">

                                        AI Agents

                                    </h3>

                                    <p className="text-gray-300 mt-3">

                                        Autonomous digital employees working 24x7.

                                    </p>

                                </div>

                                <div className="bg-black border border-orange-600/30 rounded-2xl p-6 sm:p-8">

                                    <BarChart3 className="text-green-500 mb-5" size={50} />

                                    <h3 className="text-xl font-bold text-white">

                                        Analytics

                                    </h3>

                                    <p className="text-gray-300 mt-3">

                                        Real-time dashboards with predictive insights.

                                    </p>

                                </div>

                                <div className="bg-black border border-orange-600/30 rounded-2xl p-6 sm:p-8">

                                    <Workflow className="text-orange-500 mb-5" size={50} />

                                    <h3 className="text-xl font-bold text-white">

                                        Automation

                                    </h3>

                                    <p className="text-gray-300 mt-3">

                                        AI powered workflows and omnichannel campaigns.

                                    </p>

                                </div>

                            </div>

                        </div>

                    </div>

                </div>

            </section>

            {/* ---------------- VISION ---------------- */}

            <section className="py-16 sm:py-20 lg:py-24 border-t border-white/5 relative z-10">

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">

                    <div className="text-center">

                        <h2 className="text-3xl sm:text-4xl font-bold text-white">

                            The Unified AI Powered Growth OS

                        </h2>

                        <p className="mt-6 text-gray-300 max-w-3xl mx-auto text-lg">

                            Modern businesses use multiple disconnected tools.

                            GrowthOS AI unifies CRM, Marketing Automation,
                            AI Agents and Sales Intelligence into a single
                            intelligent platform.
                        </p>

                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 mt-16">

                        <div className="bg-black border border-orange-600/30 hover:border-orange-500 rounded-2xl p-6 sm:p-8 lg:p-10 transition duration-300">

                            <Users className="text-orange-500" size={55} />

                            <h3 className="text-2xl font-bold mt-6 text-white">

                                CRM + Marketing

                            </h3>

                            <p className="text-gray-300 mt-5">

                                Unified customer data with marketing campaigns
                                across Email, WhatsApp, SMS and Social Media.

                            </p>

                        </div>

                        <div className="bg-black border border-orange-600/30 hover:border-orange-500 rounded-2xl p-6 sm:p-8 lg:p-10 transition duration-300">

                            <Workflow className="text-green-500" size={55} />

                            <h3 className="text-2xl font-bold mt-6 text-white">

                                Sales Enablement

                            </h3>

                            <p className="text-gray-300 mt-5">

                                AI lead scoring, pipeline management,
                                opportunity tracking and smart automation.

                            </p>

                        </div>

                        <div className="bg-black border border-orange-600/30 hover:border-orange-500 rounded-2xl p-6 sm:p-8 lg:p-10 transition duration-300">

                            <BrainCircuit className="text-orange-500" size={55} />

                            <h3 className="text-2xl font-bold mt-6 text-white">

                                AI Decision Layer

                            </h3>

                            <p className="text-gray-300 mt-5">

                                Predictive insights,
                                autonomous execution and
                                intelligent recommendations.

                            </p>

                        </div>

                    </div>

                </div>

            </section>

            {/* ---------------- SOFTWARE REQUIREMENTS ---------------- */}

            <section className="py-16 sm:py-20 lg:py-24 border-t border-white/5 relative z-10">

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">

                    <div className="text-center">

                        <h2 className="text-3xl sm:text-4xl font-bold text-white">

                            Software Requirements

                        </h2>

                        <p className="text-gray-300 mt-5">

                            Enterprise ready architecture built for scalability,
                            automation and AI driven growth.

                        </p>

                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 mt-16">

                        {/* Functional */}

                        <div className="rounded-2xl border border-orange-600/30 p-6 sm:p-8 lg:p-10">

                            <h3 className="text-2xl font-bold text-orange-500 mb-8">

                                Functional Requirements

                            </h3>

                            <div className="space-y-5">

                                {[
                                    "Campaign Management",
                                    "Landing Page Builder",
                                    "Lead Capture & AI Scoring",
                                    "Sales Forecasting",
                                    "Customer 360° View",
                                    "Omnichannel Communication",
                                    "ROI Analytics",
                                    "Workflow Automation"
                                ].map((item) => (

                                    <div
                                        key={item}
                                        className="flex gap-4 items-center"
                                    >

                                        <CheckCircle
                                            className="text-green-500"
                                            size={22}
                                        />

                                        <span>{item}</span>

                                    </div>

                                ))}

                            </div>

                        </div>

                        {/* Non Functional */}

                        <div className="rounded-2xl border border-orange-600/30 p-6 sm:p-8 lg:p-10">

                            <h3 className="text-2xl font-bold text-orange-500 mb-8">

                                Non Functional Requirements

                            </h3>

                            <div className="space-y-5">

                                {[
                                    "Cloud Native",
                                    "Microservices Architecture",
                                    "API First Design",
                                    "Role Based Access",
                                    "GDPR & DPDP Compliance",
                                    "Real Time Processing",
                                    "High Availability",
                                    "Scalable Infrastructure"
                                ].map((item) => (

                                    <div
                                        key={item}
                                        className="flex gap-4 items-center"
                                    >

                                        <ShieldCheck
                                            className="text-orange-500"
                                            size={22}
                                        />

                                        <span>{item}</span>

                                    </div>

                                ))}

                            </div>

                        </div>

                    </div>

                </div>

            </section>
            {/* ==============================================
        CORE FEATURES
================================================ */}

            <section className="py-16 sm:py-20 lg:py-24 border-t border-white/5 relative z-10">

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">

                    <div className="text-center">

                        <span className="inline-block bg-orange-500/10 text-orange-400 border border-orange-600/30 px-4 py-2 rounded-full font-semibold">
                            Platform Capabilities
                        </span>

                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mt-8 text-white">
                            Core Features
                        </h2>

                        <p className="text-gray-300 mt-6 max-w-3xl mx-auto text-lg">
                            Everything a modern AI-powered CRM platform needs,
                            from lead management to intelligent automation.
                        </p>

                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 md:grid-cols-2 gap-8 mt-20">

                        {[
                            {
                                title: "Lead Management",
                                icon: Users,
                                desc: "Capture leads from websites, forms, WhatsApp and social media."
                            },
                            {
                                title: "Sales Pipeline",
                                icon: TrendingUp,
                                desc: "Kanban pipeline with AI opportunity scoring."
                            },
                            {
                                title: "Marketing Automation",
                                icon: Rocket,
                                desc: "Automate campaigns across Email, SMS & WhatsApp."
                            },
                            {
                                title: "Customer 360",
                                icon: Gem,
                                desc: "Unified customer profile with complete activity timeline."
                            },
                            {
                                title: "Workflow Builder",
                                icon: Settings,
                                desc: "Create automation without writing code."
                            },
                            {
                                title: "Analytics Dashboard",
                                icon: BarChart3,
                                desc: "Real-time insights with predictive reporting."
                            }
                        ].map((item, index) => (

                            <div
                                key={index}
                                className="bg-black border border-orange-600/30 hover:border-orange-500 rounded-2xl p-6 sm:p-8 transition duration-300">

                                <div className="w-14 h-14 rounded-xl bg-orange-500/10 border border-orange-600/30 flex items-center justify-center">
                                    <item.icon className="text-orange-500" size={28} />
                                </div>

                                <h3 className="text-2xl font-bold mt-6 text-white">
                                    {item.title}
                                </h3>

                                <p className="text-gray-300 mt-5 leading-7">
                                    {item.desc}
                                </p>

                            </div>

                        ))}

                    </div>

                </div>

            </section>

            {/* ==============================================
        ADVANCED FEATURES
================================================ */}

            <section className="py-16 sm:py-20 lg:py-24 border-t border-white/5 relative z-10">

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">

                    <div className="text-center">

                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">
                            AI Powered Differentiators
                        </h2>

                        <p className="text-gray-300 mt-6 max-w-3xl mx-auto">

                            Built to outperform traditional CRM platforms using
                            AI driven intelligence.

                        </p>

                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-20">

                        {[
                            "Hyper Segmentation",
                            "Predictive Lead Scoring",
                            "Journey Orchestration",
                            "No Code Automation",
                            "Multi Touch Attribution",
                            "Marketplace Integrations",
                            "AI Generated Campaigns",
                            "Customer Intent Prediction"
                        ].map((item, index) => (

                            <div
                                key={index}
                                className="flex items-center gap-5 bg-black border border-orange-600/30 rounded-2xl p-6">

                                <div className="h-12 w-12 rounded-full bg-orange-500 text-white flex items-center justify-center flex-shrink-0">

                                    <Check size={22} strokeWidth={3} />

                                </div>

                                <div>

                                    <h4 className="font-bold text-xl text-white">

                                        {item}

                                    </h4>

                                    <p className="text-gray-400 mt-2">

                                        Enterprise AI capability

                                    </p>

                                </div>

                            </div>

                        ))}

                    </div>

                </div>

            </section>

            {/* ==============================================
        AI EVERYWHERE
================================================ */}

            <section className="py-16 sm:py-20 lg:py-24 text-white border-t border-white/5 relative z-10">

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">

                    <div className="text-center">

                        <span className="inline-block bg-orange-500/20 text-orange-300 px-5 py-2 rounded-full">

                            Artificial Intelligence

                        </span>

                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mt-10 text-white">

                            AI Everywhere Architecture

                        </h2>

                        <p className="mt-6 text-gray-300 max-w-4xl mx-auto">

                            Artificial Intelligence isn't a feature.

                            It's the foundation of every module.

                        </p>

                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mt-20">

                        <div className="bg-white/5 backdrop-blur border border-orange-600/30 rounded-2xl p-6 sm:p-8 lg:p-10">

                            <h3 className="text-3xl font-bold text-white">

                                AI Marketing

                            </h3>

                            <ul className="space-y-5 mt-8 text-gray-300">

                                <li className="flex items-center gap-3"><CheckCircle2 className="text-orange-500 flex-shrink-0" size={18} /><span>Email Content Generator</span></li>

                                <li className="flex items-center gap-3"><CheckCircle2 className="text-orange-500 flex-shrink-0" size={18} /><span>Blog Writer</span></li>

                                <li className="flex items-center gap-3"><CheckCircle2 className="text-orange-500 flex-shrink-0" size={18} /><span>Landing Page Generator</span></li>

                                <li className="flex items-center gap-3"><CheckCircle2 className="text-orange-500 flex-shrink-0" size={18} /><span>Audience Segmentation</span></li>

                                <li className="flex items-center gap-3"><CheckCircle2 className="text-orange-500 flex-shrink-0" size={18} /><span>Predictive Send Time</span></li>

                                <li className="flex items-center gap-3"><CheckCircle2 className="text-orange-500 flex-shrink-0" size={18} /><span>Campaign Optimization</span></li>

                            </ul>

                        </div>

                        <div className="bg-white/5 backdrop-blur border border-orange-600/30 rounded-2xl p-6 sm:p-8 lg:p-10">

                            <h3 className="text-3xl font-bold text-white">

                                AI Sales

                            </h3>

                            <ul className="space-y-5 mt-8 text-gray-300">

                                <li className="flex items-center gap-3"><CheckCircle2 className="text-orange-500 flex-shrink-0" size={18} /><span>Lead Scoring</span></li>

                                <li className="flex items-center gap-3"><CheckCircle2 className="text-orange-500 flex-shrink-0" size={18} /><span>Deal Prediction</span></li>

                                <li className="flex items-center gap-3"><CheckCircle2 className="text-orange-500 flex-shrink-0" size={18} /><span>Smart Follow Ups</span></li>

                                <li className="flex items-center gap-3"><CheckCircle2 className="text-orange-500 flex-shrink-0" size={18} /><span>Conversation Intelligence</span></li>

                                <li className="flex items-center gap-3"><CheckCircle2 className="text-orange-500 flex-shrink-0" size={18} /><span>AI Sales Assistant</span></li>

                                <li className="flex items-center gap-3"><CheckCircle2 className="text-orange-500 flex-shrink-0" size={18} /><span>Win Probability</span></li>

                            </ul>

                        </div>

                        <div className="bg-white/5 backdrop-blur border border-orange-600/30 rounded-2xl p-6 sm:p-8 lg:p-10">

                            <h3 className="text-3xl font-bold text-white">

                                AI Analytics

                            </h3>

                            <ul className="space-y-5 mt-8 text-gray-300">

                                <li className="flex items-center gap-3"><CheckCircle2 className="text-orange-500 flex-shrink-0" size={18} /><span>Revenue Forecast</span></li>

                                <li className="flex items-center gap-3"><CheckCircle2 className="text-orange-500 flex-shrink-0" size={18} /><span>Churn Prediction</span></li>

                                <li className="flex items-center gap-3"><CheckCircle2 className="text-orange-500 flex-shrink-0" size={18} /><span>Customer Lifetime Value</span></li>

                                <li className="flex items-center gap-3"><CheckCircle2 className="text-orange-500 flex-shrink-0" size={18} /><span>ROI Tracking</span></li>

                                <li className="flex items-center gap-3"><CheckCircle2 className="text-orange-500 flex-shrink-0" size={18} /><span>Funnel Analysis</span></li>

                                <li className="flex items-center gap-3"><CheckCircle2 className="text-orange-500 flex-shrink-0" size={18} /><span>Auto Insights</span></li>

                            </ul>

                        </div>

                        <div className="bg-white/5 backdrop-blur border border-orange-600/30 rounded-2xl p-6 sm:p-8 lg:p-10">

                            <h3 className="text-3xl font-bold text-white">

                                AI Agents

                            </h3>

                            <ul className="space-y-5 mt-8 text-gray-300">

                                <li className="flex items-center gap-3"><CheckCircle2 className="text-orange-500 flex-shrink-0" size={18} /><span>AI Sales Representative</span></li>

                                <li className="flex items-center gap-3"><CheckCircle2 className="text-orange-500 flex-shrink-0" size={18} /><span>AI Marketing Manager</span></li>

                                <li className="flex items-center gap-3"><CheckCircle2 className="text-orange-500 flex-shrink-0" size={18} /><span>AI Customer Support</span></li>

                                <li className="flex items-center gap-3"><CheckCircle2 className="text-orange-500 flex-shrink-0" size={18} /><span>AI WhatsApp Assistant</span></li>

                                <li className="flex items-center gap-3"><CheckCircle2 className="text-orange-500 flex-shrink-0" size={18} /><span>AI Business Strategist</span></li>

                                <li className="flex items-center gap-3"><CheckCircle2 className="text-orange-500 flex-shrink-0" size={18} /><span>Autonomous Workflows</span></li>

                            </ul>

                        </div>

                    </div>

                </div>

            </section>

            {/* ==============================================
        USP
================================================ */}

            <section className="py-16 sm:py-20 lg:py-24 border-t border-white/5 relative z-10">

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">

                    <div className="text-center">

                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">

                            Why GrowthOS AI?

                        </h2>

                        <p className="text-gray-300 mt-6">

                            What makes the platform different from HubSpot,
                            Salesforce and Zoho.

                        </p>

                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 mt-20">

                        {[
                            {
                                title: "AI First Platform",
                                desc: "Built around AI instead of adding AI later."
                            },
                            {
                                title: "Autonomous Revenue",
                                desc: "AI captures, nurtures and converts leads automatically."
                            },
                            {
                                title: "Hyper Personalization",
                                desc: "Individual customer journeys powered by AI."
                            },
                            {
                                title: "No Code Automation",
                                desc: "Business users can automate everything."
                            },
                            {
                                title: "WhatsApp First",
                                desc: "Built specifically for Indian businesses."
                            },
                            {
                                title: "White Label SaaS",
                                desc: "Multi tenant platform ready for agencies."
                            }
                        ].map((item, index) => (

                            <div
                                key={index}
                                className="rounded-2xl bg-black border border-orange-600/30 hover:border-orange-500 p-6 sm:p-8 transition duration-300">

                                <div className="h-16 w-16 rounded-full bg-orange-500 text-white flex items-center justify-center flex-shrink-0">

                                    <Star size={30} fill="currentColor" />

                                </div>

                                <h3 className="text-2xl font-bold mt-8 text-white">

                                    {item.title}

                                </h3>

                                <p className="text-gray-300 mt-5 leading-8">

                                    {item.desc}

                                </p>

                            </div>

                        ))}

                    </div>

                </div>

            </section>
            {/* ======================================================
                COMPETITOR ANALYSIS
====================================================== */}

            <section className="py-16 sm:py-20 lg:py-24 border-t border-white/5 relative z-10">

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">

                    <div className="text-center">

                        <span className="inline-block bg-orange-500/10 text-orange-400 border border-orange-600/30 px-5 py-2 rounded-full">

                            Market Position

                        </span>

                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mt-8 text-white">

                            Competitor Comparison

                        </h2>

                        <p className="text-gray-300 mt-6 max-w-3xl mx-auto">

                            GrowthOS AI combines CRM, AI, Marketing Automation and
                            Business Intelligence into one unified platform.

                        </p>

                    </div>

                    <div className="overflow-x-auto mt-20 rounded-2xl border border-orange-600/30">

                        <table className="min-w-full bg-black">

                            <thead className="bg-orange-500 text-black">

                                <tr>

                                    <th className="px-4 sm:px-8 py-5 text-left whitespace-nowrap">Platform</th>
                                    <th className="px-4 sm:px-8 py-5 text-left">CRM</th>
                                    <th className="px-4 sm:px-8 py-5 text-left">Marketing</th>
                                    <th className="px-4 sm:px-8 py-5 text-left">AI</th>
                                    <th className="px-4 sm:px-8 py-5 text-left">WhatsApp</th>
                                    <th className="px-4 sm:px-8 py-5 text-left">Automation</th>

                                </tr>

                            </thead>

                            <tbody>

                                {[
                                    ["Salesforce", "yes", "partial", "yes", "no", "yes"],
                                    ["HubSpot", "yes", "yes", "partial", "no", "yes"],
                                    ["Zoho", "yes", "yes", "partial", "partial", "yes"],
                                    ["Freshworks", "yes", "partial", "yes", "no", "partial"],
                                    ["GrowthOS AI", "yes", "yes", "yes", "yes", "yes"],
                                ].map((item, index) => {

                                    const renderStatus = (status) => {
                                        if (status === "yes") return <CheckCircle2 className="text-green-500" size={22} />;
                                        if (status === "partial") return <AlertTriangle className="text-yellow-500" size={22} />;
                                        return <XCircle className="text-red-500" size={22} />;
                                    };

                                    return (
                                        <tr
                                            key={index}
                                            className={`border-b border-orange-600/20 hover:bg-orange-500/5 duration-300 ${item[0] === "GrowthOS AI" ? "bg-orange-500/10" : ""}`}>

                                            <td className="px-4 sm:px-8 py-5 font-semibold whitespace-nowrap">

                                                {item[0]}

                                            </td>

                                            <td className="px-4 sm:px-8 py-5">{renderStatus(item[1])}</td>
                                            <td className="px-4 sm:px-8 py-5">{renderStatus(item[2])}</td>
                                            <td className="px-4 sm:px-8 py-5">{renderStatus(item[3])}</td>
                                            <td className="px-4 sm:px-8 py-5">{renderStatus(item[4])}</td>
                                            <td className="px-4 sm:px-8 py-5">{renderStatus(item[5])}</td>

                                        </tr>
                                    );

                                })}

                            </tbody>

                        </table>

                    </div>

                </div>

            </section>

            {/* ======================================================
                ARCHITECTURE
====================================================== */}

            <section className="py-16 sm:py-20 lg:py-24 border-t border-white/5 relative z-10">

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">

                    <div className="text-center">

                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">

                            Platform Architecture

                        </h2>

                        <p className="text-gray-300 mt-6">

                            Enterprise Cloud Native AI Architecture

                        </p>

                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mt-20">

                        {[
                            {
                                title: "Experience Layer",
                                color: "bg-blue-600",
                                items: [
                                    "CRM",
                                    "Marketing",
                                    "Dashboard",
                                    "Mobile",
                                    "WhatsApp"
                                ]
                            },
                            {
                                title: "Data Layer",
                                color: "bg-indigo-600",
                                items: [
                                    "Customer Data Platform",
                                    "PostgreSQL",
                                    "MongoDB",
                                    "Redis",
                                    "Vector DB"
                                ]
                            },
                            {
                                title: "AI Layer",
                                color: "bg-cyan-600",
                                items: [
                                    "LLM",
                                    "AI Agents",
                                    "Prediction",
                                    "Recommendation",
                                    "Automation"
                                ]
                            },
                            {
                                title: "Cloud Layer",
                                color: "bg-green-600",
                                items: [
                                    "AWS",
                                    "Docker",
                                    "Kubernetes",
                                    "CI/CD",
                                    "Monitoring"
                                ]
                            }
                        ].map((layer, index) => (

                            <div
                                key={index}
                                className="rounded-2xl border border-orange-600/30 bg-black p-6 sm:p-8">

                                <div className={`${layer.color} h-16 rounded-2xl flex items-center justify-center text-white text-xl font-bold`}>

                                    {layer.title}

                                </div>

                                <ul className="space-y-4 mt-8">

                                    {layer.items.map((item) => (
                                        <li
                                            key={item}
                                            className="flex items-center gap-3">

                                            <div className="h-3 w-3 rounded-full bg-orange-500"></div>

                                            <span>{item}</span>

                                        </li>
                                    ))}

                                </ul>

                            </div>

                        ))}

                    </div>

                </div>

            </section>

            {/* ======================================================
                    TECH STACK
====================================================== */}

            <section className="py-16 sm:py-20 lg:py-24 border-t border-white/5 relative z-10">

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">

                    <div className="text-center">

                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">

                            Technology Stack

                        </h2>

                        <p className="text-gray-300 mt-6">

                            Modern enterprise technologies powering the platform.

                        </p>

                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-4 md:grid-cols-2 gap-8 mt-20">

                        {[
                            {
                                title: "Frontend",
                                tech: [
                                    "React.js",
                                    "Tailwind CSS",
                                    "React Native"
                                ]
                            },
                            {
                                title: "Backend",
                                tech: [
                                    "Node.js",
                                    "Express",
                                    "FastAPI"
                                ]
                            },
                            {
                                title: "Database",
                                tech: [
                                    "MySQL",
                                    "PostgreSQL",
                                    "MongoDB",
                                    "Redis"
                                ]
                            },
                            {
                                title: "Artificial Intelligence",
                                tech: [
                                    "OpenAI",
                                    "Claude",
                                    "Pinecone",
                                    "TensorFlow"
                                ]
                            }
                        ].map((stack, index) => (

                            <div
                                key={index}
                                className="bg-black border border-orange-600/30 rounded-2xl p-6 sm:p-8">

                                <h3 className="text-2xl font-bold text-orange-500">

                                    {stack.title}

                                </h3>

                                <div className="mt-8 space-y-4">

                                    {stack.tech.map((item) => (

                                        <div
                                            key={item}
                                            className="bg-black border border-orange-600/30 rounded-xl py-3 px-4">

                                            {item}

                                        </div>

                                    ))}

                                </div>

                            </div>

                        ))}

                    </div>

                </div>

            </section>

            {/* ======================================================
                PRODUCT ROADMAP
====================================================== */}

            <section className="py-16 sm:py-20 lg:py-24 border-t border-white/5 relative z-10">

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">

                    <div className="text-center">

                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">

                            Product Roadmap

                        </h2>

                        <p className="text-gray-300 mt-6">

                            Future vision of GrowthOS AI.

                        </p>

                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mt-20">

                        {[
                            {
                                phase: "Now",
                                desc: "CRM, Marketing Automation, WhatsApp Integration"
                            },
                            {
                                phase: "6 Months",
                                desc: "AI Agents, Predictive Analytics, White Label"
                            },
                            {
                                phase: "12 Months",
                                desc: "Voice AI CRM, Autonomous Workflows"
                            },
                            {
                                phase: "18+ Months",
                                desc: "AI Business Consultant, Industry Templates"
                            }
                        ].map((item, index) => (

                            <div
                                key={index}
                                className="relative">

                                <div className="bg-black border border-orange-600/40 text-white rounded-2xl p-6 sm:p-8">

                                    <div className="text-3xl sm:text-4xl lg:text-5xl font-bold">

                                        0{index + 1}

                                    </div>

                                    <h3 className="text-2xl font-bold mt-6 text-white">

                                        {item.phase}

                                    </h3>

                                    <p className="mt-5 leading-8">

                                        {item.desc}

                                    </p>

                                </div>

                            </div>

                        ))}

                    </div>

                </div>

            </section>

            {/* ======================================================
                STRATEGIC VISION
====================================================== */}

            <section className="py-16 sm:py-20 lg:py-24 text-white border-t border-white/5 relative z-10">

                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 text-center">

                    <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">

                        The Future of Business Growth

                    </h2>

                    <p className="text-xl leading-10 mt-10 text-gray-300">

                        Companies that win won't simply use software.

                        They'll use AI employees.

                        GrowthOS AI becomes the operating system that captures,
                        nurtures, converts and optimizes revenue automatically.

                    </p>

                    <button className="mt-12 bg-orange-500 text-white px-10 py-5 rounded-lg font-bold hover:bg-orange-600 duration-300">

                        Explore Future Platform →

                    </button>

                </div>

            </section>
            {/* ======================================================
                DASHBOARD PREVIEW
====================================================== */}

            <section className="py-16 sm:py-20 lg:py-24 border-t border-white/5 relative z-10">

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">

                    <div className="text-center">

                        <span className="inline-block bg-orange-500/10 text-orange-400 border border-orange-600/30 px-5 py-2 rounded-full font-semibold">
                            Product Preview
                        </span>

                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mt-8 text-white">
                            AI Powered Dashboard
                        </h2>

                        <p className="text-gray-300 mt-6 max-w-3xl mx-auto">
                            Monitor revenue, campaigns, customers and AI recommendations from a
                            single intelligent dashboard.
                        </p>

                    </div>

                    {/* KPI Cards */}

                    <div className="grid grid-cols-1 lg:grid-cols-4 md:grid-cols-2 gap-8 mt-16">

                        {[
                            {
                                value: "$4.59M",
                                title: "Revenue"
                            },
                            {
                                value: "31.9M",
                                title: "Impressions"
                            },
                            {
                                value: "406K",
                                title: "Clicks"
                            },
                            {
                                value: "5.2K",
                                title: "Deals Closed"
                            }

                        ].map((item, index) => (

                            <div
                                key={index}
                                className="bg-black border border-orange-600/30 hover:border-orange-500 rounded-2xl p-6 sm:p-8 transition duration-300">

                                <h2 className="text-3xl sm:text-4xl font-bold text-orange-500">

                                    {item.value}

                                </h2>

                                <p className="mt-4 text-gray-300">

                                    {item.title}

                                </p>

                            </div>

                        ))}

                    </div>

                    {/* Dashboard Layout */}

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mt-14">

                        {/* Revenue */}

                        <div className="lg:col-span-2 bg-black border border-orange-600/30 rounded-2xl p-6 sm:p-8">

                            <div className="flex justify-between items-center">

                                <h3 className="text-2xl font-bold text-white">

                                    Revenue Overview

                                </h3>

                                <span className="bg-green-500/10 text-green-400 border border-green-600/30 px-4 py-2 rounded-full">

                                    +24%

                                </span>

                            </div>

                            <div className="mt-10">

                                <div className="flex justify-between items-center mb-6">

                                    <p className="text-gray-400 text-sm">

                                        Revenue Growth Chart

                                    </p>

                                    <p className="text-gray-500 text-xs">

                                        Revenue (₹ Cr)

                                    </p>

                                </div>

                                <div className="relative h-52">

                                    <div className="absolute inset-0 flex flex-col justify-between">

                                        {[0, 1, 2, 3, 4].map((line) => (
                                            <div key={line} className="border-t border-dashed border-orange-600/20 w-full" />
                                        ))}

                                    </div>

                                    <div className="relative h-full flex items-end justify-between gap-4 sm:gap-8 px-2">

                                        {[
                                            { year: "Year 1", value: 2, color: "bg-orange-700" },
                                            { year: "Year 2", value: 10, color: "bg-orange-600" },
                                            { year: "Year 3", value: 50, color: "bg-orange-500" },
                                            { year: "Year 4", value: 100, color: "bg-orange-400" },
                                        ].map((bar) => (
                                            <div key={bar.year} className="flex-1 h-full flex flex-col items-center justify-end">

                                                <div
                                                    className={`w-full max-w-[70px] rounded-t-md ${bar.color}`}
                                                    style={{ height: `${(bar.value / 100) * 100}%` }}
                                                />

                                            </div>
                                        ))}

                                    </div>

                                </div>

                                <div className="flex justify-between px-2 mt-3">

                                    {["Year 1", "Year 2", "Year 3", "Year 4"].map((year) => (
                                        <span key={year} className="flex-1 text-center text-gray-500 text-sm">

                                            {year}

                                        </span>
                                    ))}

                                </div>

                            </div>

                        </div>

                        {/* AI Insights */}

                        <div className="bg-black border border-orange-600/30 rounded-2xl p-6 sm:p-8">

                            <h3 className="text-2xl font-bold text-white">

                                AI Insights

                            </h3>

                            <div className="space-y-5 mt-8">

                                {[
                                    "Revenue increased by 18%",
                                    "WhatsApp campaigns performing best",
                                    "Follow-up pending for 36 leads",
                                    "3 deals likely to close today",
                                    "Marketing ROI improved by 26%"
                                ].map((item, index) => (

                                    <div
                                        key={index}
                                        className="bg-black border border-orange-600/30 rounded-2xl p-5">

                                        {item}

                                    </div>

                                ))}

                            </div>

                        </div>

                    </div>

                </div>

            </section>

            {/* ======================================================
                    SALES PIPELINE
====================================================== */}

            <section className="py-16 sm:py-20 lg:py-24 border-t border-white/5 relative z-10">

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">

                    <div className="text-center">

                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">

                            Sales Pipeline

                        </h2>

                        <p className="text-gray-300 mt-6">

                            AI driven Kanban board with deal prediction.

                        </p>

                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mt-20">

                        {[
                            {
                                title: "Prospects",
                                accent: "text-sky-400",
                                bg: "bg-sky-500/5",
                                border: "border-sky-500/30",
                                badge: "bg-sky-500/10 text-sky-400 border-sky-500/30",
                                cards: ["Meridian Realty Group", "Novatech Industries", "BlueWave Logistics"]
                            },
                            {
                                title: "Qualified",
                                accent: "text-yellow-400",
                                bg: "bg-yellow-500/5",
                                border: "border-yellow-500/30",
                                badge: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
                                cards: ["Apex Healthcare Systems", "Brightpath Education Trust"]
                            },
                            {
                                title: "Proposal",
                                accent: "text-purple-400",
                                bg: "bg-purple-500/5",
                                border: "border-purple-500/30",
                                badge: "bg-purple-500/10 text-purple-400 border-purple-500/30",
                                cards: ["Sterling Manufacturing Co.", "Coastal Retail Chain"]
                            },
                            {
                                title: "Closed Won",
                                accent: "text-green-400",
                                bg: "bg-green-500/5",
                                border: "border-green-500/30",
                                badge: "bg-green-500/10 text-green-400 border-green-500/30",
                                cards: ["St. Mary's Hospital Group", "Horizon Finance Partners"]
                            }
                        ].map((stage, index) => (

                            <div
                                key={index}
                                className={`${stage.bg} border ${stage.border} rounded-3xl p-6`}>

                                <div className="flex items-center justify-between">

                                    <h3 className={`font-bold text-xl ${stage.accent}`}>

                                        {stage.title}

                                    </h3>

                                    <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${stage.badge}`}>

                                        {stage.cards.length}

                                    </span>

                                </div>

                                <div className="space-y-5 mt-8">

                                    {stage.cards.map((deal) => (

                                        <div
                                            key={deal}
                                            className="bg-black border border-orange-600/30 rounded-2xl p-5">

                                            <h4 className="font-semibold text-white">

                                                {deal}

                                            </h4>

                                            <p className="text-sm text-gray-400 mt-3">

                                                AI Probability: {Math.floor(Math.random() * 20) + 80}%

                                            </p>

                                        </div>

                                    ))}

                                </div>

                            </div>

                        ))}

                    </div>

                </div>

            </section>

            {/* ======================================================
                CAMPAIGN BUILDER
====================================================== */}

            <section className="py-16 sm:py-20 lg:py-24 border-t border-white/5 relative z-10">

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">

                    <div className="text-center">

                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">

                            No Code Campaign Builder

                        </h2>

                        <p className="text-gray-300 mt-6">

                            Create complete AI marketing workflows in minutes.

                        </p>

                    </div>

                    <div className="mt-20 bg-black border border-orange-600/30 rounded-[40px] p-6 sm:p-8 lg:p-10">

                        <div className="flex flex-col lg:flex-row items-center gap-6 lg:gap-4">

                            <div className="w-full lg:flex-1 bg-black border-2 border-orange-500/50 rounded-2xl p-6 sm:p-8 text-center">

                                <div className="w-12 h-12 mx-auto rounded-xl bg-orange-500/10 border border-orange-500/40 flex items-center justify-center">

                                    <Zap className="text-orange-500" size={22} />

                                </div>

                                <span className="inline-block mt-5 text-xs font-semibold tracking-wider text-orange-500 uppercase">

                                    Step 1 · Trigger

                                </span>

                                <h3 className="font-bold text-xl text-white mt-2">

                                    Website Form

                                </h3>

                            </div>

                            <div className="flex lg:flex-1 flex-row lg:h-px h-10 w-px lg:w-auto items-center justify-center relative">

                                <div className="lg:w-full lg:h-0 w-0 h-full border-l-2 lg:border-l-0 lg:border-t-2 border-dashed border-orange-600/40"></div>

                                <div className="absolute w-3 h-3 rounded-full bg-orange-500 animate-pulse shadow-[0_0_12px_rgba(249,115,22,0.7)]"></div>

                            </div>

                            <div className="w-full lg:flex-1 bg-black border-2 border-blue-500/50 rounded-2xl p-6 sm:p-8 text-center">

                                <div className="w-12 h-12 mx-auto rounded-xl bg-blue-500/10 border border-blue-500/40 flex items-center justify-center">

                                    <Settings className="text-blue-400" size={22} />

                                </div>

                                <span className="inline-block mt-5 text-xs font-semibold tracking-wider text-blue-400 uppercase">

                                    Step 2 · Condition

                                </span>

                                <h3 className="font-bold text-xl text-white mt-2">

                                    Lead Score &gt; 80

                                </h3>

                            </div>

                            <div className="flex lg:flex-1 flex-row lg:h-px h-10 w-px lg:w-auto items-center justify-center relative">

                                <div className="lg:w-full lg:h-0 w-0 h-full border-l-2 lg:border-l-0 lg:border-t-2 border-dashed border-orange-600/40"></div>

                                <div className="absolute w-3 h-3 rounded-full bg-orange-500 animate-pulse shadow-[0_0_12px_rgba(249,115,22,0.7)]"></div>

                            </div>

                            <div className="w-full lg:flex-1 bg-black border-2 border-green-500/50 rounded-2xl p-6 sm:p-8 text-center">

                                <div className="w-12 h-12 mx-auto rounded-xl bg-green-500/10 border border-green-500/40 flex items-center justify-center">

                                    <Bot className="text-green-400" size={22} />

                                </div>

                                <span className="inline-block mt-5 text-xs font-semibold tracking-wider text-green-400 uppercase">

                                    Step 3 · Action

                                </span>

                                <h3 className="font-bold text-xl text-white mt-2">

                                    Send WhatsApp

                                </h3>

                            </div>

                        </div>

                        <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">

                            {[
                                "Email Campaign",
                                "WhatsApp Broadcast",
                                "SMS Automation",
                                "Lead Assignment",
                                "CRM Update",
                                "AI Follow Up"
                            ].map((item, index) => (

                                <div
                                    key={index}
                                    className="rounded-2xl border border-orange-600/30 p-6 hover:border-orange-500 hover:-translate-y-1 hover:shadow-[0_0_25px_rgba(249,115,22,0.15)] duration-300">

                                    <div className="w-12 h-12 rounded-xl bg-orange-500/10 border border-orange-600/30 flex items-center justify-center">

                                        <Zap className="text-orange-500" size={24} />

                                    </div>

                                    <h4 className="font-bold text-xl mt-5 text-white">

                                        {item}

                                    </h4>

                                    <p className="text-gray-300 mt-4">

                                        Automatically executed by AI.

                                    </p>

                                </div>

                            ))}

                        </div>

                        <div className="text-center mt-16">

                            <button className="bg-orange-500 hover:bg-orange-600 hover:shadow-[0_0_30px_rgba(249,115,22,0.35)] text-white px-10 py-5 rounded-lg font-bold transition duration-300">

                                Generate AI Campaign →

                            </button>

                        </div>

                    </div>

                </div>

            </section>
            {/* ======================================================
                CUSTOMER 360 VIEW
====================================================== */}

            <section className="py-16 sm:py-20 lg:py-24 border-t border-white/5 relative z-10">

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">

                    <div className="text-center">

                        <span className="inline-block bg-orange-500/10 text-orange-400 border border-orange-600/30 px-5 py-2 rounded-full font-semibold">
                            Customer Intelligence
                        </span>

                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mt-8 text-white">
                            Customer 360 View
                        </h2>

                        <p className="text-gray-300 mt-6 max-w-3xl mx-auto">
                            Complete customer profile with predictive insights,
                            behavioral analytics and AI recommendations.
                        </p>

                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 mt-20">

                        {/* Profile */}

                        <div className="bg-black border border-orange-600/30 rounded-2xl p-6 sm:p-8">

                            <div className="flex items-center gap-5">

                                <div className="h-20 w-20 rounded-full bg-orange-500 flex items-center justify-center text-white text-3xl font-bold">

                                    A

                                </div>

                                <div>

                                    <h3 className="text-2xl font-bold text-white">

                                        Alex Johnson

                                    </h3>

                                    <p className="text-gray-400">

                                        Premium Customer

                                    </p>

                                </div>

                            </div>

                            <div className="mt-10 space-y-5">

                                <div className="flex justify-between">

                                    <span>Email Open Rate</span>

                                    <strong>50%</strong>

                                </div>

                                <div className="flex justify-between">

                                    <span>Click Rate</span>

                                    <strong>10%</strong>

                                </div>

                                <div className="flex justify-between">

                                    <span>Journey Completed</span>

                                    <strong>5 / 7</strong>

                                </div>

                                <div className="flex justify-between">

                                    <span>Last Cart</span>

                                    <strong>$295</strong>

                                </div>

                            </div>

                        </div>

                        {/* Customer Insights */}

                        <div className="bg-black border border-orange-600/30 rounded-2xl p-6 sm:p-8">

                            <h3 className="text-2xl font-bold text-white">

                                AI Customer Insights

                            </h3>

                            <div className="space-y-5 mt-8">

                                {[
                                    "Likely to purchase this week",
                                    "Interested in Product X",
                                    "VIP Customer",
                                    "Low Discount Dependency",
                                    "Retention Stage",
                                    "Best Channel: WhatsApp"
                                ].map((item, index) => (

                                    <div
                                        key={index}
                                        className="bg-black border border-orange-600/30 rounded-2xl p-5">

                                        {item}

                                    </div>

                                ))}

                            </div>

                        </div>

                        {/* Channels */}

                        <div className="bg-black border border-orange-600/40 rounded-2xl text-white p-6 sm:p-8">

                            <h3 className="text-2xl font-bold text-white">

                                Reachable Channels

                            </h3>

                            <div className="grid grid-cols-2 gap-5 mt-10">

                                {[
                                    "Email",
                                    "SMS",
                                    "WhatsApp",
                                    "Push",
                                    "Website",
                                    "Call"
                                ].map((item, index) => (

                                    <div
                                        key={index}
                                        className="bg-white/10 rounded-xl py-4 text-center">

                                        {item}

                                    </div>

                                ))}

                            </div>

                        </div>

                    </div>

                </div>

            </section>

            {/* ======================================================
                AI ASSISTANT
====================================================== */}

            <section className="py-16 sm:py-20 lg:py-24 border-t border-white/5 relative z-10">

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">

                    <div className="text-center">

                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">

                            AI Assistant

                        </h2>

                        <p className="text-gray-300 mt-6">

                            Your intelligent business copilot.

                        </p>

                    </div>

                    <div className="mt-20 bg-black border border-orange-600/30 rounded-[40px] overflow-hidden">

                        <div className="grid grid-cols-1 lg:grid-cols-2">

                            {/* Chat */}

                            <div className="p-6 sm:p-8 lg:p-10 border-r border-orange-600/20">

                                <div className="space-y-6">

                                    <div className="bg-orange-500 text-black rounded-2xl p-5 w-fit max-w-md">

                                        Create campaign for Real Estate Leads

                                    </div>

                                    <div className="bg-black border border-orange-600/30 rounded-2xl p-5 max-w-md">

                                        <span className="flex items-center gap-2 font-semibold text-white">
                                            <CheckCircle2 className="text-green-500" size={18} />
                                            Campaign Generated
                                        </span>

                                        Audience Identified

                                        Email Created

                                        WhatsApp Ready

                                        Budget Suggested

                                    </div>

                                    <div className="bg-orange-500 text-black rounded-2xl p-5 w-fit max-w-md ml-auto">

                                        Analyze Last Month Sales

                                    </div>

                                    <div className="bg-black border border-orange-600/30 rounded-2xl p-5 max-w-md">

                                        Revenue dropped 8%.

                                        Main reason:

                                        WhatsApp engagement decreased.

                                        Recommendation:

                                        Increase follow-up frequency by 20%.

                                    </div>

                                </div>

                            </div>

                            {/* AI Features */}

                            <div className="bg-black border border-orange-600/40 text-white p-6 sm:p-8 lg:p-10 rounded-2xl">

                                <h3 className="text-3xl font-bold text-white">

                                    Capabilities

                                </h3>

                                <div className="space-y-5 mt-10">

                                    {[
                                        "Generate Marketing Campaign",
                                        "Predict Revenue",
                                        "Create WhatsApp Messages",
                                        "Analyze Customer Behaviour",
                                        "Optimize Sales Pipeline",
                                        "Generate Landing Pages",
                                        "Forecast Conversion",
                                        "Recommend Next Action"
                                    ].map((item, index) => (

                                        <div
                                            key={index}
                                            className="bg-white/10 rounded-xl p-4">

                                            {item}

                                        </div>

                                    ))}

                                </div>

                            </div>

                        </div>

                    </div>

                </div>

            </section>

            {/* ======================================================
                ANALYTICS
====================================================== */}

            <section className="py-16 sm:py-20 lg:py-24 border-t border-white/5 relative z-10">

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">

                    <div className="text-center">

                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">

                            Analytics Dashboard

                        </h2>

                        <p className="text-gray-300 mt-6">

                            Real-time business intelligence powered by AI.

                        </p>

                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-4 md:grid-cols-2 gap-8 mt-20">

                        {[
                            {
                                value: "90.8%",
                                title: "Customer Satisfaction"
                            },
                            {
                                value: "1 Day",
                                title: "Avg Resolution"
                            },
                            {
                                value: "€94.8M",
                                title: "Revenue"
                            },
                            {
                                value: "+56%",
                                title: "Monthly Growth"
                            }
                        ].map((item, index) => (

                            <div
                                key={index}
                                className="bg-black border border-orange-600/30 rounded-2xl p-6 sm:p-8">

                                <h2 className="text-3xl sm:text-4xl font-bold text-orange-500">

                                    {item.value}

                                </h2>

                                <p className="text-gray-300 mt-4">

                                    {item.title}

                                </p>

                            </div>

                        ))}

                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 mt-16">

                        <div className="bg-black border border-orange-600/30 rounded-2xl p-6 sm:p-8">

                            <h3 className="text-2xl font-bold text-white">

                                Revenue Trend

                            </h3>

                            <div className="h-80 mt-8 bg-black border border-orange-600/30 rounded-2xl p-6 sm:p-8 flex flex-col">

                                <div className="flex-1 relative">

                                    <svg viewBox="0 0 500 200" className="w-full h-full" preserveAspectRatio="none">

                                        <defs>
                                            <linearGradient id="revenueTrendGradient" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="0%" stopColor="#f97316" stopOpacity="0.35" />
                                                <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
                                            </linearGradient>
                                        </defs>

                                        {[0, 1, 2, 3, 4].map((i) => (
                                            <line key={i} x1="0" x2="500" y1={i * 45 + 10} y2={i * 45 + 10} stroke="#f97316" strokeOpacity="0.15" strokeDasharray="4 4" />
                                        ))}

                                        <polygon
                                            points="0,190 0,150 71,138 142,122 214,104 285,78 357,48 428,26 500,14 500,190"
                                            fill="url(#revenueTrendGradient)"
                                        />

                                        <polyline
                                            points="0,150 71,138 142,122 214,104 285,78 357,48 428,26 500,14"
                                            fill="none"
                                            stroke="#f97316"
                                            strokeWidth="3"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />

                                        {[[0, 150], [71, 138], [142, 122], [214, 104], [285, 78], [357, 48], [428, 26], [500, 14]].map(([x, y], i) => (
                                            <circle key={i} cx={x} cy={y} r="5" fill="#f97316" stroke="#000000" strokeWidth="2" />
                                        ))}

                                    </svg>

                                </div>

                                <div className="flex justify-between mt-4 px-1">

                                    {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"].map((month) => (
                                        <span key={month} className="text-xs text-gray-500">

                                            {month}

                                        </span>
                                    ))}

                                </div>

                            </div>

                        </div>

                        <div className="bg-black border border-orange-600/30 rounded-2xl p-6 sm:p-8">

                            <h3 className="text-2xl font-bold text-white">

                                Funnel Analytics

                            </h3>

                            <div className="space-y-5 mt-10">

                                {[
                                    "Visitors : 50,000",
                                    "Leads : 12,400",
                                    "Qualified : 5,800",
                                    "Proposals : 2,300",
                                    "Customers : 1,020"
                                ].map((item, index) => (

                                    <div
                                        key={index}
                                        className="bg-black border border-orange-600/30 rounded-xl p-5">

                                        {item}

                                    </div>

                                ))}

                            </div>

                        </div>

                    </div>

                </div>

            </section>
            {/* ======================================================
                    PRICING
====================================================== */}

            <section className="py-16 sm:py-20 lg:py-24 border-t border-white/5 relative z-10">

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">

                    <div className="text-center">

                        <span className="inline-block bg-orange-500/10 text-orange-400 border border-orange-600/30 px-5 py-2 rounded-full">

                            Pricing

                        </span>

                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mt-8 text-white">

                            Simple & Scalable Pricing

                        </h2>

                        <p className="text-gray-300 mt-6">

                            Choose a plan that grows with your business.

                        </p>

                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10 mt-20">

                        {[
                            {
                                name: "Starter",
                                price: "₹999",
                                features: [
                                    "CRM",
                                    "Email Campaigns",
                                    "Lead Management",
                                    "Basic Analytics"
                                ]
                            },
                            {
                                name: "Professional",
                                price: "₹4,999",
                                popular: true,
                                features: [
                                    "AI Automation",
                                    "WhatsApp",
                                    "Customer 360",
                                    "Sales Pipeline",
                                    "Analytics"
                                ]
                            },
                            {
                                name: "Enterprise",
                                price: "Custom",
                                features: [
                                    "Unlimited AI Agents",
                                    "White Label",
                                    "Multi Tenant",
                                    "AWS Deployment",
                                    "Priority Support"
                                ]
                            }
                        ].map((plan, index) => (

                            <div
                                key={index}
                                className={`rounded-3xl bg-black border ${plan.popular ? "border-orange-500" : "border-orange-600/30"} hover:border-orange-500 transition duration-300 p-6 sm:p-8 lg:p-10 relative`}>

                                {plan.popular && (
                                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-orange-500 text-white px-5 py-2 rounded-full text-sm font-semibold">
                                        Most Popular
                                    </div>
                                )}

                                <h3 className="text-3xl font-bold text-white">

                                    {plan.name}

                                </h3>

                                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-orange-500 mt-8">

                                    {plan.price}

                                </h2>

                                <div className="space-y-5 mt-10">

                                    {plan.features.map((item) => (
                                        <div key={item} className="flex items-center gap-3">
                                            <CheckCircle2 className="text-green-500 flex-shrink-0" size={20} />
                                            <span className="text-gray-300">{item}</span>
                                        </div>
                                    ))}

                                </div>

                                <button className="w-full mt-10 bg-orange-500 text-white rounded-md py-4 hover:bg-orange-600 transition font-semibold">

                                    Get Started

                                </button>

                            </div>

                        ))}

                    </div>

                </div>

            </section>

            {/* ======================================================
                AI AGENTS
====================================================== */}

            <section className="py-16 sm:py-20 lg:py-24 border-t border-white/5 relative z-10">

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">

                    <div className="text-center">

                        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">

                            Meet Your AI Workforce

                        </h2>

                        <p className="text-gray-300 mt-6">

                            Autonomous AI employees that work alongside your team.

                        </p>

                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-4 md:grid-cols-2 gap-8 mt-20">

                        {[
                            "AI Sales Manager",
                            "AI Marketing Manager",
                            "AI Customer Support",
                            "AI Business Analyst",
                            "AI Content Creator",
                            "AI WhatsApp Assistant",
                            "AI Campaign Optimizer",
                            "AI Revenue Forecaster"
                        ].map((agent, index) => (

                            <div
                                key={index}
                                className="rounded-2xl bg-black border border-orange-600/40 hover:border-orange-500 text-white p-6 sm:p-8 transition duration-300">

                                <div className="w-14 h-14 rounded-xl bg-orange-500/10 border border-orange-600/30 flex items-center justify-center">

                                    <Bot className="text-orange-500" size={28} />

                                </div>

                                <h3 className="text-xl sm:text-2xl font-bold mt-6 text-white">

                                    {agent}

                                </h3>

                                <p className="mt-5 text-gray-300">

                                    Available 24×7 to automate business operations.

                                </p>

                            </div>

                        ))}

                    </div>

                </div>

            </section>

            {/* ======================================================
                CLOUD & SECURITY
====================================================== */}

            <section className="py-16 sm:py-20 lg:py-24 border-t border-white/5 relative z-10">

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10">

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">

                        <div className="bg-black border border-orange-600/30 rounded-2xl p-6 sm:p-8 lg:p-10">

                            <h3 className="text-3xl font-bold text-white">

                                AWS Cloud Deployment

                            </h3>

                            <div className="space-y-5 mt-8">

                                {[
                                    "Amazon EC2",
                                    "AWS Lambda",
                                    "S3 Storage",
                                    "CloudFront CDN",
                                    "Amazon RDS",
                                    "Elastic Load Balancer",
                                    "Docker",
                                    "Kubernetes"
                                ].map((item) => (
                                    <div key={item} className="bg-black border border-orange-600/30 rounded-xl p-4 flex items-center gap-3">
                                        <Cloud className="text-orange-500 flex-shrink-0" size={18} />
                                        <span>{item}</span>
                                    </div>
                                ))}

                            </div>

                        </div>

                        <div className="bg-black border border-orange-600/30 rounded-2xl p-6 sm:p-8 lg:p-10">

                            <h3 className="text-3xl font-bold text-white">

                                Enterprise Security

                            </h3>

                            <div className="space-y-5 mt-8">

                                {[
                                    "JWT Authentication",
                                    "Role Based Access",
                                    "End-to-End Encryption",
                                    "Audit Logs",
                                    "API Security",
                                    "Multi Factor Authentication",
                                    "GDPR Ready",
                                    "DPDP Compliance"
                                ].map((item) => (
                                    <div key={item} className="bg-black border border-green-600/30 rounded-xl p-4 flex items-center gap-3">
                                        <Lock className="text-green-500 flex-shrink-0" size={18} />
                                        <span>{item}</span>
                                    </div>
                                ))}

                            </div>

                        </div>

                    </div>

                </div>

            </section>

            {/* ======================================================
                REVENUE MODEL
====================================================== */}

            <section className="py-16 sm:py-20 lg:py-24 border-t border-white/5 relative z-10">

                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 text-center">

                    <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white">

                        Revenue Model

                    </h2>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mt-20">

                        {[
                            "SaaS Subscription",
                            "White Label Licensing",
                            "Enterprise Consulting",
                            "Marketplace Integrations"
                        ].map((item, index) => (

                            <div
                                key={index}
                                className="bg-black border border-orange-600/30 rounded-2xl p-6 sm:p-10">

                                <div className="w-14 h-14 mx-auto rounded-xl bg-orange-500/10 border border-orange-600/30 flex items-center justify-center">

                                    <IndianRupee className="text-orange-500" size={28} />

                                </div>

                                <h3 className="text-xl font-bold mt-6 text-white">

                                    {item}

                                </h3>

                            </div>

                        ))}

                    </div>

                </div>

            </section>

            {/* ======================================================
                FINAL CTA
====================================================== */}

            <section className="bg-gradient-to-br from-black via-orange-950 to-black text-white py-16 sm:py-20 lg:py-24 border-t border-white/5 relative z-10">

                <div className="max-w-5xl mx-auto text-center px-4 sm:px-6 lg:px-10">

                    <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight text-white">

                        Build the Future of AI Powered Revenue

                    </h2>

                    <p className="text-xl mt-8 text-gray-300 leading-9">

                        GrowthOS AI transforms CRM, Marketing, Sales,
                        Automation and Artificial Intelligence into one
                        intelligent platform designed for modern enterprises.

                    </p>

                    <div className="flex flex-wrap justify-center gap-6 mt-14">

                        <button className="bg-orange-500 text-white px-10 py-5 rounded-lg font-bold hover:bg-orange-600 transition">

                            Request Live Demo

                        </button>

                        <button className="border border-orange-500 text-orange-500 px-10 py-5 rounded-lg hover:bg-orange-500 hover:text-white transition">

                            Contact Sales

                        </button>

                    </div>

                </div>

            </section>

            {/* ======================================================
                    FOOTER
====================================================== */}

            <footer className="bg-black text-gray-400 py-12 border-t border-orange-600/20">

                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 flex flex-col lg:flex-row justify-between items-center gap-6">

                    <div>

                        <h3 className="text-2xl font-bold text-white">

                            GrowthOS AI

                        </h3>

                        <p className="mt-2">

                            AI Powered Revenue Platform

                        </p>

                    </div>

                    <div className="flex gap-8">

                        <a href="#" className="hover:text-white">Platform</a>
                        <a href="#" className="hover:text-white">Solutions</a>
                        <a href="#" className="hover:text-white">Pricing</a>
                        <a href="#" className="hover:text-white">Contact</a>

                    </div>

                </div>

            </footer>

        </div>
    );
};

export default MarketingStrategy;