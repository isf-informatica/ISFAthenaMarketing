import React, { createContext, useContext, useState } from "react";

const AuthContext = createContext(null);

const STORAGE_KEY_COMPANIES = "growthos_companies";
const STORAGE_KEY_SESSION = "growthos_session";

// ---- tiny localStorage helpers (mock "database") ----
const readCompanies = () => {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY_COMPANIES)) || [];
    } catch {
        return [];
    }
};
const writeCompanies = (list) => {
    localStorage.setItem(STORAGE_KEY_COMPANIES, JSON.stringify(list));
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY_SESSION)) || null;
        } catch {
            return null;
        }
    });

    /**
     * TODO: replace body with a real API call, e.g.
     *   const res = await fetch(`${API_BASE_URL}/Easylearn/register_company`, {
     *       method: "POST",
     *       body: formData,
     *       credentials: "include",
     *   });
     *   const data = await res.json();
     *   if (!data.success) throw new Error(data.message);
     *
     * Keep the same signature/return shape so RegistrationForm.jsx
     * doesn't need any changes when you wire the real backend in.
     */
    const register = async ({ companyName, contactPerson, email, phone, password, plan }) => {
        const companies = readCompanies();

        if (companies.some((c) => c.email.toLowerCase() === email.toLowerCase())) {
            throw new Error("An account with this email already exists.");
        }

        const newCompany = { companyName, contactPerson, email, phone, password, plan };
        writeCompanies([...companies, newCompany]);
        return { success: true };
    };

    /**
     * TODO: replace body with a real API call, same idea as register() above.
     */
    const login = async ({ email, password }) => {
        const companies = readCompanies();
        const match = companies.find(
            (c) => c.email.toLowerCase() === email.toLowerCase() && c.password === password
        );

        if (!match) {
            throw new Error("Invalid email or password.");
        }

        const session = {
            companyName: match.companyName,
            contactPerson: match.contactPerson,
            email: match.email,
            plan: match.plan,
        };
        localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(session));
        setUser(session);
        return { success: true };
    };

    const logout = () => {
        localStorage.removeItem(STORAGE_KEY_SESSION);
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, isAuthenticated: !!user, register, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used inside an <AuthProvider>");
    return ctx;
};