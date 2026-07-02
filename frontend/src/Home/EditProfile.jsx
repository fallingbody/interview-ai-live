/**
 * EditProfile.jsx
 * Profile edit form — username, email, and password change.
 * Matches Interview.ai Home.css theme exactly:
 * Inter font, #6265f4 accent, white background, no emojis.
 * Full-screen overlay loader on save with field-specific message.
 */
import React, { useState, useEffect, useCallback } from "react";
import { getCookie } from "../utils/cookieUtils";

/* ── Full-Screen Save Overlay ───────────────────── */
const SaveOverlay = ({ fields }) => {
  const lines = [];
  if (fields.username) lines.push("Username updated");
  if (fields.email)    lines.push("Email updated");
  if (fields.password) lines.push("Password updated");
  const message = lines.join(" · ");

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      background: "rgba(255,255,255,0.92)",
      backdropFilter: "blur(6px)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: "1.5rem",
      animation: "epFadeIn 0.25s ease both",
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      {/* Ring spinner */}
      <div style={{ position: "relative", width: 64, height: 64 }}>
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          border: "3px solid rgba(98,101,244,0.15)",
          borderTopColor: "#6265f4",
          animation: "epSpin 0.75s linear infinite",
        }} />
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            width: 10, height: 10, borderRadius: "50%",
            background: "#6265f4",
            animation: "epPulseScale 0.75s ease-in-out infinite",
          }} />
        </div>
      </div>

      {/* Text */}
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: "1.125rem", fontWeight: 700, color: "#111827", margin: 0, letterSpacing: "-0.01em" }}>
          Saving changes...
        </p>
        <p style={{ fontSize: "0.9375rem", color: "#6265f4", marginTop: "0.375rem", fontWeight: 500 }}>
          {message}
        </p>
      </div>
    </div>
  );
};

/* ── Success Overlay ────────────────────────────── */
const SuccessOverlay = ({ fields, onDone }) => {
  const lines = [];
  if (fields.username) lines.push("Username");
  if (fields.email)    lines.push("Email");
  if (fields.password) lines.push("Password");
  const what = lines.length ? lines.join(", ") + (lines.length > 1 ? " have" : " has") + " been updated" : "Profile has been updated";

  useEffect(() => {
    const t = setTimeout(onDone, 2000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 99999,
      background: "rgba(255,255,255,0.94)",
      backdropFilter: "blur(6px)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      gap: "1.25rem",
      animation: "epFadeIn 0.2s ease both",
      fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      {/* Check circle */}
      <div style={{
        width: 64, height: 64, borderRadius: "50%",
        background: "linear-gradient(135deg, #6265f4, #8587f7)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 8px 24px rgba(98,101,244,0.35)",
        animation: "epPopIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both",
        fontSize: "1.625rem", color: "#fff", fontWeight: 700,
      }}>
        ✓
      </div>

      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: "1.125rem", fontWeight: 700, color: "#111827", margin: 0, letterSpacing: "-0.01em" }}>
          All done!
        </p>
        <p style={{ fontSize: "0.9375rem", color: "#6b7280", marginTop: "0.375rem" }}>
          {what} successfully.
        </p>
      </div>
    </div>
  );
};

/* ── Toast ─────────────────────────────────────── */
const Toast = ({ toasts, removeToast }) => (
  <div style={{ position: "fixed", top: "1.25rem", right: "1.25rem", zIndex: 9999, display: "flex", flexDirection: "column", gap: "0.625rem", pointerEvents: "none" }}>
    {toasts.map((t) => (
      <div key={t.id} style={{
        pointerEvents: "auto",
        display: "flex", alignItems: "center", gap: "0.625rem",
        padding: "0.75rem 1rem",
        background: "#ffffff",
        border: `1px solid ${t.type === "success" ? "#bbf7d0" : t.type === "error" ? "#fecaca" : "#fed7aa"}`,
        borderRadius: "0.75rem",
        boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
        fontFamily: "'Inter', sans-serif", fontSize: "0.875rem", fontWeight: 500,
        color: t.type === "success" ? "#15803d" : t.type === "error" ? "#dc2626" : "#9a3412",
        animation: "epSlideIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both",
        minWidth: "260px",
      }}>
        <span style={{
          width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
          background: t.type === "success" ? "#22c55e" : t.type === "error" ? "#ef4444" : "#f59e0b",
          color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "0.6875rem", fontWeight: 700,
        }}>
          {t.type === "success" ? "✓" : t.type === "error" ? "✕" : "!"}
        </span>
        <span style={{ flex: 1 }}>{t.message}</span>
        <button onClick={() => removeToast(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: "1.125rem", lineHeight: 1, padding: "0 0.125rem" }}>×</button>
      </div>
    ))}
  </div>
);

/* ── Spinner (inline) ───────────────────────────── */
const Spinner = ({ size = 18, light = false }) => (
  <div style={{
    width: size, height: size, borderRadius: "50%", flexShrink: 0,
    border: `2px solid ${light ? "rgba(255,255,255,0.3)" : "rgba(98,101,244,0.2)"}`,
    borderTopColor: light ? "#ffffff" : "#6265f4",
    animation: "epSpin 0.7s linear infinite",
    display: "inline-block",
  }} />
);

/* ── Skeleton ───────────────────────────────────── */
const Skeleton = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
    <div style={{ height: 11, width: "5rem", borderRadius: 4, background: "#f3f4f6", animation: "epPulse 1.5s ease-in-out infinite" }} />
    <div style={{ height: 44, borderRadius: "0.625rem", background: "#f9fafb", animation: "epPulse 1.5s ease-in-out infinite" }} />
  </div>
);

/* ── Password Strength ──────────────────────────── */
const PasswordStrength = ({ password }) => {
  if (!password) return null;
  const score = [password.length >= 8, /[A-Z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)].filter(Boolean).length;
  const barColors  = ["", "#ef4444", "#f59e0b", "#84cc16", "#22c55e"];
  const labels     = ["", "Weak", "Fair", "Good", "Strong"];
  const textColors = ["", "#dc2626", "#d97706", "#65a30d", "#16a34a"];
  return (
    <div style={{ marginTop: "0.5rem" }}>
      <div style={{ display: "flex", gap: 4, marginBottom: 4 }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ flex: 1, height: 3, borderRadius: 9999, background: i <= score ? barColors[score] : "#f3f4f6", transition: "background 0.4s" }} />
        ))}
      </div>
      <span style={{ fontSize: "0.75rem", fontWeight: 500, color: textColors[score] }}>{labels[score]}</span>
    </div>
  );
};

/* ── Avatar ─────────────────────────────────────── */
const Avatar = ({ username, loading }) => {
  const initials = username ? username.split(" ").map(w => w[0]).slice(0,2).join("").toUpperCase() : "?";
  return (
    <div style={{ position: "relative", width: 56, height: 56, margin: "0 auto 1.25rem" }}>
      <div style={{
        width: 56, height: 56, borderRadius:50,
        background: "linear-gradient(135deg, #6265f4 0%, #8587f7 100%)",
        boxShadow: "0 4px 16px rgba(98,101,244,0.28)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "1.25rem", fontWeight: 700, color: "#fff",
        opacity: loading ? 0.6 : 1, transition: "opacity 0.3s",
        fontFamily: "'Inter', sans-serif",
      }}>
        {loading ? <Spinner size={22} light /> : initials}
      </div>
    </div>
  );
};

/* ── Input Field ────────────────────────────────── */
const EyeIcon = ({ crossed = false }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" style={{ width: 18, height: 18, fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" }}>
    <path d="M2.25 12s3.5-6.25 9.75-6.25S21.75 12 21.75 12s-3.5 6.25-9.75 6.25S2.25 12 2.25 12Z" />
    <circle cx="12" cy="12" r="2.75" />
    {crossed && <path d="M4 20 20 4" />}
  </svg>
);

const Field = ({ label, error, success, type = "text", ...props }) => {
  const [focused, setFocused] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const isPassword = type === "password";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
      <label style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#6b7280" }}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          {...props}
          type={isPassword && showPassword ? "text" : type}
          onFocus={e => { setFocused(true); props.onFocus && props.onFocus(e); }}
          onBlur={e => { setFocused(false); props.onBlur && props.onBlur(e); }}
          style={{
            width: "100%", boxSizing: "border-box",
            fontFamily: "'Inter', sans-serif", fontSize: "0.875rem",
            padding: isPassword ? "0.6875rem 4.25rem 0.6875rem 0.875rem" : "0.6875rem 2.25rem 0.6875rem 0.875rem",
            borderRadius: "0.625rem",
            border: `1.5px solid ${error ? "#fca5a5" : success ? "#86efac" : focused ? "#6265f4" : "#e5e7eb"}`,
            background: error ? "#fff5f5" : "#ffffff",
            color: "#111827", outline: "none",
            boxShadow: focused ? "0 0 0 3px rgba(98,101,244,0.12)" : error ? "0 0 0 3px rgba(239,68,68,0.08)" : "none",
            transition: "border-color 0.15s, box-shadow 0.15s",
          }}
        />
        {success && !error && !isPassword && (
          <span style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "#22c55e", fontSize: "0.875rem", fontWeight: 700 }}>✓</span>
        )}
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(value => !value)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            style={{
              position: "absolute",
              right: "0.75rem",
              top: "50%",
              transform: "translateY(-50%)",
              width: 24,
              height: 24,
              padding: 0,
              border: "none",
              background: "transparent",
              color: focused ? "#6265f4" : "#6b7280",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <EyeIcon crossed={showPassword} />
          </button>
        )}
      </div>
      {error && (
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.75rem", color: "#dc2626", display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <span style={{ fontSize: "0.625rem" }}>▲</span> {error}
        </span>
      )}
    </div>
  );
};

/* ── Divider ────────────────────────────────────── */
const Divider = ({ label }) => (
  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
    <div style={{ flex: 1, height: 1, background: "#f3f4f6" }} />
    <span style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.6875rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", color: "#d1d5db" }}>{label}</span>
    <div style={{ flex: 1, height: 1, background: "#f3f4f6" }} />
  </div>
);

/* ══════════════════════════════════════════════════
   MAIN COMPONENT
   ══════════════════════════════════════════════════ */
const EditProfile = () => {
  const [formData, setFormData]       = useState({ username: "", email: "", newPassword: "", confirmPassword: "", uid: "" });
  const [origData, setOrigData]       = useState({ username: "", email: "" });
  const [loading, setLoading]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [updatedFields, setUpdatedFields] = useState({});
  const [errors, setErrors]           = useState({});
  const [touched, setTouched]         = useState({});
  const [toasts, setToasts]           = useState([]);
  const [toastId, setToastId]         = useState(0);

  const addToast = useCallback((message, type = "success") => {
    const id = toastId;
    setToastId(n => n + 1);
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
  }, [toastId]);

  const removeToast = useCallback((id) => setToasts(p => p.filter(t => t.id !== id)), []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const token = getCookie("token");
        const res = await fetch(`${process.env.REACT_APP_API_BASE_URL}/profile`, {
          method: "GET",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        });
        if (res.ok) {
          const data = await res.json();
          setFormData(p => ({ ...p, username: data.username, email: data.email, uid: data.uid }));
          setOrigData({ username: data.username, email: data.email });
        } else {
          addToast("Failed to load profile data.", "error");
        }
      } catch {
        addToast("Network error while loading profile.", "error");
      }
      setLoading(false);
    })();
  }, []); // eslint-disable-line

  const validate = (d) => {
    const e = {};
    if (!d.username.trim()) e.username = "Username is required.";
    else if (d.username.trim().length < 3) e.username = "At least 3 characters.";
    if (!d.email.trim()) e.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) e.email = "Invalid email format.";
    if (d.newPassword && d.newPassword.length < 8) e.newPassword = "At least 8 characters.";
    if (d.newPassword && d.newPassword !== d.confirmPassword) e.confirmPassword = "Passwords do not match.";
    return e;
  };

  const handleChange = (e) => {
    const updated = { ...formData, [e.target.name]: e.target.value };
    setFormData(updated);
    if (touched[e.target.name]) setErrors(validate(updated));
  };

  const handleBlur = (e) => {
    setTouched(p => ({ ...p, [e.target.name]: true }));
    setErrors(validate(formData));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setTouched(Object.fromEntries(Object.keys(formData).map(k => [k, true])));
    const errs = validate(formData);
    setErrors(errs);
    if (Object.keys(errs).length) { addToast("Please fix the errors before saving.", "error"); return; }

    /* detect which fields actually changed */
    const changed = {
      username: formData.username.trim() !== origData.username,
      email:    formData.email.trim()    !== origData.email,
      password: !!formData.newPassword,
    };

    const nothingChanged = !changed.username && !changed.email && !changed.password;
    if (nothingChanged) {
      addToast("No changes to save.", "warning");
      return;
    }

    setUpdatedFields(changed);
    setSaving(true);

    try {
      const token = getCookie("token");
      const res = await fetch(`${process.env.REACT_APP_API_BASE_URL}/profile`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.username,
          email: formData.email,
          ...(formData.newPassword ? { newPassword: formData.newPassword } : {}),
        }),
      });

      setSaving(false);

      if (res.ok) {
        setFormData(p => ({ ...p, newPassword: "", confirmPassword: "" }));
        setOrigData({ username: formData.username, email: formData.email });
        setShowSuccess(true);
      } else {
        const err = await res.json();
        addToast("Update failed: " + (err.error || "Server error."), "error");
      }
    } catch {
      setSaving(false);
      addToast("Unexpected error during update.", "error");
    }
  };

  const fieldLoading = loading && !formData.uid;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @keyframes epSlideIn     { from { opacity:0; transform:translateX(24px) scale(0.97); } to { opacity:1; transform:translateX(0) scale(1); } }
        @keyframes epSpin        { to { transform:rotate(360deg); } }
        @keyframes epPulse       { 0%,100% { opacity:1; } 50% { opacity:0.45; } }
        @keyframes epFadeUp      { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes epFadeIn      { from { opacity:0; } to { opacity:1; } }
        @keyframes epPopIn       { from { opacity:0; transform:scale(0.6); } to { opacity:1; transform:scale(1); } }
        @keyframes epPulseScale  { 0%,100% { transform:scale(1); opacity:1; } 50% { transform:scale(0.6); opacity:0.5; } }
        .ep-fade { animation: epFadeUp 0.45s cubic-bezier(0.22,1,0.36,1) both; }
        .ep-s1  { animation-delay:0.05s; }
        .ep-s2  { animation-delay:0.10s; }
        .ep-s3  { animation-delay:0.15s; }
        .ep-s4  { animation-delay:0.20s; }
        .ep-s5  { animation-delay:0.25s; }
        .ep-s6  { animation-delay:0.30s; }
        .ep-save-btn:hover:not(:disabled) { background:#4338ca !important; transform:translateY(-1px); }
        .ep-save-btn:active:not(:disabled) { transform:translateY(0) !important; }
        .ep-save-btn:disabled { opacity:0.7; cursor:not-allowed; }
      `}</style>

      {/* Full-screen overlays */}
      {saving      && <SaveOverlay fields={updatedFields} />}
      {showSuccess && <SuccessOverlay fields={updatedFields} onDone={() => { setShowSuccess(false); window.location.reload(); }} />}

      <Toast toasts={toasts} removeToast={removeToast} />

      {/* Page */}
      <div style={{
        minHeight: "100vh", background: "#ffffff",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "2rem 1rem",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        backgroundImage: "radial-gradient(circle at 20% 20%, rgba(98,101,244,0.04) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(98,101,244,0.03) 0%, transparent 50%)",
      }}>
        <div style={{ width: "100%", maxWidth: "440px" }}>

          {/* Card */}
          <div style={{
            background: "#ffffff",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: "1.25rem",
            boxShadow: "0 8px 32px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)",
            overflow: "hidden",
          }}>

            <div style={{ padding: "2.25rem 2rem 2.5rem" }}>

              {/* Header */}
              <div className="ep-fade" style={{ textAlign: "center", marginBottom: "2rem" }}>
                <Avatar username={formData.username} loading={fieldLoading} />
                <h2 style={{ fontFamily: "'Inter', sans-serif", fontSize: "1.25rem", fontWeight: 700, color: "#111827", letterSpacing: "-0.01em", margin: 0 }}>
                  Edit Profile
                </h2>
                <p style={{ fontFamily: "'Inter', sans-serif", fontSize: "0.875rem", color: "#6b7280", marginTop: "0.25rem" }}>
                  Update your account details
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSave} noValidate style={{ display: "flex", flexDirection: "column", gap: "1.125rem" }}>

                <div className="ep-fade ep-s1">
                  {fieldLoading ? <Skeleton /> : (
                    <Field label="Username" name="username" type="text" value={formData.username}
                      onChange={handleChange} onBlur={handleBlur}
                      placeholder="your_username" required autoComplete="username"
                      error={touched.username && errors.username}
                      success={touched.username && !errors.username && formData.username}
                    />
                  )}
                </div>

                <div className="ep-fade ep-s2">
                  {fieldLoading ? <Skeleton /> : (
                    <Field label="Email Address" name="email" type="email" value={formData.email}
                      onChange={handleChange} onBlur={handleBlur}
                      placeholder="you@example.com" required autoComplete="email"
                      error={touched.email && errors.email}
                      success={touched.email && !errors.email && formData.email}
                    />
                  )}
                </div>

                <div className="ep-fade ep-s3">
                  <Divider label="Change Password" />
                </div>

                <div className="ep-fade ep-s4">
                  <Field label="New Password" name="newPassword" type="password" value={formData.newPassword}
                    onChange={handleChange} onBlur={handleBlur}
                    placeholder="Leave blank to keep current" autoComplete="new-password"
                    error={touched.newPassword && errors.newPassword}
                    success={touched.newPassword && !errors.newPassword && formData.newPassword.length >= 8}
                  />
                  <PasswordStrength password={formData.newPassword} />
                </div>

                <div className="ep-fade ep-s5">
                  <Field label="Confirm Password" name="confirmPassword" type="password" value={formData.confirmPassword}
                    onChange={handleChange} onBlur={handleBlur}
                    placeholder="Repeat new password" autoComplete="new-password"
                    error={touched.confirmPassword && errors.confirmPassword}
                    success={touched.confirmPassword && !errors.confirmPassword && formData.confirmPassword && formData.newPassword === formData.confirmPassword}
                  />
                </div>

                <div className="ep-fade ep-s6" style={{ paddingTop: "0.375rem" }}>
                  <button
                    type="submit"
                    disabled={saving || loading}
                    className="ep-save-btn"
                    style={{
                      width: "100%", position: "relative",
                      padding: "0.75rem 1.5rem",
                      borderRadius: "0.5rem", border: "none",
                      fontFamily: "'Inter', sans-serif", fontSize: "0.9375rem", fontWeight: 600,
                      color: "#ffffff", cursor: "pointer",
                      background: "#6265f4",
                      boxShadow: "0 4px 16px rgba(98,101,244,0.3)",
                      transition: "background 0.2s, box-shadow 0.2s, transform 0.15s",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
                    }}
                  >
                    Save Changes
                  </button>
                </div>

              </form>
            </div>
          </div>

          <p style={{ textAlign: "center", fontFamily: "'Inter', sans-serif", fontSize: "0.8125rem", color: "#9ca3af", marginTop: "1rem" }}>
            Changes are applied to your account immediately.
          </p>
        </div>
      </div>
    </>
  );
};

export default EditProfile;
