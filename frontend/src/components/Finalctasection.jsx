import React from "react";

/* ==========================================================
   FINAL CTA (id="sec-cta")
   Fit-screen layout: fills the routed content area exactly,
   no internal page scroll needed.
========================================================== */
const FinalCtaSection = () => {
    return (
        <section id="sec-cta" className="h-full flex items-center bg-gradient-to-br from-black via-orange-950 to-black text-white relative z-10">
            <div className="max-w-5xl mx-auto text-center px-4 sm:px-6 lg:px-10 w-full">
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight text-white">
                    Build the Future of AI Powered Revenue
                </h2>

                <p className="text-base sm:text-lg mt-5 text-gray-300 leading-7 max-w-3xl mx-auto">
                    GrowthOS AI transforms CRM, Marketing, Sales,
                    Automation and Artificial Intelligence into one
                    intelligent platform designed for modern enterprises.
                </p>

                <div className="flex flex-wrap justify-center gap-4 mt-8">
                    <button className="bg-orange-500 text-white px-8 py-4 rounded-lg font-bold hover:bg-orange-600 transition">
                        Request Live Demo
                    </button>
                    <button className="border border-orange-500 text-orange-500 px-8 py-4 rounded-lg hover:bg-orange-500 hover:text-white transition">
                        Contact Sales
                    </button>
                </div>
            </div>
        </section>
    );
};

export default FinalCtaSection;