import React, { useState } from "react";
import {
    LayoutDashboard,
    UserPlus,
    Contact,
    Megaphone,
    KanbanSquare,
    MessagesSquare,
    Bot,
    Sparkles,
    BarChart3,
    Building2,
    BookOpen,
    Plug,
    Users,
    ShieldCheck,
    Settings,
    Search,
    Bell,
    ChevronDown,
    IndianRupee,
    Target,
    TrendingUp,
    Filter,
    ArrowRight,
    CheckCircle2,
    Circle,
    Calendar,
    BrainCircuit,
    CheckCircle,
    Workflow,
    Cloud,
    Rocket,
    Gem,
    Star,
    Zap,
    Lock,
    AlertTriangle,
    XCircle,
    Check,
    Menu,
    X,
} from "lucide-react";
import {
    AreaChart,
    Area,
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    Tooltip,
    PieChart,
    Pie,
    Cell,
} from "recharts";

/* ==========================================================
   CONTENT SOURCE
   Sidebar module names are pulled from the PRD "Core Modules"
   list and the 5-screen UI/UX wireframe chapter of the
   GrowthOS AI deck, not invented labels:
   Lead Management, CRM (Customer 360), Marketing Automation,
   Sales Pipeline, Communication Hub, AI Agents, AI Assistant,
   Analytics & BI, Admin & White-label.
========================================================== */

const navGroups = [
    {
        group: "OVERVIEW",
        items: [
            { id: "sec-overview", label: "Overview", icon: LayoutDashboard },
            { id: "sec-vision", label: "Vision", icon: Sparkles },
            { id: "sec-requirements", label: "Software Requirements", icon: ShieldCheck },
            { id: "sec-core-features", label: "Core Features", icon: CheckCircle2 },
            { id: "sec-advanced-features", label: "Advanced Features", icon: Zap },
        ],
    },
    {
        group: "AI & ARCHITECTURE",
        items: [
            { id: "sec-ai-everywhere", label: "AI Everywhere Architecture", icon: BrainCircuit },
            { id: "sec-ai-agents", label: "AI Agents", icon: Bot },
            { id: "sec-architecture", label: "Platform Architecture", icon: Building2 },
            { id: "sec-tech-stack", label: "Tech Stack", icon: Cloud },
            { id: "sec-cloud-security", label: "Cloud & Security", icon: Lock },
        ],
    },
    {
        group: "PRODUCT SCREENS",
        items: [
            { id: "sec-dashboard-preview", label: "Dashboard Preview", icon: LayoutDashboard },
            { id: "sec-sales-pipeline", label: "Sales Pipeline", icon: KanbanSquare },
            { id: "sec-campaign-builder", label: "Campaign Builder", icon: Megaphone },
            { id: "sec-customer-360", label: "Customer 360 View", icon: Contact },
            { id: "sec-ai-assistant", label: "AI Assistant", icon: MessagesSquare },
            { id: "sec-analytics", label: "Analytics", icon: TrendingUp },
        ],
    },
    {
        group: "BUSINESS",
        items: [
            { id: "sec-usp", label: "Why GrowthOS", icon: Star },
            { id: "sec-competitors", label: "Competitor Analysis", icon: BarChart3 },
            { id: "sec-roadmap", label: "Product Roadmap", icon: Rocket },
            { id: "sec-strategic-vision", label: "Strategic Vision", icon: Target },
            { id: "sec-pricing", label: "Pricing", icon: IndianRupee },
            { id: "sec-revenue-model", label: "Revenue Model", icon: Gem },
        ],
    },
    {
        group: "GET STARTED",
        items: [
            { id: "sec-cta", label: "Get Started", icon: ArrowRight },
            { id: "sec-footer", label: "Contact", icon: Users },
        ],
    },
];

const revenueSeries = [
    { day: "1 May", value: 4 },
    { day: "6 May", value: 7 },
    { day: "11 May", value: 9 },
    { day: "16 May", value: 8 },
    { day: "21 May", value: 14.8 },
    { day: "26 May", value: 18 },
    { day: "31 May", value: 22 },
];

const sparkline = (seed) =>
    [...Array(10)].map((_, i) => ({
        i,
        v: Math.max(2, seed + Math.sin(i / 1.3 + seed) * seed * 0.35 + i * (seed / 18)),
    }));

const channelData = [
    { name: "Organic Search", value: 35, color: "#f97316" },
    { name: "Email Campaigns", value: 25, color: "#3b82f6" },
    { name: "LinkedIn Ads", value: 20, color: "#9ca3af" },
    { name: "Direct Traffic", value: 10, color: "#22c55e" },
    { name: "Others", value: 10, color: "#a855f7" },
];

const agents = [
    { name: "Lead Qualifier Agent", desc: "Scanning & scoring inbound leads", status: "Active" },
    { name: "AI Marketing Manager", desc: "Generating campaign content", status: "Active" },
    { name: "Nurture & Follow-up Agent", desc: "Engaging prospects on WhatsApp", status: "Active" },
    { name: "AI Sales Rep", desc: "Assisting with deal closing", status: "Active" },
];

const activity = [
    { title: "New Deal Closed", desc: "Deal worth ₹2,40,000 has been closed.", time: "10 min ago", color: "bg-orange-500" },
    { title: "New Lead Qualified", desc: "TechNova Solutions has been scored high-intent.", time: "45 min ago", color: "bg-green-500" },
    { title: "WhatsApp Campaign Sent", desc: "'Product Launch' campaign sent to 1,250 leads.", time: "2 hr ago", color: "bg-blue-500" },
    { title: "AI Agent Report", desc: "Lead Qualifier Agent generated 210 leads.", time: "4 hr ago", color: "bg-purple-500" },
];

const tasks = [
    { title: "Follow up with TechNova Solutions", time: "Today, 11:00 AM", dot: "bg-orange-500" },
    { title: "Review marketing campaign performance", time: "Today, 2:00 PM", dot: "bg-orange-500" },
    { title: "Demo call with GrowthX Inc.", time: "Tomorrow, 10:00 AM", dot: "bg-blue-500" },
    { title: "Monthly revenue review", time: "25 May, 2026", dot: "bg-orange-500" },
];

const deals = [
    { name: "TechNova Solutions", value: "₹2,40,000", status: "Closed", color: "bg-green-500/20 text-green-400" },
    { name: "GrowthX Inc.", value: "₹1,80,000", status: "Negotiation", color: "bg-orange-500/20 text-orange-400" },
    { name: "Alpha Systems", value: "₹1,25,000", status: "Proposal", color: "bg-blue-500/20 text-blue-400" },
    { name: "Beta Enterprises", value: "₹95,000", status: "Qualified", color: "bg-purple-500/20 text-purple-400" },
];

const kpis = [
    { label: "Total Revenue", value: "₹48,75,000", delta: "+24.5%", icon: IndianRupee, seed: 8, stroke: "#f97316" },
    { label: "Qualified Leads", value: "1,253", delta: "+18.7%", icon: UserPlus, seed: 6, stroke: "#22c55e" },
    { label: "Closed Deals", value: "68", delta: "+12.9%", icon: Target, seed: 5, stroke: "#f97316" },
    { label: "Conversion Rate", value: "7.35%", delta: "+8.4%", icon: TrendingUp, seed: 4, stroke: "#3b82f6" },
];

/* ==========================================================
   FULL MARKETING / LANDING PAGE SECTION
   (embedded below the dashboard content — scroll down on
   the main panel to see it, sourced from Marketing_Stratergy.jsx)
========================================================== */

const MarketingStrategySection = () => {
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

            <section id="sec-overview" className="relative overflow-hidden text-white z-10">

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

            <section id="sec-vision" className="py-16 sm:py-20 lg:py-24 border-t border-white/5 relative z-10">

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

            <section id="sec-requirements" className="py-16 sm:py-20 lg:py-24 border-t border-white/5 relative z-10">

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

            <section id="sec-core-features" className="py-16 sm:py-20 lg:py-24 border-t border-white/5 relative z-10">

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

            <section id="sec-advanced-features" className="py-16 sm:py-20 lg:py-24 border-t border-white/5 relative z-10">

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

            <section id="sec-ai-everywhere" className="py-16 sm:py-20 lg:py-24 text-white border-t border-white/5 relative z-10">

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

            <section id="sec-usp" className="py-16 sm:py-20 lg:py-24 border-t border-white/5 relative z-10">

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

            <section id="sec-competitors" className="py-16 sm:py-20 lg:py-24 border-t border-white/5 relative z-10">

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

            <section id="sec-architecture" className="py-16 sm:py-20 lg:py-24 border-t border-white/5 relative z-10">

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

            <section id="sec-tech-stack" className="py-16 sm:py-20 lg:py-24 border-t border-white/5 relative z-10">

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

            <section id="sec-roadmap" className="py-16 sm:py-20 lg:py-24 border-t border-white/5 relative z-10">

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

            <section id="sec-strategic-vision" className="py-16 sm:py-20 lg:py-24 text-white border-t border-white/5 relative z-10">

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

            <section id="sec-dashboard-preview" className="py-16 sm:py-20 lg:py-24 border-t border-white/5 relative z-10">

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

            <section id="sec-sales-pipeline" className="py-16 sm:py-20 lg:py-24 border-t border-white/5 relative z-10">

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

            <section id="sec-campaign-builder" className="py-16 sm:py-20 lg:py-24 border-t border-white/5 relative z-10">

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

            <section id="sec-customer-360" className="py-16 sm:py-20 lg:py-24 border-t border-white/5 relative z-10">

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

            <section id="sec-ai-assistant" className="py-16 sm:py-20 lg:py-24 border-t border-white/5 relative z-10">

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

            <section id="sec-analytics" className="py-16 sm:py-20 lg:py-24 border-t border-white/5 relative z-10">

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

            <section id="sec-pricing" className="py-16 sm:py-20 lg:py-24 border-t border-white/5 relative z-10">

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

            <section id="sec-ai-agents" className="py-16 sm:py-20 lg:py-24 border-t border-white/5 relative z-10">

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

            <section id="sec-cloud-security" className="py-16 sm:py-20 lg:py-24 border-t border-white/5 relative z-10">

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

            <section id="sec-revenue-model" className="py-16 sm:py-20 lg:py-24 border-t border-white/5 relative z-10">

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

            <section id="sec-cta" className="bg-gradient-to-br from-black via-orange-950 to-black text-white py-16 sm:py-20 lg:py-24 border-t border-white/5 relative z-10">

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

            <footer id="sec-footer" className="bg-black text-gray-400 py-12 border-t border-orange-600/20">

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


const NavItem = ({ item, active, onClick }) => {
    const Icon = item.icon;
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg text-[13px] transition duration-200 group ${
                active
                    ? "bg-orange-500 text-white font-semibold"
                    : "text-gray-400 hover:bg-white/5 hover:text-white"
            }`}
        >
            <Icon size={16} className={`shrink-0 ${active ? "text-white" : "text-gray-500 group-hover:text-orange-500"}`} />
            <span className="flex-1 text-left truncate">{item.label}</span>
        </button>
    );
};

const allNavItems = navGroups.flatMap((g) => g.items);

const GrowthOSDashboard = () => {
    const [activeItem, setActiveItem] = useState("sec-overview");
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [highlightedIndex, setHighlightedIndex] = useState(0);

    const goToSection = (id) => {
        setActiveItem(id);
        const el = document.getElementById(id);
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    };

    const searchResults =
        searchQuery.trim().length > 0
            ? allNavItems.filter((item) =>
                  item.label.toLowerCase().includes(searchQuery.trim().toLowerCase())
              )
            : [];

    const handleResultClick = (id) => {
        goToSection(id);
        setSearchQuery("");
        setHighlightedIndex(0);
    };

    const handleSearchChange = (value) => {
        setSearchQuery(value);
        setHighlightedIndex(0);
    };

    const handleSearchKeyDown = (e) => {
        if (searchResults.length === 0) return;

        if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlightedIndex((i) => (i + 1) % searchResults.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightedIndex((i) => (i - 1 + searchResults.length) % searchResults.length);
        } else if (e.key === "Enter") {
            e.preventDefault();
            const target = searchResults[highlightedIndex];
            if (target) handleResultClick(target.id);
        } else if (e.key === "Escape") {
            e.preventDefault();
            setSearchQuery("");
        }
    };

    return (
        <div className="min-h-screen w-full bg-black text-gray-300 flex font-sans">
            {/* ================= SIDEBAR ================= */}
            <aside
                className={`shrink-0 border-orange-600/20 flex flex-col h-screen sticky top-0 overflow-hidden transition-all duration-300 ease-in-out ${
                    sidebarOpen ? "w-72 border-r" : "w-0 border-r-0"
                }`}
            >
                <div className="w-72 flex flex-col h-full">
                    <div className="px-6 py-6 border-b border-orange-600/10">
                        <h1 className="text-2xl font-extrabold text-white leading-none">
                            GrowthOS <span className="text-orange-500">AI</span>
                        </h1>
                        <p className="text-xs text-gray-500 mt-1.5 tracking-wide">
                            Autonomous Revenue Platform
                        </p>
                    </div>

                    <nav className="flex-1 overflow-y-auto px-4 mt-5 space-y-5 pb-4">
                        {navGroups.map((group) => (
                            <div key={group.group}>
                                <p className="text-[11px] font-bold text-orange-500 tracking-widest px-4 mb-2">
                                    {group.group}
                                </p>
                                <div className="space-y-1">
                                    {group.items.map((item) => (
                                        <NavItem
                                            key={item.id}
                                            item={item}
                                            active={activeItem === item.id}
                                            onClick={() => goToSection(item.id)}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </nav>

                    <div className="p-4 border-t border-orange-600/10">
                        <button className="w-full flex items-center gap-3 bg-white/5 hover:bg-white/10 transition rounded-xl px-3 py-2.5">
                            <div className="h-9 w-9 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold text-sm">
                                A
                            </div>
                            <div className="text-left flex-1">
                                <p className="text-sm font-semibold text-white leading-none">Aman Verma</p>
                                <p className="text-xs text-gray-500 mt-1">User</p>
                            </div>
                            <ChevronDown size={16} className="text-gray-500" />
                        </button>
                    </div>
                </div>
            </aside>

            {/* ================= MAIN ================= */}
            <main className="flex-1 min-w-0 px-8 py-6">
                {/* Top bar */}
                <div className="flex items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-3 w-full max-w-md">
                        <button
                            onClick={() => setSidebarOpen((v) => !v)}
                            title={sidebarOpen ? "Hide sidebar" : "Show sidebar"}
                            className="h-10 w-10 shrink-0 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 hover:border-orange-600/40 transition"
                        >
                            <Menu size={17} className="text-gray-300" />
                        </button>

                        <div className="relative flex-1">
                            <div className="flex items-center gap-2 bg-white/5 border border-white/10 focus-within:border-orange-600/50 rounded-lg px-3 py-2">
                                <Search size={15} className="text-gray-500 shrink-0" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => handleSearchChange(e.target.value)}
                                    onKeyDown={handleSearchKeyDown}
                                    placeholder="Search across GrowthOS..."
                                    className="bg-transparent outline-none text-sm text-white placeholder:text-gray-500 w-full"
                                />
                                {searchQuery && (
                                    <button onClick={() => setSearchQuery("")} className="shrink-0 text-gray-500 hover:text-white">
                                        <X size={14} />
                                    </button>
                                )}
                            </div>

                            {searchQuery.trim().length > 0 && (
                                <div
                                    className="absolute top-full left-0 right-0 mt-2 bg-black border border-orange-600/30 rounded-xl shadow-2xl overflow-hidden"
                                    style={{ zIndex: 100, backgroundColor: "#0a0a0a", boxShadow: "0 20px 40px -8px rgba(0,0,0,0.7)" }}
                                >
                                    {searchResults.length > 0 && (
                                        <p className="px-4 pt-3 pb-2 text-[11px] font-bold text-gray-500 tracking-widest border-b border-white/5">
                                            {searchResults.length} RESULT{searchResults.length > 1 ? "S" : ""}
                                        </p>
                                    )}
                                    <div className="max-h-64 overflow-y-auto">
                                        {searchResults.length > 0 ? (
                                            searchResults.map((item, idx) => {
                                                const Icon = item.icon;
                                                const isHighlighted = idx === highlightedIndex;
                                                return (
                                                    <button
                                                        key={item.id}
                                                        onClick={() => handleResultClick(item.id)}
                                                        onMouseEnter={() => setHighlightedIndex(idx)}
                                                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition text-left ${
                                                            idx !== searchResults.length - 1 ? "border-b border-white/5" : ""
                                                        } ${
                                                            isHighlighted
                                                                ? "bg-orange-500/20 text-white"
                                                                : "text-gray-300 hover:bg-orange-500/15 hover:text-white"
                                                        }`}
                                                    >
                                                        <span
                                                            className={`h-7 w-7 rounded-md border flex items-center justify-center shrink-0 ${
                                                                isHighlighted
                                                                    ? "bg-orange-500 border-orange-500"
                                                                    : "bg-orange-500/10 border-orange-600/30"
                                                            }`}
                                                        >
                                                            <Icon size={13} className={isHighlighted ? "text-white" : "text-orange-500"} />
                                                        </span>
                                                        {item.label}
                                                    </button>
                                                );
                                            })
                                        ) : (
                                            <p className="px-4 py-4 text-sm text-gray-500">
                                                No matching section for "{searchQuery}"
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                        <button className="relative h-10 w-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition">
                            <Bell size={17} className="text-gray-300" />
                            <span className="absolute -top-1 -right-1 h-4 w-4 bg-orange-500 text-white text-[10px] rounded-full flex items-center justify-center">3</span>
                        </button>
                        <button className="h-10 w-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition">
                            <Sparkles size={17} className="text-orange-500" />
                        </button>
                    </div>
                </div>

                {/* Hero / welcome */}
                <div className="relative overflow-hidden rounded-2xl border border-orange-600/30 bg-gradient-to-br from-orange-950/40 via-black to-black px-8 py-7 mb-6">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(249,115,22,0.15),transparent_45%)]"></div>
                    <div className="relative flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h2 className="text-2xl font-bold text-white">Welcome back, Aman 👋</h2>
                            <p className="text-gray-400 mt-1">Here's what's happening with your revenue engine today.</p>
                        </div>
                        <div className="flex items-center gap-2 bg-black/40 border border-orange-600/30 rounded-lg px-4 py-2 text-sm text-gray-300">
                            <Calendar size={15} className="text-orange-500" />
                            15 May – 22 May, 2026
                        </div>
                    </div>
                </div>

                {/* KPI cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
                    {kpis.map((kpi) => {
                        const Icon = kpi.icon;
                        return (
                            <div key={kpi.label} className="bg-black border border-orange-600/30 rounded-2xl p-5">
                                <div className="flex items-center justify-between">
                                    <p className="text-sm text-gray-400">{kpi.label}</p>
                                    <div className="h-8 w-8 rounded-full bg-orange-500/10 border border-orange-600/30 flex items-center justify-center">
                                        <Icon size={15} className="text-orange-500" />
                                    </div>
                                </div>
                                <p className="text-2xl font-extrabold text-white mt-2">{kpi.value}</p>
                                <p className="text-xs text-green-500 font-semibold mt-1">
                                    ▲ {kpi.delta} vs last 7 days
                                </p>
                                <div className="h-10 mt-3 -mx-1">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={sparkline(kpi.seed)}>
                                            <Area
                                                type="monotone"
                                                dataKey="v"
                                                stroke={kpi.stroke}
                                                fill={kpi.stroke}
                                                fillOpacity={0.12}
                                                strokeWidth={2}
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* AI agents + Revenue activity + Tasks */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
                    <div className="bg-black border border-orange-600/30 rounded-2xl p-5">
                        <h3 className="text-white font-bold">AI Agents at Work</h3>
                        <p className="text-xs text-gray-500 mb-4">Your digital employees working 24×7</p>
                        <div className="space-y-2">
                            {agents.map((a) => (
                                <div key={a.name} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="h-9 w-9 rounded-lg bg-orange-500/10 border border-orange-600/30 flex items-center justify-center shrink-0">
                                            <Bot size={16} className="text-orange-500" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-white truncate">{a.name}</p>
                                            <p className="text-xs text-gray-500 truncate">{a.desc}</p>
                                        </div>
                                    </div>
                                    <span className="text-[11px] text-green-400 bg-green-500/10 border border-green-600/30 rounded-full px-2 py-0.5 shrink-0">
                                        {a.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-black border border-orange-600/30 rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-white font-bold">Revenue Activity</h3>
                            <span className="text-xs text-gray-500 border border-white/10 rounded-lg px-2 py-1">This Week</span>
                        </div>
                        <div className="space-y-4">
                            {activity.map((a) => (
                                <div key={a.title} className="flex gap-3">
                                    <div className={`h-2.5 w-2.5 rounded-full ${a.color} mt-1.5 shrink-0`}></div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-sm font-semibold text-white">{a.title}</p>
                                            <p className="text-[11px] text-gray-500 shrink-0">{a.time}</p>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-0.5">{a.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-black border border-orange-600/30 rounded-2xl p-5">
                        <h3 className="text-white font-bold mb-4">Tasks & Reminders</h3>
                        <div className="space-y-3">
                            {tasks.map((t) => (
                                <div key={t.title} className="flex items-start gap-3">
                                    <Circle size={16} className="text-gray-600 mt-0.5 shrink-0" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm text-white leading-snug">{t.title}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">{t.time}</p>
                                    </div>
                                    <div className={`h-2 w-2 rounded-full ${t.dot} mt-1.5 shrink-0`}></div>
                                </div>
                            ))}
                        </div>
                        <button className="flex items-center gap-1 text-orange-500 text-sm font-semibold mt-4 hover:gap-2 transition-all">
                            View All Tasks <ArrowRight size={14} />
                        </button>
                    </div>
                </div>

                {/* Revenue overview + channels + deals */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    <div className="lg:col-span-1 bg-black border border-orange-600/30 rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-1">
                            <h3 className="text-white font-bold">Revenue Overview</h3>
                            <span className="text-xs text-gray-500 border border-white/10 rounded-lg px-2 py-1">This Month</span>
                        </div>
                        <p className="text-2xl font-extrabold text-white">₹14,80,000</p>
                        <p className="text-xs text-green-500 font-semibold mb-2">▲ 28.6% vs last month</p>
                        <div className="h-40">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={revenueSeries}>
                                    <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                                    <Tooltip
                                        contentStyle={{ background: "#0a0a0a", border: "1px solid #f9731650", borderRadius: 8, fontSize: 12 }}
                                        labelStyle={{ color: "#fff" }}
                                    />
                                    <Line type="monotone" dataKey="value" stroke="#f97316" strokeWidth={2.5} dot={{ r: 3, fill: "#f97316" }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="lg:col-span-1 bg-black border border-orange-600/30 rounded-2xl p-5">
                        <h3 className="text-white font-bold mb-3">Top Performing Channels</h3>
                        <div className="flex items-center gap-4">
                            <div className="h-32 w-32 shrink-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie data={channelData} dataKey="value" innerRadius={35} outerRadius={55} paddingAngle={2}>
                                            {channelData.map((c) => (
                                                <Cell key={c.name} fill={c.color} />
                                            ))}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="space-y-2 flex-1 min-w-0">
                                {channelData.map((c) => (
                                    <div key={c.name} className="flex items-center justify-between gap-2 text-xs">
                                        <span className="flex items-center gap-2 text-gray-300 truncate">
                                            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: c.color }}></span>
                                            {c.name}
                                        </span>
                                        <span className="text-white font-semibold shrink-0">{c.value}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <button className="flex items-center gap-1 text-orange-500 text-sm font-semibold mt-4 hover:gap-2 transition-all">
                            View Full Analytics <ArrowRight size={14} />
                        </button>
                    </div>

                    <div className="lg:col-span-1 bg-black border border-orange-600/30 rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-white font-bold">Recent Deals</h3>
                            <button className="flex items-center gap-1 text-orange-500 text-xs font-semibold">
                                View All <ArrowRight size={12} />
                            </button>
                        </div>
                        <div className="space-y-3">
                            {deals.map((d) => (
                                <div key={d.name} className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-semibold text-white">{d.name}</p>
                                        <p className="text-xs text-gray-500">{d.value}</p>
                                    </div>
                                    <span className={`text-[11px] font-semibold px-2 py-1 rounded-md ${d.color}`}>
                                        {d.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <p className="text-center text-xs text-gray-600 mt-8 pb-2">
                    GrowthOS AI — Built for Scale. Powered by AI. Driven by Results.
                </p>

                {/* Divider marking where the dashboard ends and the
                    full marketing/landing page content begins below */}
                <div className="flex items-center gap-4 my-4">
                    <div className="flex-1 h-px bg-orange-600/20"></div>
                    <span className="text-[11px] tracking-widest text-orange-500/70 font-semibold">
                        SCROLL FOR PLATFORM OVERVIEW
                    </span>
                    <div className="flex-1 h-px bg-orange-600/20"></div>
                </div>

                <div className="-mx-8 border-t border-orange-600/20">
                    <MarketingStrategySection />
                </div>
            </main>
        </div>
    );
};

export default GrowthOSDashboard;