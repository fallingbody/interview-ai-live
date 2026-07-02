/**
 * RegistrationPage.jsx
 * Registration form — username, email, password,
 * and confirm-password fields.
 *
 * UI updated to match the new premium design from "Generate Responsive UI Code".
 * Props (form, handleChange, handleRegister, loading) are unchanged.
 */
import React, { useState } from "react";

export default function RegistrationPage({ form = {}, handleChange, handleRegister, loading, authMessage = { text: "", type: "" } }) {
  const [fieldErrors, setFieldErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  /** Client-side validation before submitting */
  const handleSubmit = (e) => {
    e.preventDefault();
    const errors = {};

    if (form.password && form.password.length < 6) {
      errors.password = "Password must be at least 6 characters.";
    }
    if (form.password !== form.confirm_password) {
      errors.confirm_password = "Passwords do not match.";
    }

    setFieldErrors(errors);

    // Only proceed if no inline errors
    if (Object.keys(errors).length === 0) {
      handleRegister(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="auth-form">

      {/* Username */}
      <div className="auth-field">
        <label className="auth-field-label" htmlFor="reg-username">Username</label>
        <input
          id="reg-username"
          type="text"
          name="username"
          placeholder="Username"
          value={form.username || ""}
          onChange={handleChange}
          className="auth-input"
          required
        />
      </div>

      {/* Company Name */}
      <div className="auth-field">
        <label className="auth-field-label" htmlFor="reg-company-name">Company Name</label>
        <input
          id="reg-company-name"
          type="text"
          name="company_name"
          placeholder="Your company"
          value={form.company_name || ""}
          onChange={handleChange}
          className="auth-input"
          required
        />
      </div>

      {/* Email */}
      <div className="auth-field">
        <label className="auth-field-label" htmlFor="reg-email">Email</label>
        <input
          id="reg-email"
          type="email"
          name="email"
          placeholder="you@example.com"
          value={form.email || ""}
          onChange={handleChange}
          className="auth-input"
          required
        />
      </div>

      {/* Password */}
      <div className="auth-field">
        <label className="auth-field-label" htmlFor="reg-password">Password</label>
        <div className="auth-password-input-wrap">
          <input
            id="reg-password"
            type={showPassword ? "text" : "password"}
            name="password"
            placeholder="Min. 6 characters"
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
        {fieldErrors.password && (
          <p className="auth-field-error">{fieldErrors.password}</p>
        )}
      </div>

      {/* Confirm Password */}
      <div className="auth-field">
        <label className="auth-field-label" htmlFor="reg-confirm-password">Confirm Password</label>
        <div className="auth-password-input-wrap">
          <input
            id="reg-confirm-password"
            type={showConfirmPassword ? "text" : "password"}
            name="confirm_password"
            placeholder="Re-enter your password"
            value={form.confirm_password || ""}
            onChange={handleChange}
            className="auth-input auth-input--password"
            required
          />
          <button
            type="button"
            className="auth-password-toggle"
            onClick={() => setShowConfirmPassword((value) => !value)}
            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            aria-pressed={showConfirmPassword}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2.25 12s3.5-6.25 9.75-6.25S21.75 12 21.75 12s-3.5 6.25-9.75 6.25S2.25 12 2.25 12Z" />
              <circle cx="12" cy="12" r="2.75" />
              {showConfirmPassword && <path d="M4 20 20 4" />}
            </svg>
          </button>
        </div>
        {fieldErrors.confirm_password && (
          <p className="auth-field-error">{fieldErrors.confirm_password}</p>
        )}
      </div>

      {/* Error / Success Message */}
      {authMessage.text && (
        <p style={{
          color: authMessage.type === "error" ? "#e53e3e" : "#38a169",
          fontSize: "0.85rem",
          textAlign: "center",
          margin: "8px 0",
          fontWeight: 500
        }}>
          {authMessage.text}
        </p>
      )}

      {/* Submit */}
      <button type="submit" className="auth-submit-btn" disabled={loading}>
        {loading ? "Creating Account..." : "Create Account"}
      </button>

      <p className="auth-terms-text">
        By continuing you agree to our Terms and Privacy Policy.
      </p>
    </form>
  );
}
