import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

/* ==========================================================
   CUSTOMER DATA CONTEXT
   Single source of truth for the leads list, read from YOUR
   OWN growthos_backend (main.py). Uses GET /leads — the LOCAL-
   ONLY endpoint — so this shows leads from isfathena.lead_generation
   exclusively. The EasyLearn site's leads are NOT merged in here
   (main.py's /leads/all does that, but this project intentionally
   uses the narrower /leads endpoint to keep the two lead sources
   separate). Lead_Management.jsx's "Add Lead" form WRITES to the
   same table via its own INSERT_PROSPECT_ENDPOINT; calling
   fetchLeads() after that insert refreshes this same list.

   Scoped to the CURRENTLY ACTIVE PRODUCT (same "growthos_active_product_id"
   localStorage key Home.jsx/PricingPage.jsx/Growthosdashboard.jsx/
   LeadGenerationSection.jsx all read and write) — so each product's
   dashboard only ever shows that product's own leads, never another
   product's, even within the same company.
========================================================== */

// TODO: keep this in sync with Lead_Management.jsx's API_BASE_URL —
// both must point at wherever growthos_backend (main.py) is deployed.
const API_BASE_URL = "http://localhost:8000";
const LIST_LOCAL_LEADS_ENDPOINT = `${API_BASE_URL}/leads`;
const ACTIVE_PRODUCT_KEY = "growthos_active_product_id";

// /leads is now company-scoped server-side (a JWT-less request gets
// rejected) — every company must only ever see its own leads.
const authHeaders = () => {
    const token = localStorage.getItem("growthos_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
};

const CustomerDataContext = createContext(null);

export const CustomerDataProvider = ({ children }) => {
    const [leads, setLeads] = useState([]);
    const [leadsLoading, setLeadsLoading] = useState(true);
    const [leadsError, setLeadsError] = useState("");
    const [selectedLeadKey, setSelectedLeadKey] = useState(null);

    const fetchLeads = useCallback(async () => {
        setLeadsLoading(true);
        setLeadsError("");
        try {
            // Read fresh each call (not just once on mount) — if the user
            // has switched products since the last fetch (e.g. via Lead
            // Generation's product selector), this picks up the new one.
            const activeProductId = localStorage.getItem(ACTIVE_PRODUCT_KEY);
            const url = activeProductId
                ? `${LIST_LOCAL_LEADS_ENDPOINT}?product_id=${activeProductId}`
                : LIST_LOCAL_LEADS_ENDPOINT;
            const res = await fetch(url, { method: "GET", headers: authHeaders() });
            const resp = await res.json();

            if (res.ok && resp.success && Array.isArray(resp.data)) {
                setLeads(resp.data);
                // Keep current selection if it still exists, otherwise default to the first lead.
                // Compared as strings — l.id comes back as a number from the API, while
                // selectedLeadKey (set from a <select>'s onChange) is always a string.
                setSelectedLeadKey((prev) => {
                    const stillExists = resp.data.some((l, i) => String(l.id ?? i) === String(prev));
                    if (stillExists) return prev;
                    return resp.data.length ? String(resp.data[0].id ?? "0") : null;
                });
            } else {
                setLeads([]);
                setSelectedLeadKey(null);
                setLeadsError(resp.message || "Couldn't load leads.");
            }
        } catch (err) {
            setLeadsError("Couldn't load leads. Check your connection and try again.");
        } finally {
            setLeadsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLeads();
    }, [fetchLeads]);

    // Same string-coercion fix as above — l.id is a number, selectedLeadKey is
    // always a string, so this must compare as strings on both sides.
    const selectedLead =
        leads.find((l, i) => String(l.id ?? i) === String(selectedLeadKey)) || leads[0] || null;

    return (
        <CustomerDataContext.Provider
            value={{
                leads,
                leadsLoading,
                leadsError,
                fetchLeads,
                selectedLeadKey,
                setSelectedLeadKey,
                selectedLead,
            }}
        >
            {children}
        </CustomerDataContext.Provider>
    );
};

export const useCustomerData = () => {
    const ctx = useContext(CustomerDataContext);
    if (!ctx) {
        throw new Error("useCustomerData must be used within a CustomerDataProvider");
    }
    return ctx;
};