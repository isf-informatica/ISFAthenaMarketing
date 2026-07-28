import React from "react";

/* ==========================================================
   FOOTER (id="sec-footer")
   Fit-screen layout: fills the routed content area exactly,
   no internal page scroll needed.
========================================================== */
const FooterSection = () => {
    return (
        <footer id="sec-footer" className="h-full flex items-center bg-black text-gray-400 relative z-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 w-full flex flex-col lg:flex-row justify-between items-center gap-6">
                <div className="text-center lg:text-left">
                    <h3 className="text-2xl font-bold text-white">GrowthOS AI</h3>
                    <p className="mt-2">AI Powered Revenue Platform</p>
                </div>

                <div className="flex gap-8">
                    <a href="#" className="hover:text-white">Platform</a>
                    <a href="#" className="hover:text-white">Solutions</a>
                    <a href="#" className="hover:text-white">Pricing</a>
                    <a href="#" className="hover:text-white">Contact</a>
                </div>
            </div>
        </footer>
    );
};

export default FooterSection;