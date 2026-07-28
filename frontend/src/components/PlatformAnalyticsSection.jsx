import React from "react";

const analyticsKpis = [
    { value: "90.8%", title: "Customer Satisfaction" },
    { value: "1 Day", title: "Avg Resolution" },
    { value: "€94.8M", title: "Revenue" },
    { value: "+56%", title: "Monthly Growth" },
];

const funnelSteps = [
    "Visitors : 50,000",
    "Leads : 12,400",
    "Qualified : 5,800",
    "Proposals : 2,300",
    "Customers : 1,020",
];

const trendPoints = [
    [0, 150],
    [71, 138],
    [142, 122],
    [214, 104],
    [285, 78],
    [357, 48],
    [428, 26],
    [500, 14],
];
const trendPolylinePoints = trendPoints.map(([x, y]) => `${x},${y}`).join(" ");

/* ==========================================================
   PLATFORM ANALYTICS DASHBOARD (id="sec-analytics")
   Fit-screen layout: fills the routed content area exactly,
   no internal page scroll needed.
========================================================== */
const PlatformAnalyticsSection = () => {
    return (
        <section id="sec-analytics" className="h-full flex flex-col overflow-hidden relative z-10 py-4 sm:py-5">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 w-full h-full flex flex-col min-h-0">
                <div className="text-center shrink-0">
                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white">
                        Analytics Dashboard
                    </h2>
                    <p className="text-gray-300 mt-2 text-sm">
                        Real-time business intelligence powered by AI.
                    </p>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-5 shrink-0">
                    {analyticsKpis.map((item, index) => (
                        <div key={index} className="bg-black border border-orange-600/30 rounded-2xl p-4">
                            <h2 className="text-xl sm:text-2xl font-bold text-orange-500">{item.value}</h2>
                            <p className="text-gray-300 mt-1 text-xs sm:text-sm">{item.title}</p>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-5 flex-1 min-h-0">
                    <div className="bg-black border border-orange-600/30 rounded-2xl p-4 sm:p-5 flex flex-col min-h-0">
                        <h3 className="text-lg sm:text-xl font-bold text-white shrink-0">Revenue Trend</h3>

                        <div className="flex-1 min-h-0 mt-3 bg-black border border-orange-600/30 rounded-2xl p-3 sm:p-4 flex flex-col">
                            <div className="flex-1 relative min-h-0">
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
                                        points={`0,190 ${trendPolylinePoints} 500,190`}
                                        fill="url(#revenueTrendGradient)"
                                    />

                                    <polyline
                                        points={trendPolylinePoints}
                                        fill="none"
                                        stroke="#f97316"
                                        strokeWidth="3"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />

                                    {trendPoints.map(([x, y], i) => (
                                        <circle key={i} cx={x} cy={y} r="5" fill="#f97316" stroke="#000000" strokeWidth="2" />
                                    ))}
                                </svg>
                            </div>

                            <div className="flex justify-between mt-2 px-1 shrink-0">
                                {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug"].map((month) => (
                                    <span key={month} className="text-xs text-gray-500">{month}</span>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="bg-black border border-orange-600/30 rounded-2xl p-4 sm:p-5 flex flex-col min-h-0">
                        <h3 className="text-lg sm:text-xl font-bold text-white shrink-0">Funnel Analytics</h3>
                        <div className="space-y-2.5 mt-4 overflow-y-auto min-h-0">
                            {funnelSteps.map((item, index) => (
                                <div key={index} className="bg-black border border-orange-600/30 rounded-xl p-3 text-sm">
                                    {item}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default PlatformAnalyticsSection;