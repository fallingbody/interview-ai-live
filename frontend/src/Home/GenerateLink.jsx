/**
 * GenerateLink.jsx
 * Three-step wizard to create an interview campaign:
 *   Step 1 — Upload CSV & validate emails
 *   Step 2 — Fill campaign details (job title, type, etc.)
 *   Step 3 — Success + send invite emails
 */
import React, { useState } from "react";
import Papa from "papaparse";
import "./generatelink.css";
import { getCookie } from "../utils/cookieUtils";
import { CampaignCreatingLoader, CampaignReviewModal, EmailValidationLoader, InviteSendingLoader } from "../loaders";

/* ── Helpers ──────────────────────────────────── */

/** Basic RFC-style email validation */
const isValidEmail = (email) => {
  const value = String(email || "").trim().toLowerCase();
  // Sensible Format Check: One @, at least one . after @, no spaces, no double dots
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return false;
  if (value.includes("..")) return false;
  return true;
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* ═══════════════════════════════════════════════
   Step Sub-Components
   ═══════════════════════════════════════════════ */

/** Step 1 — CSV upload, local parse preview, server validation */
const StepUploadCSV = ({
  interviewDate, setInterviewDate,
  startTime, setStartTime,
  allEmails, validEmails, invalidEmails, fileName,
  handleFileChange, handleRemoveInvalid,
  handleUploadToBackend, isLoading, error,
}) => {
  const handleDownloadSample = () => {
    const csvContent = "Sr No.,Name,Email,Phone,City,Gender,Experience_Years\n1,Aarav Sharma,aarav.sharma@example.com,9876543210,Mumbai,Male,3\n2,Rohan Gupta,rohan.g@company.in,7654321098,Delhi,Male,5";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'sample_candidates.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      {/* Date, time & file inputs */}
      <div className="form-fields-container">
        <div className="form-field">
          <label className="field-label">Interview Date</label>
          <input type="date" value={interviewDate} onChange={(e) => setInterviewDate(e.target.value)} className="date-input" />
        </div>
        <div className="form-field">
          <label className="field-label">Start Time</label>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="time-input" />
        </div>
        <div className="form-field">
          <label className="field-label">Upload Candidate CSV</label>
          <input type="file" accept=".csv" onChange={handleFileChange} />
          <p className="csv-hint" style={{ marginBottom: "8px" }}>CSV must have an "email" column</p>

          {/* Sleek, premium Sample CSV preview box */}
          <div className="sample-csv-container" style={{
            padding: "10px 14px",
            background: "rgba(98, 101, 244, 0.05)",
            border: "1px dashed rgba(98, 101, 244, 0.3)",
            borderRadius: "8px",
            fontSize: "0.82rem",
            color: "#4b5563"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 600, color: "#6265f4", marginBottom: "6px", fontSize: "0.85rem" }}>
              <span>Sample CSV Format:</span>
              <button type="button" onClick={handleDownloadSample} style={{ background: "none", border: "none", color: "#6265f4", cursor: "pointer", textDecoration: "underline", fontSize: "0.78rem", padding: 0 }}>Download Sample</button>
            </div>
            <code style={{ display: "block", fontFamily: "monospace", color: "#1f2937", background: "white", padding: "6px 10px", borderRadius: "4px", border: "1px solid #e5e7eb", lineHeight: "1.4", overflowX: "auto" }}>
              Sr No.,Name,Email,Phone,City,Gender,Experience_Years<br />
              1,Aarav Sharma,aarav.sharma@example.com,9876543210,Mumbai,Male,3<br />
              2,Rohan Gupta,rohan.g@company.in,7654321098,Delhi,Male,5
            </code>
          </div>
        </div>
      </div>

      {/* Local parse summary */}
      {allEmails.length > 0 && (
        <div className="csv-summary">
          <div className="csv-summary-row"><span className="summary-label">File:</span><span className="summary-value">{fileName}</span></div>
          <div className="csv-summary-row"><span className="summary-label">Total rows:</span><span className="summary-value">{allEmails.length}</span></div>
          <div className="csv-summary-row"><span className="summary-label">Valid:</span><span className="summary-value valid-count">{validEmails.length}</span></div>
          <div className="csv-summary-row"><span className="summary-label">Invalid:</span><span className="summary-value invalid-count">{invalidEmails.length}</span></div>
          {invalidEmails.length > 0 && (
            <button className="remove-invalid-btn" onClick={handleRemoveInvalid}>
              Remove {invalidEmails.length} invalid — continue with {validEmails.length} valid
            </button>
          )}
        </div>
      )}

      {/* Email preview table */}
      {allEmails.length > 0 && (
        <div className="data-preview-container">
          <div className="data-preview-header">
            <span>Email Preview</span>
            <span className="data-count">{allEmails.length} entries</span>
          </div>
          <div className="data-table-wrapper">
            <table className="data-table">
              <thead><tr><th>#</th><th>Email</th><th>Status</th></tr></thead>
              <tbody>
                {allEmails.map((row) => (
                  <tr key={row.id} className={row.isValid ? "" : "invalid-row"}>
                    <td>{row.id}</td>
                    <td>{row.email}</td>
                    <td>
                      <span className={
                        row.isChecking ? "badge-checking" : (row.isValid ? "badge-valid" : "badge-invalid")
                      }>
                        {row.isChecking ? "Verifying..." : (row.isValid ? "Valid" : "Invalid")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {error && <p className="error-message">{error}</p>}

      <button onClick={handleUploadToBackend} className="campaign-primary-btn" disabled={isLoading || validEmails.length === 0}>
        {isLoading ? "Validating with server..." : `Validate & Continue (${validEmails.length} emails)`}
      </button>
    </>
  );
};

/** Step 2 — Campaign details form */
const StepCampaignForm = ({
  backendPreview,
  jobTitle, setJobTitle,
  jobDescription, setJobDescription,
  interviewType, setInterviewType,
  experienceLevel, setExperienceLevel,
  passThreshold, setPassThreshold,
  handleCreateCampaign, isLoading, error,
  campaignLoader, onCampaignLoaderDone,
  onBack,
}) => (
  <>
    {campaignLoader?.show && (
      <CampaignCreatingLoader
        status={campaignLoader.status}
        message={campaignLoader.message}
        onDone={onCampaignLoaderDone}
      />
    )}
    {/* Server validation banner */}
    <div className="csv-summary" style={{ marginBottom: "1.25rem" }}>
      <p style={{ fontWeight: 600, margin: 0, color: "#111827" }}>
        <span>Server Validated: </span>
        <span style={{ color: "#059669" }}>{backendPreview.valid} Unique Emails Ready</span>
        {backendPreview.duplicates > 0 && (
          <span style={{ color: "#D97706" }}> · {backendPreview.duplicates} Duplicates Removed</span>
        )}
        {backendPreview.invalidCount > 0 && (
          <span style={{ color: "#DC2626" }}> · {backendPreview.invalidCount} Invalid Ignored</span>
        )}
      </p>
    </div>

    {/* Form fields */}
    <div className="form-fields-container">
      <div className="form-field">
        <label className="field-label">Job Title *</label>
        <input type="text" placeholder="e.g. Backend Developer" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="date-input" />
      </div>
      <div className="form-field">
        <label className="field-label">Job Description</label>
        <textarea placeholder="Describe the role (optional)" value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} className="date-input" rows={3} style={{ resize: "vertical", fontFamily: "inherit" }} />
      </div>
      <div className="form-field">
        <label className="field-label">Interview Type *</label>
        <select value={interviewType} onChange={(e) => setInterviewType(e.target.value)} className="date-input">
          <option value="Technical">Technical</option>
          <option value="HR">HR</option>
          <option value="Mixed">Mixed</option>
        </select>
      </div>
      <div className="form-field">
        <label className="field-label">Experience Level *</label>
        <select value={experienceLevel} onChange={(e) => setExperienceLevel(e.target.value)} className="date-input">
          <option value="Fresher">Fresher</option>
          <option value="1-3yrs">1–3 years</option>
          <option value="3-5yrs">3–5 years</option>
          <option value="5+yrs">5+ years</option>
        </select>
      </div>
      <div className="form-field">
        <div className="threshold-header">
          <label className="field-label">Pass Threshold</label>
          <span className="threshold-badge" style={{ background: passThreshold <= 40 ? "rgba(16, 185, 129, 0.1)" : (passThreshold <= 75 ? "rgba(245, 158, 11, 0.1)" : "rgba(239, 68, 68, 0.1)"), color: passThreshold <= 40 ? "#10b981" : (passThreshold <= 75 ? "#f59e0b" : "#ef4444"), borderColor: passThreshold <= 40 ? "rgba(16, 185, 129, 0.3)" : (passThreshold <= 75 ? "rgba(245, 158, 11, 0.3)" : "rgba(239, 68, 68, 0.3)") }}>
            {passThreshold}% ({passThreshold <= 40 ? "Easy" : (passThreshold <= 75 ? "Medium" : "Strict")})
          </span>
        </div>
        <div className="threshold-track-wrapper">
          <input
            type="range"
            min={0}
            max={100}
            value={passThreshold}
            onChange={(e) => setPassThreshold(e.target.value)}
            className="threshold-slider"
            style={{
              background: `linear-gradient(to right, #6265f4 0%, #6265f4 ${passThreshold}%, #e5e7eb ${passThreshold}%, #e5e7eb 100%)`
            }}
          />
        </div>
        <div className="threshold-labels-row" style={{ display: "flex", justifyContent: "space-between", fontSize: "0.82rem", marginTop: "8px", fontWeight: 600 }}>
          <span style={{ color: "#10b981", display: "flex", alignItems: "center", gap: "4px" }}>🟢 Easy (0% - 40%)</span>
          <span style={{ color: "#f59e0b", display: "flex", alignItems: "center", gap: "4px" }}>🟡 Medium (41% - 75%)</span>
          <span style={{ color: "#ef4444", display: "flex", alignItems: "center", gap: "4px" }}>🔴 Strict (76% - 100%)</span>
        </div>
      </div>
    </div>

    {error && <p className="error-message">{error}</p>}

    {/* Navigation buttons */}
    <div style={{ marginTop: "1.25rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      <button onClick={onBack} className="campaign-secondary-btn">
        ← Back
      </button>
      <button onClick={handleCreateCampaign} className="campaign-primary-btn" disabled={isLoading}>
        {isLoading ? "Creating Campaign..." : `Launch Campaign (${backendPreview.valid} candidates)`}
      </button>
    </div>
  </>
);

/** Step 3 — Success: share link + send invite emails */
const StepSuccess = ({
  generatedLink, handleCopy,
  handleSendInviteEmails, isSendingInvites,
  inviteSummary, handleRetryFailedInvites, isRetryingInvites,
  handleReset, error,
  validCount, interviewDate, startTime,
  showInviteReview, setShowInviteReview,
  jobTitle, jobDescription, interviewType, experienceLevel, passThreshold,
  sessionId, backendPreview,
}) => {
  const [copiedGroup, setCopiedGroup] = React.useState(null);

  // Precalculate the group schedules for the UI based on valid count
  const batchSize = 50;
  const numBatches = Math.max(1, Math.ceil((validCount || 0) / batchSize));
  const baseStart = new Date(`${interviewDate}T${startTime}`);

  const precalculatedGroups = [];
  for (let i = 0; i < numBatches; i++) {
    const groupCode = String.fromCharCode(65 + i);
    const count = i === numBatches - 1 ? (validCount || 0) - (i * batchSize) : batchSize;
    const groupTime = new Date(baseStart.getTime() + i * 60 * 60 * 1000);
    precalculatedGroups.push({
      groupCode,
      count,
      time: groupTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  }

  return (
    <>
      {/* Success banner */}
      <div className="csv-summary" style={{ textAlign: "center", marginBottom: "0" }}>
        <p style={{ fontWeight: 700, fontSize: "1.05rem", margin: 0, color: "#059669" }}>
          Campaign created !
        </p>
      </div>

      {/* Group Schedules Table in the big block */}
      <div className="generated-link-container" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ border: "1px solid #e5e7eb", borderRadius: "8px", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem", textAlign: "left" }}>
            <thead style={{ backgroundColor: "#f9fafb" }}>
              <tr>
                <th style={{ padding: "10px 16px", borderBottom: "1px solid #e5e7eb", color: "#374151", fontWeight: 600 }}>Group</th>
                <th style={{ padding: "10px 16px", borderBottom: "1px solid #e5e7eb", color: "#374151", fontWeight: 600 }}>Candidates</th>
                <th style={{ padding: "10px 16px", borderBottom: "1px solid #e5e7eb", color: "#374151", fontWeight: 600 }}>Start Time</th>
                <th style={{ padding: "10px 16px", borderBottom: "1px solid #e5e7eb", color: "#374151", fontWeight: 600 }}>Session Link</th>
              </tr>
            </thead>
            <tbody>
              {precalculatedGroups.map((group, idx) => (
                <tr key={idx} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "10px 16px", fontWeight: 600, color: "#4b5563" }}>{group.groupCode}</td>
                  <td style={{ padding: "10px 16px", color: "#4b5563" }}>{group.count}</td>
                  <td style={{ padding: "10px 16px", color: "#4b5563" }}>{group.time}</td>
                  <td style={{ padding: "10px 16px" }}>
                    <button onClick={() => {
                      navigator.clipboard.writeText(generatedLink);
                      setCopiedGroup(group.groupCode);
                      setTimeout(() => setCopiedGroup(null), 1800);
                    }} style={{ background: "none", border: "none", color: copiedGroup === group.groupCode ? "#059669" : "#6265f4", cursor: "pointer", fontWeight: 500, padding: 0 }}>
                      {copiedGroup === group.groupCode ? "Copied" : "Copy Link"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={() => setShowInviteReview(true)} className="campaign-primary-btn" disabled={isSendingInvites}>
          Send Session Link To All Candidates
        </button>
      </div>

      <CampaignReviewModal
        isOpen={showInviteReview}
        onBack={() => setShowInviteReview(false)}
        onConfirm={() => {
          setShowInviteReview(false);
          handleSendInviteEmails();
        }}
        jobTitle={jobTitle}
        jobDescription={jobDescription}
        interviewType={interviewType}
        experienceLevel={experienceLevel}
        passThreshold={passThreshold}
        interviewDate={interviewDate}
        startTime={startTime}
        backendPreview={backendPreview}
        generatedLink={generatedLink}
        sessionId={sessionId}
      />

      {/* Invite summary (after sending) */}
      {inviteSummary && (
        <div className="csv-summary" style={{ marginTop: "12px" }}>
          <p style={{ margin: 0, fontWeight: 600 }}>
            <span>Invite summary: </span>
            <span style={{ color: "#059669" }}>Sent {inviteSummary.invitedCount}</span>
            <span> · </span>
            <span style={{ color: "#DC2626" }}>Failed {inviteSummary.failedCount}</span>
          </p>
          {inviteSummary.failedEmails.length > 0 && (
            <>
              <p style={{ margin: "8px 0 0 0", color: "#c0392b" }}>
                Failed emails: {inviteSummary.failedEmails.join(", ")}
              </p>
              <button onClick={handleRetryFailedInvites} className="campaign-secondary-btn" style={{ marginTop: "12px", width: "100%" }} disabled={isRetryingInvites}>
                {isRetryingInvites ? "Retrying Failed Invites..." : `Retry Failed Invites (${inviteSummary.failedEmails.length})`}
              </button>
            </>
          )}
        </div>
      )}



      {error && <p className="error-message">{error}</p>}

      <button onClick={handleReset} className="campaign-primary-btn" style={{ marginTop: "16px" }}>
        Create Another Campaign
      </button>
    </>
  )
};

/* ═══════════════════════════════════════════════
   Main GenerateLink Component
   ═══════════════════════════════════════════════ */

const GenerateLink = ({ interviewDate, setInterviewDate, startTime, setStartTime }) => {
  /* ── CSV state ─────────────────────────────────── */
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileName, setFileName] = useState("");
  const [allEmails, setAllEmails] = useState([]);

  /* ── Campaign form state ───────────────────────── */
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [interviewType, setInterviewType] = useState("Mixed");
  const [experienceLevel, setExperienceLevel] = useState("Fresher");
  const [passThreshold, setPassThreshold] = useState(65);

  /* ── Wizard / UI state ─────────────────────────── */
  const [step, setStep] = useState(1);
  const [backendPreview, setBackendPreview] = useState(null);
  const [generatedLink, setGeneratedLink] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingInvites, setIsSendingInvites] = useState(false);
  const [isRetryingInvites, setIsRetryingInvites] = useState(false);
  const [inviteSummary, setInviteSummary] = useState(null);
  const [error, setError] = useState(null);
  const [showCopiedToast, setShowCopiedToast] = useState(false);
  const [showInviteReview, setShowInviteReview] = useState(false);
  const [inviteLoader, setInviteLoader] = useState({
    show: false,
    sending: false,
    status: "success",
    sent: 0,
    failed: 0,
    message: "",
  });
  const [validationLoader, setValidationLoader] = useState({
    show: false,
    status: "success",
    unique: 0,
    duplicates: 0,
    invalid: 0,
    message: "",
  });
  const [campaignLoader, setCampaignLoader] = useState({
    show: false,
    status: "loading",
    message: "",
  });

  const BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://localhost:8000/api";
  const validEmails = allEmails.filter((e) => e.isValid);
  const invalidEmails = allEmails.filter((e) => !e.isValid);

  /* ── Handlers ──────────────────────────────────── */

  /** Parse the uploaded CSV locally for instant preview */
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSelectedFile(file);
    setFileName(file.name);
    setAllEmails([]);
    setBackendPreview(null);
    setError(null);
    setGeneratedLink("");
    setSessionId("");
    setInviteSummary(null);
    setCampaignLoader({ show: false, status: "loading", message: "" });
    setStep(1);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data;
        if (!rows.length) { setError("CSV file is empty."); return; }

        const emailKey = Object.keys(rows[0]).find((k) => k.toLowerCase().includes("email"));
        if (!emailKey) { setError("No 'email' column found in the CSV."); return; }

        const initialEmails = rows.map((row, i) => {
          const email = String(row[emailKey] || "").trim();
          return { id: i + 1, email, isValid: isValidEmail(email), isChecking: true };
        });
        setAllEmails(initialEmails);

        // Deep Validate Existence via Server
        try {
          const token = getCookie("token");
          const res = await fetch(`${BASE_URL}/campaign/validate-emails`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ emails: initialEmails.map(e => e.email) }),
          });
          const data = await res.json();
          if (res.ok && data.results) {
            setAllEmails(prev => prev.map(e => {
              const result = data.results.find(r => r.email.toLowerCase() === e.email.toLowerCase());
              return { ...e, isValid: result ? result.isValid : e.isValid, isChecking: false };
            }));
          } else {
            // Server responded but returned an error — fall back to local validation
            setAllEmails(prev => prev.map(e => ({ ...e, isChecking: false })));
            if (res.status === 401) setError("Session expired. Please log in again.");
          }
        } catch (err) {
          // Network error — backend unreachable, keep local validation results
          setAllEmails(prev => prev.map(e => ({ ...e, isChecking: false })));
          if (err.message === "Failed to fetch") {
            setError("⚠️ Cannot reach the server. Make sure the backend is running on port 8000. Your emails have been validated locally — you can still continue.");
          }
        }
      },
      error: () => setError("Could not read the file. Please upload a valid CSV."),
    });
  };

  /** Remove rows flagged as invalid */
  const handleRemoveInvalid = () => setAllEmails((prev) => prev.filter((e) => e.isValid));

  /** POST CSV to backend for server-side validation */
  const handleUploadToBackend = async () => {
    if (!selectedFile || validEmails.length === 0) { setError("No valid emails to upload."); return; }

    setIsLoading(true);
    setError(null);
    const token = getCookie("token");

    try {
      const fd = new FormData();
      fd.append("csvFile", selectedFile);

      const res = await fetch(`${BASE_URL}/campaign/upload-csv`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();

      if (res.status === 401) throw new Error("Session expired. Please log in again.");
      if (!res.ok || !data.success) throw new Error(data.message || "CSV validation failed.");

      setValidationLoader({
        show: true,
        status: "success",
        unique: data.valid || data.emails?.length || validEmails.length,
        duplicates: data.duplicates || 0,
        invalid: data.invalidCount || 0,
        message: "",
      });
      setBackendPreview(data);
    } catch (err) {
      setValidationLoader({
        show: true,
        status: "error",
        unique: 0,
        duplicates: 0,
        invalid: 0,
        message: err.message === "Failed to fetch"
          ? "Cannot connect to the backend server (port 8000). Please ensure the backend is running and try again."
          : err.message,
      });
      if (err.message === "Failed to fetch") {
        setError("❌ Cannot connect to the backend server (port 8000). Please ensure the backend is running and try again.");
      } else {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidationLoaderDone = () => {
    const shouldAdvance = validationLoader.status !== "error";
    setValidationLoader((prev) => ({ ...prev, show: false }));
    if (shouldAdvance) setStep(2);
  };

  /** POST campaign details to create the campaign */
  const handleCreateCampaign = async () => {
    if (!interviewDate || !startTime) { setError("Please fill in the interview date and time."); return; }
    if (!jobTitle.trim()) { setError("Please enter a job title."); return; }
    if (!backendPreview?.emails?.length) { setError("No validated emails. Please re-upload the CSV."); return; }

    setIsLoading(true);
    setCampaignLoader({ show: true, status: "loading", message: "" });
    setError(null);
    const minimumLoaderTime = wait(3000);
    const token = getCookie("token");
    const userId = getCookie("userId");

    try {
      const res = await fetch(`${BASE_URL}/campaign/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          jobTitle: jobTitle.trim(),
          jobDescription: jobDescription.trim(),
          interviewType,
          experienceLevel,
          passThreshold: Number(passThreshold),
          candidateEmails: backendPreview.emails,
          createdBy: userId,
          interviewDate,
          startTime,
        }),
      });
      const data = await res.json();

      if (res.status === 401) throw new Error("Session expired. Please log in again.");
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to create campaign.");

      // Build shareable link
      const userBase = (process.env.REACT_APP_USER_URL || "").replace(/\/+$/, "");
      const id = data.sessionId || data.campaignId;
      const link = /\/interviewcheck$/i.test(userBase) ? `${userBase}/${id}` : `${userBase}/interviewcheck/${id}`;

      setGeneratedLink(link);
      setSessionId(String(data.sessionId || ""));
      localStorage.setItem("sessionId", String(data.sessionId || ""));
      setInviteSummary(null);
      await minimumLoaderTime;
      setCampaignLoader({ show: false, status: "loading", message: "" });
      setStep(3);
    } catch (err) {
      await minimumLoaderTime;
      setError(err.message);
      setCampaignLoader({
        show: true,
        status: "error",
        message: err.message || "Something went wrong while creating the campaign.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  /** Copy the generated link to clipboard */
  const handleCopy = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      setShowCopiedToast(true);
      setTimeout(() => setShowCopiedToast(false), 2500);
    }
  };

  /** Reset the wizard to step 1 */
  const handleReset = () => {
    setSelectedFile(null); setFileName(""); setAllEmails([]);
    setBackendPreview(null); setGeneratedLink(""); setSessionId("");
    setInviteSummary(null); setError(null); setShowInviteReview(false);
    setCampaignLoader({ show: false, status: "loading", message: "" });
    setInviteLoader({ show: false, sending: false, status: "success", sent: 0, failed: 0, message: "" });
    setValidationLoader({ show: false, status: "success", unique: 0, duplicates: 0, invalid: 0, message: "" });
    setJobTitle(""); setJobDescription("");
    setInterviewType("Mixed"); setExperienceLevel("Fresher"); setPassThreshold(65);
    setStep(1);
  };

  /** Send invite emails to all validated candidates */
  const handleSendInviteEmails = async () => {
    if (!sessionId) { setError("Session ID missing."); return; }
    const token = getCookie("token");
    if (!token) { setError("Session expired."); return; }

    setIsSendingInvites(true);
    setInviteLoader({ show: true, sending: true, status: "success", sent: 0, failed: 0, message: "" });
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/campaign/${sessionId}/send-invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionLink: generatedLink, jobTitle: jobTitle.trim() }),
      });
      const data = await res.json();
      if (res.status === 401) throw new Error("Session expired.");
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to send invites.");

      const nextSummary = {
        invitedCount: data.invitedCount || 0,
        failedCount: data.failedCount || 0,
        failedEmails: data.failedEmails || [],
        generatedLinks: data.generatedLinks || []
      };
      const totalInvites = nextSummary.invitedCount + nextSummary.failedCount;
      const inviteStatus = nextSummary.failedCount === 0
        ? "success"
        : (nextSummary.invitedCount === 0 || nextSummary.failedCount === totalInvites ? "error" : "partial");
      setInviteSummary(nextSummary);
      setInviteLoader({
        show: true,
        sending: false,
        status: inviteStatus,
        sent: nextSummary.invitedCount,
        failed: nextSummary.failedCount,
        message: inviteStatus === "partial"
          ? "Some session links could not be sent."
          : (inviteStatus === "error" ? "No session links could be sent." : ""),
      });
    } catch (err) {
      setInviteLoader({
        show: true,
        sending: false,
        status: "error",
        sent: 0,
        failed: validEmails.length || backendPreview?.valid || 0,
        message: err.message || "Failed to send session links.",
      });
      setError(err.message);
    } finally {
      setIsSendingInvites(false);
    }
  };

  const handleInviteLoaderDone = () => {
    setInviteLoader((prev) => ({ ...prev, show: false }));
  };

  const handleCampaignLoaderDone = () => {
    setCampaignLoader((prev) => ({ ...prev, show: false }));
  };

  /** Retry sending to previously failed emails */
  const handleRetryFailedInvites = async () => {
    if (!sessionId || !inviteSummary?.failedEmails?.length) return;
    const token = getCookie("token");
    if (!token) { setError("Session expired."); return; }

    setIsRetryingInvites(true);
    setError(null);
    try {
      const res = await fetch(`${BASE_URL}/campaign/${sessionId}/retry-failed-invites`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionLink: generatedLink, jobTitle: jobTitle.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Retry failed.");

      setInviteSummary({
        invitedCount: data.invitedCount || 0,
        failedCount: data.failedCount || 0,
        failedEmails: data.failedEmails || [],
        generatedLinks: data.generatedLinks || []
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsRetryingInvites(false);
    }
  };

  /* ── Render ───────────────────────────────────── */
  return (
    <div className="generate-link-wrapper">
      {validationLoader.show && (
        <EmailValidationLoader
          isVisible={validationLoader.show}
          status={validationLoader.status}
          unique={validationLoader.unique}
          duplicates={validationLoader.duplicates}
          invalid={validationLoader.invalid}
          errorMessage={validationLoader.message}
          onDone={handleValidationLoaderDone}
        />
      )}
      <InviteSendingLoader
        isVisible={inviteLoader.show}
        isSending={inviteLoader.sending}
        status={inviteLoader.status}
        sent={inviteLoader.sent}
        failed={inviteLoader.failed}
        errorMessage={inviteLoader.message}
        onDone={handleInviteLoaderDone}
      />

      {/* Toast notification */}
      {showCopiedToast && (
        <div className="gl-toast">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          Link copied to clipboard!
        </div>
      )}
      <h1 className="generate-link-title">Generate Interview Link</h1>

      {/* Step indicator dots */}
      <div className="step-indicator">
        <div className={`step-dot ${step >= 1 ? "step-active" : ""}`}>1</div>
        <div className={`step-line ${step >= 2 ? "step-line-active" : ""}`} />
        <div className={`step-dot ${step >= 2 ? "step-active" : ""}`}>2</div>
        <div className={`step-line ${step >= 3 ? "step-line-active" : ""}`} />
        <div className={`step-dot ${step >= 3 ? "step-active" : ""}`}>3</div>
      </div>
      <div className="step-labels">
        <span>Upload CSV</span><span>Campaign Details</span><span>Done</span>
      </div>

      {/* Render current step */}
      {step === 1 && (
        <StepUploadCSV
          interviewDate={interviewDate} setInterviewDate={setInterviewDate}
          startTime={startTime} setStartTime={setStartTime}
          allEmails={allEmails} validEmails={validEmails} invalidEmails={invalidEmails}
          fileName={fileName} handleFileChange={handleFileChange}
          handleRemoveInvalid={handleRemoveInvalid}
          handleUploadToBackend={handleUploadToBackend}
          isLoading={isLoading} error={error}
        />
      )}

      {step === 2 && backendPreview && (
        <StepCampaignForm
          backendPreview={backendPreview}
          jobTitle={jobTitle} setJobTitle={setJobTitle}
          jobDescription={jobDescription} setJobDescription={setJobDescription}
          interviewType={interviewType} setInterviewType={setInterviewType}
          experienceLevel={experienceLevel} setExperienceLevel={setExperienceLevel}
          passThreshold={passThreshold} setPassThreshold={setPassThreshold}
          handleCreateCampaign={handleCreateCampaign}
          isLoading={isLoading} error={error}
          campaignLoader={campaignLoader}
          onCampaignLoaderDone={handleCampaignLoaderDone}
          onBack={() => { setStep(1); setError(null); }}
        />
      )}

      {step === 3 && (
        <StepSuccess
          generatedLink={generatedLink} handleCopy={handleCopy}
          handleSendInviteEmails={handleSendInviteEmails} isSendingInvites={isSendingInvites}
          inviteSummary={inviteSummary}
          handleRetryFailedInvites={handleRetryFailedInvites} isRetryingInvites={isRetryingInvites}
          handleReset={handleReset} error={error}
          validCount={backendPreview?.valid || 0}
          interviewDate={interviewDate}
          startTime={startTime}
          showInviteReview={showInviteReview}
          setShowInviteReview={setShowInviteReview}
          jobTitle={jobTitle}
          jobDescription={jobDescription}
          interviewType={interviewType}
          experienceLevel={experienceLevel}
          passThreshold={passThreshold}
          sessionId={sessionId}
          backendPreview={backendPreview}
        />
      )}
    </div>
  );
};

export default GenerateLink;
