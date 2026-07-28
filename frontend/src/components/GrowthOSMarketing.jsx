import React from "react";
import Starfield from "./Starfield";
import HeroOverviewSection from "./OverviewSection";
import DashboardPreviewSection from "./DashboardPreviewSection";
import CampaignBuilderSection from "./CampaignBuilderSection";
import Customer360Section from "./Customer360Section";
import AIAssistantSection from "./AIAssistantSection";
import PlatformAnalyticsSection from "./PlatformAnalyticsSection";
import FinalCtaSection from "./FinalCtaSection";
import FooterSection from "./FooterSection";

/* ==========================================================
   FULL MARKETING / LANDING PAGE SECTION
   Composes each product-screen as its own module — the ids
   used for sidebar/search navigation (sec-overview,
   sec-dashboard-preview, sec-campaign-builder,
   sec-customer-360, sec-ai-assistant, sec-analytics,
   sec-cta, sec-footer) live inside their respective files,
   so scroll-to-section navigation keeps working unchanged.
========================================================== */
const MarketingStrategySection = () => {
    return (
        <div className="bg-black text-gray-300 min-h-screen w-full overflow-x-hidden relative">
            <Starfield />
            <HeroOverviewSection />
            <DashboardPreviewSection />
            <CampaignBuilderSection />
            <Customer360Section />
            <AIAssistantSection />
            <PlatformAnalyticsSection />
            <FinalCtaSection />
            <FooterSection />
        </div>
    );
};

export default MarketingStrategySection;