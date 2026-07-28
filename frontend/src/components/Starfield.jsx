import React from "react";

/* ==========================================================
   Starfield background used behind the marketing/landing
   sections. Renders 80 randomly placed twinkling dots.
========================================================== */
const Starfield = () => {
    return (
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
    );
};

export default Starfield;