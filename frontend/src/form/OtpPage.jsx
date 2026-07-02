/**
 * OtpPage.jsx
 * OTP verification screen — supports both registration
 * verification and password-reset flows.
 */
import React, { useState, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getCookie, setCookie } from "../utils/cookieUtils";

export default function OtpPage() {
  /* ── State ─────────────────────────────────── */
  const [otpValues, setOtpValues] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" }); // type: 'error' | 'success'
  const inputRefs = useRef([]);
  const location = useLocation();
  const navigate = useNavigate();

  const email = location.state?.email;
  const isPasswordReset = location.state?.isPasswordReset || false;

  // Redirect to login if no email passed, or home if already logged in
  React.useEffect(() => {
    const token = getCookie("token");
    if (token) {
      navigate("/home", { replace: true });
      return;
    }
    if (!email) {
      navigate("/", { replace: true });
    }
  }, [email, navigate]);

  /* ── Input Handlers ────────────────────────── */
  const handleOtpChange = (index, value) => {
    setMessage({ text: "", type: "" }); // clear messages on typing
    // Only allow numbers
    const cleanValue = value.replace(/[^0-9]/g, "");
    
    if (cleanValue.length > 1) {
      // Handle paste
      const pastedData = cleanValue.slice(0, 6).split("");
      const newOtp = [...otpValues];
      pastedData.forEach((char, i) => {
        if (index + i < 6) newOtp[index + i] = char;
      });
      setOtpValues(newOtp);
      
      // Focus appropriate input
      const lastFilledIndex = Math.min(index + pastedData.length, 5);
      inputRefs.current[lastFilledIndex]?.focus();
      return;
    }

    const newOtp = [...otpValues];
    newOtp[index] = cleanValue;
    setOtpValues(newOtp);

    // Move to next input if value is entered
    if (cleanValue && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otpValues[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  /* ── Submit OTP ────────────────────────────── */
  const handleSubmit = async (e) => {
    e.preventDefault();
    const currentOtp = otpValues.join("");
    if (currentOtp.length < 6) {
      setMessage({ text: "Please enter the complete 6-digit OTP", type: "error" });
      return;
    }

    setLoading(true);
    setMessage({ text: "", type: "" });
    try {
      const res = await fetch(`${process.env.REACT_APP_API_BASE_URL}/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: currentOtp, isPasswordReset }),
      });

      if (res.ok) {
        const data = await res.json();
        
        // Show success animation
        setIsVerified(true);
        
        setTimeout(() => {
          if (isPasswordReset) {
            navigate("/", { replace: true });
          } else {
            if (data.token) setCookie("token", data.token, 7);
            navigate("/home", { replace: true });
          }
        }, 2000);
      } else {
        const err = await res.json();
        setMessage({ text: err.error || "Verification failed.", type: "error" });
        setOtpValues(["", "", "", "", "", ""]); // Optional: clear inputs on fail
        inputRefs.current[0]?.focus();
      }
    } catch {
      setMessage({ text: "Something went wrong during verification!", type: "error" });
    }
    setLoading(false);
  };

  /* ── Resend OTP ────────────────────────────── */
  const handleResend = async () => {
    setMessage({ text: "", type: "" });
    try {
      const res = await fetch(`${process.env.REACT_APP_API_BASE_URL}/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setMessage({ text: data.message || "OTP resent successfully!", type: "success" });
    } catch {
      setMessage({ text: "Failed to resend OTP.", type: "error" });
    }
  };

  /* ── Render ────────────────────────────────── */
  return (
    <div className="otp-container">
      <form onSubmit={handleSubmit} className="otp-card">
        {isVerified ? (
          <div className="verified-container">
            <div className="tick-mark">✓</div>
            <div className="verified-text">OTP Verified</div>
          </div>
        ) : (
          <>
            <div className="auth-logo-icon">🔐</div>
            <h2 className="otp-title">Verify Your Identity</h2>
            <p className="otp-subtitle">
              We've sent a verification code to:<br />
              <span className="otp-email">{email}</span>
            </p>

            {message.text && (
              <div className={`auth-message ${message.type}`}>
                {message.text}
              </div>
            )}

            <div className="otp-inputs-container">
              {otpValues.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className={`otp-box ${digit ? 'filled' : ''}`}
                  maxLength={6} // to allow pasting multiple digits in one go
                  required
                />
              ))}
            </div>

            <button type="submit" className="auth-submit-btn" disabled={loading || otpValues.join("").length < 6}>
              {loading ? "Verifying..." : "Verify Code"}
            </button>

            <p className="otp-resend-prompt">
              Didn't receive the code?{" "}
              <button type="button" onClick={handleResend} className="otp-resend-link">Resend</button>
            </p>
          </>
        )}
      </form>
    </div>
  );
}