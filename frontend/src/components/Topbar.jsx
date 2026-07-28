import React, { useState } from "react";
import { Menu, Search, X, Bell, Sparkles } from "lucide-react";
import { allNavItems } from "./Sidebar";

// sidebarOpen: boolean — whether the sidebar is currently expanded
// setSidebarOpen: (fn) => void — toggles sidebar visibility
// goToSection: (id) => void — scrolls to a section and marks it active
const TopBar = ({ sidebarOpen, setSidebarOpen, goToSection }) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [highlightedIndex, setHighlightedIndex] = useState(0);

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
    );
};

export default TopBar;