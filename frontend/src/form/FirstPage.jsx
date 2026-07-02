/**
 * FirstPage.jsx
 * Authentication entry point — shows Login / Register tabs.
 * Handles Firebase auth (create/sign-in) and backend
 * registration + OTP flow.
 *
 * UI updated to match the new premium design from "Generate Responsive UI Code".
 * All business logic (Firebase, API calls, state, navigation) is preserved.
 */
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import LoginPage from "./LoginPage";
import RegistrationPage from "./RegistrationPage";
import "./FirstPage.css";

import { auth, db } from "../Firebase";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { setCookie } from "../utils/cookieUtils";

/* ── Logo sub-component (new premium design) ───── */
const AuthLogo = () => (
  <div className="auth-logo-container">
    {/* Gradient icon box */}
    <div className="auth-logo-icon-box" style={{ background: "#6265f4", boxShadow: "0 2px 10px rgba(98,101,244,0.4)" }}>
      <svg width="22" height="22" viewBox="0 0 20 20" fill="none" style={{ color: "white" }}>
        <path d="M9.18083 2.345C9.21654 2.15384 9.31798 1.98118 9.46758 1.85693C9.61718 1.73268 9.80553 1.66467 10 1.66467C10.1945 1.66467 10.3828 1.73268 10.5324 1.85693C10.682 1.98118 10.7835 2.15384 10.8192 2.345L11.695 6.97667C11.7572 7.30596 11.9172 7.60885 12.1542 7.84581C12.3912 8.08277 12.694 8.2428 13.0233 8.305L17.655 9.18083C17.8462 9.21654 18.0188 9.31798 18.1431 9.46758C18.2673 9.61718 18.3353 9.80553 18.3353 10C18.3353 10.1945 18.2673 10.3828 18.1431 10.5324C18.0188 10.682 17.8462 10.7835 17.655 10.8192L13.0233 11.695C12.694 11.7572 12.3912 11.9172 12.1542 12.1542C11.9172 12.3912 11.7572 12.694 11.695 13.0233L10.8192 17.655C10.7835 17.8462 10.682 18.0188 10.5324 18.1431C10.3828 18.2673 10.1945 18.3353 10 18.3353C9.80553 18.3353 9.61718 18.2673 9.46758 18.1431C9.31798 18.0188 9.21654 17.8462 9.18083 17.655L8.305 13.0233C8.2428 12.694 8.08277 12.3912 7.84581 12.1542C7.60885 11.9172 7.30596 11.7572 6.97667 11.695L2.345 10.8192C2.15384 10.7835 1.98118 10.682 1.85693 10.5324C1.73268 10.3828 1.66467 10.1945 1.66467 10C1.66467 9.80553 1.73268 9.61718 1.85693 9.46758C1.98118 9.31798 2.15384 9.21654 2.345 9.18083L6.97667 8.305C7.30596 8.2428 7.60885 8.08277 7.84581 7.84581C8.08277 7.60885 8.2428 7.30596 8.305 6.97667L9.18083 2.345Z"
          stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667"/>
        <path d="M16.6667 1.66667V5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667"/>
        <path d="M18.3333 3.33333H15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667"/>
        <path d="M3.33333 18.3333C4.25381 18.3333 5 17.5871 5 16.6667C5 15.7462 4.25381 15 3.33333 15C2.41286 15 1.66667 15.7462 1.66667 16.6667C1.66667 17.5871 2.41286 18.3333 3.33333 18.3333Z"
          stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667"/>
      </svg>
    </div>
    <span className="auth-logo-text">Interview.ai</span>
  </div>
);

/* ═══════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════ */
export default function FirstPage() {
  /* ── State ─────────────────────────────────── */
  const [activeTab, setActiveTab] = useState("login");
  const [form, setForm] = useState({
    username: "",
    company_name: "",
    email: "",
    usertype: "candidate",
    password: "",
    confirm_password: "",
  });
  const [loading, setLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState({ text: "", type: "" }); // type: 'error' | 'success'
  const navigate = useNavigate();

  /** Generic input change handler */
  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  /* ── Register handler ──────────────────────── */
  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAuthMessage({ text: "", type: "" });

    if (form.password !== form.confirm_password) {
      setAuthMessage({ text: "Passwords do not match!", type: "error" });
      setLoading(false);
      return;
    }

    try {
      // 1. Create user in Firebase Auth (with 10s timeout to prevent infinite hang)
      const firebaseSignUp = createUserWithEmailAndPassword(auth, form.email, form.password);
      const firebaseTimeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Firebase sign-up timed out. Please try again.")), 10000)
      );
      const cred = await Promise.race([firebaseSignUp, firebaseTimeout]);
      const user = cred.user;

      // 2. Save profile to Firestore (non-blocking — if it hangs, registration continues)
      try {
        const firestoreWrite = setDoc(doc(db, "users", user.uid), {
          email: user.email,
          username: form.username,
          company_name: form.company_name,
          uid: user.uid,
          usertype: form.usertype,
        });
        const firestoreTimeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Firestore timeout")), 5000)
        );
        await Promise.race([firestoreWrite, firestoreTimeout]);
      } catch (firestoreErr) {
        console.warn("Firestore write skipped:", firestoreErr.message);
        // Non-critical — continue with backend registration
      }

      // 3. Register on backend (MongoDB + OTP)
      let backendRes;
      try {
        backendRes = await fetch(`${process.env.REACT_APP_API_BASE_URL}/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: form.username,
            company_name: form.company_name,
            email: form.email,
            password: form.password,
            usertype: form.usertype,
            uid: user.uid,
          }),
        });
      } catch (err) {
        console.error("Network error during registration:", err);
        await user.delete();
        setAuthMessage({ text: "Network error during registration. Please try again.", type: "error" });
        setLoading(false);
        return;
      }

      if (!backendRes.ok) {
        const errData = await backendRes.json();
        // Rollback firebase user since backend failed
        try { await user.delete(); } catch(e) {}
        setAuthMessage({ text: errData.error || "Failed to register on server. Please try again.", type: "error" });
        setLoading(false);
        return;
      }

      // Success - Navigate immediately to OTP page
      navigate("/otp", { state: { email: form.email }, replace: true });

    } catch (error) {
      if (error.code === "auth/email-already-in-use") {
        try {
          const checkRes = await fetch(`${process.env.REACT_APP_API_BASE_URL}/check-pending`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: form.email })
          });
          if (checkRes.ok) {
            const checkData = await checkRes.json();
            if (checkData.pending) {
              setAuthMessage({ text: "Pending registration found. Redirecting to verification...", type: "success" });
              setTimeout(() => {
                navigate("/otp", { state: { email: form.email }, replace: true });
              }, 1500);
              return;
            } else if (checkData.clearedOrphan) {
              setAuthMessage({ text: "Cleaned up a previous incomplete registration. Please click 'Create Account' again to proceed.", type: "error" });
              setLoading(false);
              return;
            }
          }
        } catch (checkErr) {
          console.error("Failed to check pending registration:", checkErr);
        }
      }

      // Log Firebase error details silently in console
      console.warn("Firebase Auth Error:", error.code, error.message);
      
      let msg = "Registration failed. ";
      if (error.code === "auth/email-already-in-use") msg = "This email is already registered. Please log in.";
      else if (error.code === "auth/weak-password") msg = "Password must be at least 6 characters.";
      else if (error.code === "auth/invalid-email") msg = "Invalid email address format.";
      else if (error.code === "auth/operation-not-allowed") msg = "Email/password sign-in is disabled.";
      else msg += error.message;
      setAuthMessage({ text: msg, type: "error" });
    } finally {
      // GUARANTEED to always run - stops loading no matter what
      setLoading(false);
    }
  };

  /* ── Login handler ─────────────────────────── */
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAuthMessage({ text: "", type: "" });

    // Fallback: Read values directly from DOM inputs in case Chrome's autofill did not trigger state change
    const emailInput = document.getElementById("login-email");
    const passwordInput = document.getElementById("login-password");
    const loginId = form.email || form.username || (emailInput ? emailInput.value : "");
    const passwordVal = form.password || (passwordInput ? passwordInput.value : "");

    try {
      // 1. Authenticate with Firebase
      const cred = await signInWithEmailAndPassword(auth, loginId, passwordVal);
      const firebaseToken = await cred.user.getIdToken();

      // 2. Send Firebase token to backend for session creation
      const res = await fetch(`${process.env.REACT_APP_API_BASE_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${firebaseToken}`,
        },
        body: JSON.stringify({ uid: cred.user.uid }),
      });

      if (res.ok) {
        const data = await res.json();
        setCookie("token", data.token, 7);
        setCookie("userId", data.userId, 7);
        // Replace history entry so back button skips login page
        navigate("/home", { replace: true });
      } else if (res.status === 403) {
        // Account exists but is not verified
        const data = await res.json();
        navigate("/otp", { state: { email: data.email }, replace: true });
      } else {
        const err = await res.json();
        setAuthMessage({ text: "Login failed: " + (err.error || JSON.stringify(err)), type: "error" });
      }
    } catch (error) {
      console.error("Firebase Login Detailed Error:", error);
      let msg = "Login failed. ";
      if (error.code === "auth/user-not-found") msg = "No account found with this email.";
      else if (error.code === "auth/wrong-password") msg = "Incorrect password. Please try again.";
      else if (error.code === "auth/invalid-credential") msg = "Invalid email or password.";
      else if (error.code === "auth/invalid-email") msg = "Invalid email address format.";
      else msg += error.message;

      setAuthMessage({ text: msg, type: "error" });
    }
    setLoading(false);
  };

  /* ── Render ────────────────────────────────── */
  return (
    <div className="auth-main-container">
      <div className="auth-inner-wrapper">

        {/* Logo */}
        <AuthLogo />

        {/* Auth Card */}
        <div className="auth-card">
          {/* Card header */}
          <div className="auth-card-header">
            <h1 className="auth-card-title">
              {activeTab === "login" ? "Welcome Back" : "Create Account"}
            </h1>
            <p className="auth-card-subtitle">
              {activeTab === "login"
                ? "Sign in to continue to your workspace."
                : "Fill in the details below to get started."}
            </p>
          </div>

          {/* Tab toggle */}
          <div className="auth-tab-container">
            <button
              onClick={() => setActiveTab("login")}
              className={`auth-tab-button ${activeTab === "login" ? "active" : ""}`}
            >
              Sign In
            </button>
            <button
              onClick={() => setActiveTab("register")}
              className={`auth-tab-button ${activeTab === "register" ? "active" : ""}`}
            >
              Register
            </button>
          </div>

          {/* Active form */}
          {activeTab === "login" ? (
            <LoginPage form={form} handleChange={handleChange} handleLogin={handleLogin} loading={loading} />
          ) : (
            <RegistrationPage form={form} handleChange={handleChange} handleRegister={handleRegister} loading={loading} authMessage={authMessage} />
          )}

          {/* Inline auth message (replaces browser alert popups) */}
          {authMessage.text && (
            <div className={`auth-inline-msg auth-inline-msg--${authMessage.type}`}>
              {authMessage.text}
            </div>
          )}

          {loading && <p className="status-text">Loading…</p>}
        </div>


        {/* Footer switch link */}
        <div className="auth-footer">
          {activeTab === "login" ? (
            <>
              New to Interview.ai?{" "}
              <button className="auth-footer-link" onClick={() => setActiveTab("register")}>
                Create Account
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button className="auth-footer-link" onClick={() => setActiveTab("login")}>
                Sign In
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
}
