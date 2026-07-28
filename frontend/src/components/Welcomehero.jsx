import React from "react";
import { Calendar } from "lucide-react";

const WelcomeHero = () => {
    return (
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
    );
};

export default WelcomeHero;