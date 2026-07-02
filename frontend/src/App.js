/**
 * App.js
 * Root component — sets up client-side routing
 * for authentication pages and the main dashboard.
 */
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

/* ── Auth pages ───────────────────────────────── */
import FirstPage from "./form/FirstPage.jsx";
import OtpPage from "./form/OtpPage.jsx";
import RegistrationPage from "./form/RegistrationPage.jsx";
import ForgotPasswordPage from "./form/ForgotPasswordPage.jsx";

/* ── Main dashboard shell ─────────────────────── */
import Home from "./Home/Home.jsx";

/* ── Global reset only (per-component CSS imported locally) ── */
import "./App.css";
import { getCookie } from "./utils/cookieUtils";

// Protects public routes (like /login) - if token exists, force back to root
const PublicRoute = ({ children }) => {
  const token = getCookie("token");
  return token ? <Navigate to="/" replace /> : children;
};

function App() {
  return (
    <Router>
      <Routes>
        {/* The Landing Page IS the Home Page */}
        <Route path="/" element={<Home />} />
        
        {/* Auth flow */}
        <Route path="/login" element={<PublicRoute><FirstPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegistrationPage /></PublicRoute>} />
        <Route path="/otp" element={<OtpPage />} />
        <Route path="/forgot" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />

        {/* Catch-all: redirect any unknown URL to root */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
