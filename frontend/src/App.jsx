import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import PricingPage from "./components/PricingPage";
import Growthosdashboard from "./components/Growthosdashboard";
import CompanyRegistrationForm from "./components/CompanyRegistrationForm";
import Login from "./components/Login";
import Home from "./components/Home";
import Products from "./components/Products";

/* ==========================================================
   Flow:
   1. "/"         → CompanyRegistrationForm (home / first screen)
   2. "/register" → same form (kept as an explicit alias, e.g. for
                     a "Register" link from the login page)
   3. "/login"    → Login
   4. "/home"     → Home — company welcome + products, opens after login
   5. "/products" → Products — full product list, add/edit ("Products" in sidebar)
   6. "/pricing"  → PricingPage (kept, just no longer the home route)
   7. "/app/*"    → Growthosdashboard — full CRM, reached via "Go to Dashboard" on Home
========================================================== */
const App = () => {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<CompanyRegistrationForm />} />
                <Route path="/register" element={<CompanyRegistrationForm />} />
                <Route path="/login" element={<Login />} />
                <Route path="/home" element={<Home />} />
                <Route path="/products" element={<Products />} />
                <Route path="/pricing" element={<PricingPage />} />
                <Route path="/app/*" element={<Growthosdashboard />} />
            </Routes>
        </BrowserRouter>
    );
};

export default App;