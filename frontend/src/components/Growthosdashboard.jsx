import React, { useState, useEffect } from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";

import Sidebar, { allNavItems } from "./Sidebar";
import TopBar from "./TopBar";
import WelcomeHero from "./WelcomeHero";
import Starfield from "./Starfield";
import FloatingAIBot from "./FloatingAIBot";
import { CustomerDataProvider } from "./CustomerDataContext";

// import HeroOverviewSection from "./OverviewSection";
import DashboardPreviewSection from "./DashboardPreviewSection";
import AICommandCenter from "./AICommandCenter";
import CampaignBuilderSection from "./Lead_Management";
import CampaignAutomationSection from "./Campaign_Automation";
import SalesPipelineSection from "./SalesPipelineSection";
import Customer360Section from "./Customer360Section";
import CommunicationHub from "./Communication_Hub";
import LeadGenerationSection from "./LeadGenerationSection";
import AIAssistantSection from "./AIAssistantSection";
import PlatformAnalyticsSection from "./PlatformAnalyticsSection";
import AnalyticsBI from "./Analyticsbi";
import FinalCtaSection from "./FinalCtaSection";
import FooterSection from "./FooterSection";

/* ==========================================================
   This dashboard is mounted at "/app/*" (see App.jsx — the
   pricing page lives at "/" and hands off to "/app/overview").
   Each sidebar/search nav id (e.g. "sec-campaign-builder")
   maps 1:1 to its own route under that base (e.g.
   "/app/campaign-builder"). Keeping the "sec-" ids as the
   single source of truth means Sidebar.jsx and Topbar.jsx
   don't need any changes at all — they still just call
   goToSection(id) exactly as before.
========================================================== */
const DASHBOARD_BASE = "/app";
const idToPath = (id) => `${DASHBOARD_BASE}/${id.replace(/^sec-/, "")}`;

const Growthosdashboard = () => {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const navigate = useNavigate();
    const location = useLocation();

    // Active sidebar highlight now comes from the current URL, so it
    // stays correct on refresh, back/forward, or a direct link too.
    const activeItem =
        allNavItems.find((item) => idToPath(item.id) === location.pathname)?.id ??
        "sec-overview";

    // Same defensive persistence PricingPage.jsx does — covers arriving
    // here with ?product=<id> from the pricing hand-off, so Lead
    // Generation opens already scoped to that product.
    useEffect(() => {
        const productId = new URLSearchParams(location.search).get("product");
        if (productId) {
            localStorage.setItem("growthos_active_product_id", productId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.search]);

    // Same function signature Sidebar/TopBar already call —
    // it now routes to that module's own page instead of scrolling.
    const goToSection = (id) => {
        navigate(idToPath(id));
    };

    // WelcomeHero ("Welcome back, Aman...") is overview-only content —
    // every other module gets the full remaining height to itself.
    const isOverview = location.pathname === DASHBOARD_BASE || location.pathname === `${DASHBOARD_BASE}/overview`;

    return (
        // CustomerDataProvider wraps the routed area so Campaign Builder
        // (which fetches/writes leads) and Customer 360 (which reads and
        // displays a selected lead) share the exact same live data —
        // no prop drilling, no duplicate fetches.
        <CustomerDataProvider>
            <div className="min-h-screen w-full bg-black text-gray-300 flex font-sans">
                <Starfield />

                {/* ================= SIDEBAR ================= */}
                <Sidebar sidebarOpen={sidebarOpen} activeItem={activeItem} goToSection={goToSection} />

                {/* ================= MAIN ================= */}
                <main className="flex-1 min-w-0 px-8 py-6 h-screen flex flex-col overflow-hidden">
                    {/* Top bar: sidebar toggle, search, notifications */}
                    <TopBar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} goToSection={goToSection} />

                    {/* Hero / welcome — overview page only. Other modules use the
                        full remaining height for a "fit screen" view instead. */}
                    {isOverview && <WelcomeHero />}

                    {/* Routed module — fills remaining viewport height ("fit screen"),
                        only scrolling internally if a module's own content is taller. */}
                    <div
                        className={`flex-1 min-h-0 -mx-8 px-8 overflow-hidden relative z-10 ${
                            isOverview ? "border-t border-orange-600/20" : ""
                        }`}
                    >
                        <Routes>
                            <Route path="/" element={<Navigate to="dashboard-preview" replace />} />
                            {/* <Route path="overview" element={<HeroOverviewSection />} /> */}
                            <Route path="dashboard-preview" element={<DashboardPreviewSection />} />
                            <Route path="ai-command-center" element={<AICommandCenter />} />
                            <Route path="campaign-builder" element={<CampaignBuilderSection />} />
                            <Route path="campaign-automation" element={<CampaignAutomationSection />} />
                            <Route path="sales-pipeline" element={<SalesPipelineSection />} />
                            <Route path="customer-360" element={<Customer360Section />} />
                            <Route path="communication-hub" element={<CommunicationHub />} />
                            <Route path="lead-generation" element={<LeadGenerationSection />} />
                            <Route path="ai-assistant" element={<AIAssistantSection />} />
                            <Route path="analytics" element={<PlatformAnalyticsSection />} />
                            <Route path="analytics-bi" element={<AnalyticsBI />} />
                            <Route path="cta" element={<FinalCtaSection />} />
                            <Route path="footer" element={<FooterSection />} />
                            <Route path="*" element={<Navigate to="dashboard-preview" replace />} />
                        </Routes>
                    </div>
                </main>

                {/* ================= FLOATING AI BOT ================= */}
                <FloatingAIBot />
            </div>
        </CustomerDataProvider>
    );
};

export default Growthosdashboard;