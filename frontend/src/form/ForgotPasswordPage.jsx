/**
 * ForgotPasswordPage.jsx
 * Forgot-password form — collects email + new password,
 * sends reset request to backend, then redirects to OTP.
 */
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function ForgotPasswordPage() {
  /* ── State ─────────────────────────────────── */
  const [form, setForm] = useState({ email: "", newPassword: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  /* ── Submit reset request ──────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (form.newPassword !== form.confirmPassword) {
      setLoading(false);
      return alert("New passwords do not match.");
    }

    try {
      const res = await fetch(`${process.env.REACT_APP_API_BASE_URL}/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, newPassword: form.newPassword }),
      });

      if (res.ok) {
        alert("Password reset initiated. Check your email for the verification code.");
        navigate("/otp", { state: { email: form.email, isPasswordReset: true } });
      } else {
        const err = await res.json();
        alert("Reset failed: " + (err.error || JSON.stringify(err)));
      }
    } catch {
      alert("Something went wrong while initiating password reset.");
    }
    setLoading(false);
  };

  /* ── Render ────────────────────────────────── */
  return (
    <div className="auth-main-container">
      <div className="auth-card">
        <h2 className="auth-form-title">Reset Password</h2>
        <p className="auth-subtitle">Enter your email and new password. We will send an OTP to verify.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <input type="email" name="email" placeholder="Email Address" value={form.email} onChange={handleChange} className="auth-input" required />
          <input type="password" name="newPassword" placeholder="New Password" value={form.newPassword} onChange={handleChange} className="auth-input" required />
          <input type="password" name="confirmPassword" placeholder="Confirm New Password" value={form.confirmPassword} onChange={handleChange} className="auth-input" required />

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? "Sending OTP..." : "Reset Password"}
          </button>
        </form>
      </div>
    </div>
  );
}