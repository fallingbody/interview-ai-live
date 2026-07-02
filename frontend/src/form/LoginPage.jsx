/**
 * LoginPage.jsx
 * Login form — email + password fields, remember-me
 * checkbox, and forgot-password link.
 *
 * UI updated to match the new premium design from "Generate Responsive UI Code".
 * Props (form, handleChange, handleLogin, loading) are unchanged.
 */
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function LoginPage({ form = {}, handleChange, handleLogin, loading }) {
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  return (
    <form onSubmit={handleLogin} className="auth-form">

      {/* Email field */}
      <div className="auth-field">
        <label className="auth-field-label" htmlFor="login-email">Email</label>
        <input
          id="login-email"
          type="text"
          name="username"
          placeholder="you@example.com"
          value={form.username || ""}
          onChange={handleChange}
          className="auth-input"
          required
        />
      </div>

      {/* Password field */}
      <div className="auth-field">
        <div className="auth-password-header">
          <label className="auth-field-label" htmlFor="login-password">Password</label>
          <button
            type="button"
            className="auth-forgot-link"
            onClick={() => navigate("/forgot")}
          >
            Forgot Password?
          </button>
        </div>
        <div className="auth-password-input-wrap">
          <input
            id="login-password"
            type={showPassword ? "text" : "password"}
            name="password"
            placeholder="Enter your password"
            value={form.password || ""}
            onChange={handleChange}
            className="auth-input auth-input--password"
            required
          />
          <button
            type="button"
            className="auth-password-toggle"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2.25 12s3.5-6.25 9.75-6.25S21.75 12 21.75 12s-3.5 6.25-9.75 6.25S2.25 12 2.25 12Z" />
              <circle cx="12" cy="12" r="2.75" />
              {showPassword && <path d="M4 20 20 4" />}
            </svg>
          </button>
        </div>
      </div>

      {/* Remember me */}
      <label className="auth-checkbox-container">
        <input
          type="checkbox"
          className="auth-checkbox"
          checked={rememberMe}
          onChange={(e) => setRememberMe(e.target.checked)}
        />
        <span className="auth-checkbox-label">Remember me</span>
      </label>

      {/* Submit */}
      <button type="submit" className="auth-submit-btn" disabled={loading}>
        {loading ? "Signing in…" : "Sign In"}
      </button>

      <p className="auth-terms-text">
        By continuing you agree to our Terms and Privacy Policy.
      </p>
    </form>
  );
}
