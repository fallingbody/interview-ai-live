/**
 * CandidateOverview.jsx
 * Campaign-first candidate management view.
 * Left rail: campaign list.  Right: session workspace
 * with candidate cards, detail panel, and outcome modal.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import "./CandidateOverview.css";
import { getCookie } from "../utils/cookieUtils";

/* ── Constants ───────────────────────────────── */
const STATUS_OPTIONS = [
  { key: "all",      label: "All" },
  { key: "selected", label: "Selected" },
  { key: "rejected", label: "Rejected" },
  { key: "pending",  label: "Pending" },
];

const SORT_OPTIONS = [
  { key: "highest_score", label: "Highest score" },
  { key: "earliest_interview", label: "Earliest interview" },
  { key: "latest_interview", label: "Latest interview" },
  { key: "score_shortlist", label: "Score shortlist" },
];

const DEFAULT_SELECTED_TEMPLATE =
  "Dear {{name}},\n\nCongratulations! We are pleased to inform you that you have been selected for the {{role}} position at {{companyName}}.\n\nWe will be in touch with next steps shortly.\n\nBest regards,\n{{recruiterName}}\n{{companyName}} Talent Acquisition Team";
const DEFAULT_REJECTED_TEMPLATE =
  "Dear {{name}},\n\nThank you for taking the time to interview with us for the {{role}} position at {{companyName}}.\n\nAfter careful consideration, we will not be moving forward with your application at this time. We wish you all the best.\n\nBest regards,\n{{recruiterName}}\n{{companyName}} Talent Acquisition Team";

/* ── Utility helpers ─────────────────────────── */

/** Normalise a raw status string into a known status */
const normalizeStatus = (value) => {
  const s = String(value || "pending").trim().toLowerCase();
  return ["selected", "rejected", "pending", "completed"].includes(s) ? s : "pending";
};

const getRelevantProctoringReasons = (faceAnalysis = {}) => {
  const summary = faceAnalysis.cheating_summary || {};
  const counts = summary.reason_counts || faceAnalysis.cheating_reason_counts || {};
  return Object.entries(counts)
    .filter(([, count]) => Number(count || 0) > 0)
    .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0));
};

const hasRelevantProctoringWarning = (candidate = {}) => {
  const faceAnalysis = candidate.face_analysis || {};
  const primaryReason = faceAnalysis.cheating_summary?.primary_reason;
  return getRelevantProctoringReasons(faceAnalysis).length > 0 ||
    Boolean(primaryReason) ||
    (candidate.cheating_reason && candidate.cheating_reason.toLowerCase().includes("phone"));
};

/** Short date string (e.g. "7 Apr 2026") */
const formatDate = (value) => {
  if (!value) return "N/A";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "N/A" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

/** Date + time string */
const formatDateTime = (value) => {
  if (!value) return "N/A";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "N/A" : d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const getCandidateScore = (candidate) => {
  const score = candidate?.overall_performance?.score ?? candidate?.overall_performance?.average_score;
  const numericScore = Number(score);
  return Number.isFinite(numericScore) ? numericScore : -Infinity;
};

const getObjectIdTime = (value) => {
  const id = String(value || "");
  if (!/^[a-f\d]{24}$/i.test(id)) return 0;
  return parseInt(id.slice(0, 8), 16) * 1000;
};

const getInterviewTime = (candidate) => {
  const value = candidate?.createdAt || candidate?.updatedAt || candidate?.decision_date;
  const time = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(time) ? time : getObjectIdTime(candidate?._id || candidate?.id);
};

/* ═══════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════ */
const CandidateOverview = ({ initialCampaignId }) => {
  /* ── State ─────────────────────────────────── */
  const [searchQuery, setSearchQuery]           = useState("");
  const [campaignSearchQuery, setCampaignSearchQuery] = useState("");
  const [statusFilter, setStatusFilter]         = useState("pending");
  const [sortFilter, setSortFilter]             = useState("highest_score");
  const [minScoreFilter, setMinScoreFilter]     = useState("");
  const [topKFilter, setTopKFilter]             = useState("");
  const [autoSelectCount, setAutoSelectCount]   = useState(5);
  const [autoPendingCount, setAutoPendingCount] = useState(10);
  const [autoRejectRest, setAutoRejectRest]     = useState(true);
  const [campaigns, setCampaigns]               = useState([]);
  const [reports, setReports]                   = useState([]);
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);
  const [selectedCandidateId, setSelectedCandidateId] = useState(null);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState([]);
  const [loading, setLoading]                   = useState(true);
  const [error, setError]                       = useState(null);
  const [actionLoading, setActionLoading]       = useState(false);
  const [actionMessage, setActionMessage]       = useState("");
  const appliedInitialCampaignIdRef = useRef(null);


  /* Modal state */
  const [showOutcomeModal, setShowOutcomeModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(DEFAULT_SELECTED_TEMPLATE);
  const [rejectedTemplate, setRejectedTemplate] = useState(DEFAULT_REJECTED_TEMPLATE);
  const [outcomeSending, setOutcomeSending]     = useState(false);
  const [outcomeSummary, setOutcomeSummary]     = useState(null);
  const [outcomeError, setOutcomeError]         = useState(null);
  const [showOutcomeToast, setShowOutcomeToast] = useState(false);

  /* ── Derived data ──────────────────────────── */

  const selectedCampaign = useMemo(
    () => campaigns.find((c) => c._id === selectedCampaignId) || null,
    [campaigns, selectedCampaignId]
  );

  /** Bucket reports by sessionId */
  const reportsBySession = useMemo(() => {
    const map = new Map();
    reports.forEach((r) => {
      const key = r.sessionId ? String(r.sessionId) : "";
      if (!key) return;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    });
    return map;
  }, [reports]);

  /** Candidates visible for the active campaign (filtered) */
  const sessionCandidates = useMemo(() => {
    if (!selectedCampaign?.sessionId) return [];
    const list = reportsBySession.get(String(selectedCampaign.sessionId)) || [];
    const q = searchQuery.trim().toLowerCase();

    const shortlistMode = sortFilter === "score_shortlist";
    const minScore = Number(minScoreFilter);
    const topK = Number(topKFilter);

    const filtered = list.filter((c) => {
      const status = normalizeStatus(c.decision_status || c.final_recommendation?.decision);
      if (shortlistMode && status !== "pending") return false;
      if (statusFilter !== "all") {
        if (statusFilter === "pending" ? status !== "pending" : status !== statusFilter) return false;
      }
      if (shortlistMode && Number.isFinite(minScore) && getCandidateScore(c) < minScore) return false;
      if (!q) return true;
      const name = String(c.candidate_overview?.name || "").toLowerCase();
      const email = String(c.candidate_overview?.email || "").toLowerCase();
      return name.includes(q) || email.includes(q);
    });

    const sorted = [...filtered].sort((a, b) => {
      if (shortlistMode) return getCandidateScore(b) - getCandidateScore(a);
      if (sortFilter === "earliest_interview") return getInterviewTime(a) - getInterviewTime(b);
      if (sortFilter === "latest_interview") return getInterviewTime(b) - getInterviewTime(a);
      return getCandidateScore(b) - getCandidateScore(a);
    });

    if (shortlistMode && Number.isInteger(topK) && topK > 0) return sorted.slice(0, topK);
    return sorted;
  }, [reportsBySession, selectedCampaign, searchQuery, statusFilter, sortFilter, minScoreFilter, topKFilter]);

  /** Aggregate counts for the active session */
  const sessionSummary = useMemo(() => {
    const list = selectedCampaign?.sessionId
      ? reportsBySession.get(String(selectedCampaign.sessionId)) || []
      : [];
    return list.reduce(
      (acc, c) => {
        const s = normalizeStatus(c.decision_status || c.final_recommendation?.decision);
        acc.total++;
        if (s === "selected") acc.selected++;
        else if (s === "rejected") acc.rejected++;
        else acc.pending++;
        return acc;
      },
      { total: 0, selected: 0, rejected: 0, pending: 0 }
    );
  }, [reportsBySession, selectedCampaign]);

  const selectedCandidate = useMemo(
    () => sessionCandidates.find((c) => c.id === selectedCandidateId) || null,
    [sessionCandidates, selectedCandidateId]
  );

  /** Human-readable "decided by" display */
  const decidedByDisplay = useMemo(() => {
    const db = selectedCandidate?.decided_by;
    if (!db) return "N/A";
    if (typeof db === "string") return db;
    return db.username || db.name || db.email || (db._id ? String(db._id) : "N/A");
  }, [selectedCandidate]);

  /* ── Data fetching ─────────────────────────── */

  const loadOverview = useCallback(async () => {
    const token = getCookie("token");
    const userId = getCookie("userId");
    if (!token || !userId) { setError("Session expired."); setLoading(false); return; }

    try {
      setLoading(true);
      setError(null);

      const [campRes, candRes] = await Promise.all([
        fetch(`${process.env.REACT_APP_API_BASE_URL}/campaign/dashboard-stats`, { 
          headers: { 
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache",
            "Pragma": "no-cache"
          } 
        }),
        fetch(`${process.env.REACT_APP_API_BASE_URL}/candidates/${userId}`, { 
          headers: { 
            Authorization: `Bearer ${token}`,
            "Cache-Control": "no-cache",
            "Pragma": "no-cache"
          } 
        }),
      ]);
      const [campData, candData] = await Promise.all([campRes.json(), candRes.json()]);

      if (!campRes.ok || !campData.success) throw new Error(campData.message || "Failed to load campaigns.");
      if (!candRes.ok || !candData.success) throw new Error(candData.message || "Failed to load candidates.");

      setCampaigns(Array.isArray(campData.campaigns) ? campData.campaigns : []);
      setReports(
        (Array.isArray(candData.candidates) ? candData.candidates : []).map((c) => ({
          ...c,
          id: String(c.id || c._id || ""),
          _id: String(c._id || c.id || ""),
          sessionId: c.sessionId ? String(c.sessionId) : "",
          decision_status: normalizeStatus(c.decision_status),
        }))
      );
    } catch (err) {
      setError(err.message);
      setCampaigns([]);
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadOverview(); }, [loadOverview]);

  /* Auto-select first campaign */
  useEffect(() => {
    if (!campaigns.length) { setSelectedCampaignId(null); return; }
    if (
      initialCampaignId &&
      appliedInitialCampaignIdRef.current !== initialCampaignId &&
      campaigns.some((c) => c._id === initialCampaignId)
    ) {
      appliedInitialCampaignIdRef.current = initialCampaignId;
      setSelectedCampaignId(initialCampaignId);
      return;
    }
    if (!selectedCampaignId || !campaigns.some((c) => c._id === selectedCampaignId)) {
      const first = campaigns.find((c) => c.sessionId) || campaigns[0];
      setSelectedCampaignId(first?._id || null);
    }
  }, [campaigns, selectedCampaignId, initialCampaignId]);

  /* Reset selection when campaign changes */
  useEffect(() => {
    setSelectedCandidateId(null);
    setSelectedCandidateIds([]);
    setActionMessage("");
    setOutcomeSummary(null);
    setOutcomeError(null);
  }, [selectedCampaignId]);

  /* Keep selected candidate in view */
  useEffect(() => {
    if (!selectedCandidateId) return;
    if (!sessionCandidates.some((c) => c.id === selectedCandidateId)) {
      setSelectedCandidateId(sessionCandidates[0]?.id || null);
    }
  }, [sessionCandidates, selectedCandidateId]);

  /* ── Actions ───────────────────────────────── */

  /** Mark a single candidate as selected / rejected */
  const handleCandidateAction = async (action) => {
    if (!selectedCandidate) return;
    const token = getCookie("token");
    if (!token) { setActionMessage("❌ Session expired."); return; }

    try {
      setActionLoading(true);
      setActionMessage("");

      const company = "Interview.ai";
      const res = await fetch(`${process.env.REACT_APP_API_BASE_URL}/candidate-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          candidateId: selectedCandidate._id || selectedCandidate.id,
          candidateName: selectedCandidate.candidate_overview?.name,
          action,
          companyName: company,
          jobTitle: selectedCampaign?.jobTitle || "",
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.message || `Failed to ${action}.`);

      // Merge updated report into local state
      const updated = result.updatedReport || result.report;
      const merged = updated
        ? { ...selectedCandidate, ...updated, id: String(updated._id || updated.id || selectedCandidate.id), _id: String(updated._id || updated.id || selectedCandidate._id), sessionId: updated.sessionId ? String(updated.sessionId) : selectedCandidate.sessionId, decision_status: normalizeStatus(updated.decision_status) }
        : { ...selectedCandidate, decision_status: action === "selected" ? "selected" : "rejected", company_name: company, decision_date: new Date().toISOString(), decided_by: { _id: getCookie("userId"), username: localStorage.getItem("userName") || null, name: localStorage.getItem("userName") || null } };


      setReports((prev) => prev.map((c) => (c.id === merged.id || c._id === merged._id) ? merged : c));
      setActionMessage(`✅ ${result.message || `Candidate ${action} successfully`}`);
      setSelectedCandidateId(merged.id || merged._id);
    } catch (err) {
      setActionMessage(`❌ Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  /** Bulk Auto-Assign candidates */
  const handleBulkAutoAssign = async () => {
    if (!sessionCandidates.length) return;
    const token = getCookie("token");
    if (!token) { setActionMessage("❌ Session expired."); return; }

    try {
      setActionLoading(true);
      setActionMessage("Running auto-assign...");

      const company = "Interview.ai";
      const numSelect = Number(autoSelectCount) || 0;
      const numPending = Number(autoPendingCount) || 0;

      const updates = [];
      sessionCandidates.forEach((c, index) => {
        let action = null;
        if (index < numSelect) {
          action = "selected";
        } else if (index < numSelect + numPending) {
          action = "pending";
        } else if (autoRejectRest) {
          action = "rejected";
        }
        
        if (action) {
          updates.push({ candidateId: c.id, action });
        }
      });

      if (updates.length === 0) {
        setActionMessage("⚠️ No candidates to update.");
        setActionLoading(false);
        return;
      }

      const res = await fetch(`${process.env.REACT_APP_API_BASE_URL}/bulk-candidate-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          updates,
          companyName: company
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) throw new Error(result.message || `Failed to auto-assign.`);

      // Optimistically update frontend state
      setReports((prev) => prev.map((c) => {
        const update = updates.find(u => u.candidateId === c.id);
        if (update) {
          return { ...c, decision_status: update.action, company_name: company, decision_date: new Date().toISOString() };
        }
        return c;
      }));

      setActionMessage(`✅ ${result.message}`);

      // Auto-switch back to 'All' list view so the user can see the newly assigned candidates
      setSortFilter("highest_score");
      setStatusFilter("all");
    } catch (err) {
      setActionMessage(`❌ Error: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  /** Toggle checkbox selection for a candidate row */
  const handleCandidateSelection = (id) =>
    setSelectedCandidateIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  /** Select / deselect all visible candidates */
  const handleSelectAll = () => {
    const ids = sessionCandidates.map((c) => c.id);
    const allChecked = ids.length > 0 && ids.every((id) => selectedCandidateIds.includes(id));
    setSelectedCandidateIds((prev) =>
      allChecked ? prev.filter((id) => !ids.includes(id)) : [...new Set([...prev, ...ids])]
    );
  };

  /** Export checked candidates to .xlsx */
  const exportToXLS = () => {
    if (!selectedCampaign) return;
    const rows = sessionCandidates.filter((c) => selectedCandidateIds.includes(c.id));
    if (!rows.length) { alert("Select at least one candidate to export."); return; }

    const data = rows.map((c) => ({
      Name: c.candidate_overview?.name || "N/A",
      Email: c.candidate_overview?.email || "N/A",
      Group: c.candidate_overview?.group || "N/A",

      "Year of Study": c.candidate_overview?.yearOfStudy || "N/A",
      "Overall Score": c.overall_performance?.score || "N/A",
      Decision: c.decision_status || c.final_recommendation?.decision || "pending",
      Company: c.company_name || "N/A",
      Campaign: selectedCampaign.jobTitle || "N/A",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Candidates");
    XLSX.writeFile(wb, `candidates_export_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  /** Send outcome (selected / rejected) emails for the session */
  const handleSendOutcomeEmails = async () => {
    const token = getCookie("token");
    if (!token) { setOutcomeError("Session expired."); return; }
    if (!selectedCampaign?.sessionId) { setOutcomeError("Select a campaign first."); return; }
    if (!selectedTemplate.trim() || !rejectedTemplate.trim()) { setOutcomeError("Both templates required."); return; }

    setOutcomeSending(true);
    setOutcomeError(null);
    setOutcomeSummary(null);
    try {
      const res = await fetch(`${process.env.REACT_APP_API_BASE_URL}/campaign/send-outcome-emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId: selectedCampaign.sessionId, selectedTemplate: selectedTemplate.trim(), rejectedTemplate: rejectedTemplate.trim(), jobTitle: selectedCampaign.jobTitle }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to send emails.");

      setOutcomeSummary({
        selectedSentCount: data.selectedSentCount || 0,
        rejectedSentCount: data.rejectedSentCount || 0,
        failedCount: data.failedCount || 0,
        totalProcessed: data.totalProcessed || 0,
        failedEmails: data.failedEmails || [],
      });
      
      setShowOutcomeModal(false);
      setShowOutcomeToast(true);
      setTimeout(() => setShowOutcomeToast(false), 3500);
    } catch (err) {
      setOutcomeError(err.message);
    } finally {
      setOutcomeSending(false);
    }
  };

  /* ── Derived counts ────────────────────────── */
  const selectedCount = sessionCandidates.filter((c) => c.decision_status === "selected").length;
  const rejectedCount = sessionCandidates.filter((c) => c.decision_status === "rejected").length;
  const campaignCountLabel = `${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"}`;

  const filteredCampaigns = campaigns.filter(camp => {
    const q = campaignSearchQuery.toLowerCase();
    if (!q) return true;
    const title = (camp.jobTitle || "").toLowerCase();
    const date = camp.scheduledDate ? formatDate(camp.scheduledDate).toLowerCase() : "";
    return title.includes(q) || date.includes(q);
  });

  /* ── Render ────────────────────────────────── */
  return (
    <div className="overview-container campaign-overview-shell">
      {showOutcomeToast && (
        <div className="gl-toast" style={{ position: 'fixed', top: '24px', right: '24px', zIndex: 9999, background: '#10b981', color: 'white', padding: '12px 20px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', boxShadow: '0 8px 24px rgba(16,185,129,0.25)', fontWeight: 'bold' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          Outcome emails sent successfully!
        </div>
      )}
      <div className="campaign-overview-layout">

        {/* ── Campaign Rail (left) ─────────────── */}
        <aside className="campaign-rail">
          <div className="campaign-rail-header">
            <h2 className="campaign-rail-title">Campaigns</h2>
            <p className="campaign-rail-subtitle">Open one session to see only its candidates.</p>
            <div className="search-container" style={{ marginTop: '12px', marginBottom: '0' }}>
              <input type="text" className="search-input" placeholder="Search campaigns..." value={campaignSearchQuery} onChange={(e) => setCampaignSearchQuery(e.target.value)} style={{ padding: '10px 14px' }} />
            </div>
          </div>

          {loading ? (
            <div className="campaign-rail-empty">Loading campaigns...</div>
          ) : campaigns.length === 0 ? (
            <div className="campaign-rail-empty">No campaigns found. Create one to start reviewing.</div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="campaign-rail-empty">No matching campaigns.</div>
          ) : (
            <div className="campaign-list">
              {filteredCampaigns.map((camp) => (
                <button
                  type="button"
                  key={camp._id}
                  className={`campaign-card card-${(camp.status || "upcoming").toLowerCase()} ${camp._id === selectedCampaignId ? "active" : ""}`}
                  onClick={() => setSelectedCampaignId(camp._id)}
                >
                  <div className="campaign-card-top">
                    <span className="campaign-card-title">{camp.jobTitle || "Untitled campaign"}</span>
                    <span className={`campaign-card-status status-${(camp.status || "upcoming").toLowerCase()}`}>{camp.status || "Upcoming"}</span>
                  </div>
                  <p className="campaign-card-meta">
                    {camp.scheduledDate ? formatDate(camp.scheduledDate) : "No schedule"}
                    {camp.startTime ? ` • ${camp.startTime}` : ""}
                  </p>
                  <div className="campaign-card-stats">
                    <span>{camp.invitedCount || 0} invited</span>
                    <span>{camp.selectedCount || 0} selected</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </aside>

        {/* ── Session Workspace (right) ────────── */}
        <section className="session-workspace">
          {/* Header */}
          <div className="session-header">
            <div>
              <p className="session-eyebrow">Session workspace</p>
              <h1 className="overview-title session-title">{selectedCampaign?.jobTitle || "Candidate Overview"}</h1>
              <p className="session-subtitle">
                {selectedCampaign
                  ? `Showing candidates only for this session. ${campaignCountLabel} in total.`
                  : "Pick a campaign from the left to view candidates."}
              </p>
            </div>
            <div className="session-actions">
              <button
                type="button"
                className="outcome-btn"
                onClick={() => { setShowOutcomeModal(true); setOutcomeSummary(null); setOutcomeError(null); }}
                disabled={!selectedCampaign?.sessionId || sessionCandidates.length === 0}
              >
                Send Outcome Emails ({selectedCount} selected · {rejectedCount} rejected)
              </button>
            </div>
          </div>

          {/* Metric pills */}
          {selectedCampaign && (
            <div className="session-metrics">
              <div className="metric-pill"><span>Total</span><strong>{sessionSummary.total}</strong></div>
              <div className="metric-pill metric-selected"><span>Selected</span><strong>{sessionSummary.selected}</strong></div>
              <div className="metric-pill metric-rejected"><span>Rejected</span><strong>{sessionSummary.rejected}</strong></div>
              <div className="metric-pill metric-pending"><span>Pending</span><strong>{sessionSummary.pending}</strong></div>
              <div className="metric-pill metric-session-id"><span>Session</span><strong>{String(selectedCampaign.sessionId).slice(-8)}</strong></div>
            </div>
          )}

          {/* Banners */}
          {error && <div className="overview-error">Error: {error}</div>}
          {actionMessage && <div className="action-message">{actionMessage}</div>}

          {/* Outcome email modal */}
          {showOutcomeModal && (
            <div className="modal-overlay">
              <div className="outcome-modal">
                <h2>Send Outcome Emails</h2>
                <p>These emails will be sent to candidates in <strong>{selectedCampaign?.jobTitle || "this session"}</strong>.</p>
                <div className="warning-box">Both templates must be filled before sending.</div>

                <div className="template-block">
                  <label>Selected candidates ({selectedCount})</label>
                  <textarea value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)} rows={4} />
                </div>
                <div className="template-block">
                  <label>Rejected candidates ({rejectedCount})</label>
                  <textarea value={rejectedTemplate} onChange={(e) => setRejectedTemplate(e.target.value)} rows={4} />
                </div>

                {outcomeError && <div className="overview-error">{outcomeError}</div>}
                {outcomeSummary && (
                  <div className="success-box">
                    <p>Email dispatch completed.</p>
                    <span>Selected sent: {outcomeSummary.selectedSentCount}</span>
                    <span>Rejected sent: {outcomeSummary.rejectedSentCount}</span>
                    <span>Total processed: {outcomeSummary.totalProcessed}</span>
                    {outcomeSummary.failedCount > 0 && <span>Failed: {outcomeSummary.failedEmails.join(", ")}</span>}
                  </div>
                )}

                <div className="modal-actions">
                  <button type="button" className="outcome-submit-btn" onClick={handleSendOutcomeEmails} disabled={outcomeSending || !selectedCampaign?.sessionId || !selectedTemplate.trim() || !rejectedTemplate.trim()}>
                    {outcomeSending ? "Sending..." : "Send to Session"}
                  </button>
                  <button type="button" className="outcome-close-btn" onClick={() => setShowOutcomeModal(false)}>Close</button>
                </div>
              </div>
            </div>
          )}

          {/* Candidate list + detail panels */}
          {!loading && selectedCampaign && (
            <div className="session-body">
              {/* Left: candidate list */}
              <div className="candidate-list-panel">
                <div className="candidate-toolbar">
                  <div className="toolbar-meta">
                    <h3>Candidates ({sessionCandidates.length})</h3>
                    <p>Only this session's candidates are shown here.</p>
                  </div>
                  <div className="toolbar-actions">
                    <label className="select-all-toggle">
                      <input type="checkbox" checked={sessionCandidates.length > 0 && sessionCandidates.every((c) => selectedCandidateIds.includes(c.id))} onChange={handleSelectAll} />
                      Select all
                    </label>
                    <button type="button" className="download-btn" onClick={exportToXLS} disabled={!selectedCandidateIds.length}>
                      Download XLS ({selectedCandidateIds.length})
                    </button>
                  </div>
                </div>

                {/* Search */}
                <div className="search-container">
                  <input type="text" className="search-input" placeholder="Search candidates by name or email..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                </div>

                {/* Status filter row */}
                <div className="status-filter-row">
                  {STATUS_OPTIONS.map((opt) => (
                    <button key={opt.key} type="button" className={`status-filter-btn ${statusFilter === opt.key ? "active" : ""}`} onClick={() => setStatusFilter(opt.key)} disabled={sortFilter === "score_shortlist" && opt.key !== "all"} style={sortFilter === "score_shortlist" && opt.key !== "all" ? { opacity: 0.4, cursor: 'not-allowed' } : {}}>
                      {opt.label}
                    </button>
                  ))}
                  <label className="candidate-sort-control" aria-label="Candidate sort order">
                    <select value={sortFilter} onChange={(e) => {
                      const val = e.target.value;
                      setSortFilter(val);
                      if (val === "score_shortlist") setStatusFilter("all");
                    }}>
                      {SORT_OPTIONS.map((opt) => (
                        <option key={opt.key} value={opt.key}>{opt.label}</option>
                      ))}
                    </select>
                  </label>
                </div>

                {sortFilter === "score_shortlist" && (
                  <div className="score-shortlist-panel" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', margin: '-4px 0 10px 0' }}>
                    <label style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--co-muted)' }}>
                      <span style={{textTransform: 'uppercase'}}>Min score</span>
                      <input type="number" min="0" max="10" step="0.1" value={minScoreFilter} onChange={(e) => setMinScoreFilter(e.target.value)} placeholder="7" style={{ width: '80px', padding: '6px 8px', borderRadius: '8px', border: '1px solid var(--co-border)' }} />
                    </label>
                    <label style={{ flex: '0 0 auto', display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--co-muted)' }}>
                      <span style={{textTransform: 'uppercase'}}>Limit</span>
                      <input type="number" min="1" step="1" value={topKFilter} onChange={(e) => setTopKFilter(e.target.value)} placeholder="10" style={{ width: '80px', padding: '6px 8px', borderRadius: '8px', border: '1px solid var(--co-border)' }} />
                    </label>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end', marginLeft: 'auto', padding: '6px', background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.1)', borderRadius: '10px' }}>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem', fontWeight: 'bold', color: '#059669' }}>
                        <span style={{textTransform: 'uppercase'}}>Top (Sel.)</span>
                        <input type="number" min="0" step="1" value={autoSelectCount} onChange={(e) => setAutoSelectCount(e.target.value)} style={{ width: '70px', padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.2)' }} />
                      </label>
                      <label style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '0.75rem', fontWeight: 'bold', color: '#059669' }}>
                        <span style={{textTransform: 'uppercase'}}>Next (Pend.)</span>
                        <input type="number" min="0" step="1" value={autoPendingCount} onChange={(e) => setAutoPendingCount(e.target.value)} style={{ width: '70px', padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.2)' }} />
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 'bold', color: '#059669', paddingBottom: '8px' }}>
                        <input type="checkbox" checked={autoRejectRest} onChange={(e) => setAutoRejectRest(e.target.checked)} />
                        Reject Rest
                      </label>
                      <button type="button" onClick={handleBulkAutoAssign} disabled={actionLoading || sessionCandidates.length === 0} style={{ padding: '6px 12px', background: '#10b981', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', height: '32px' }}>
                        {actionLoading ? "..." : "Auto-Assign"}
                      </button>
                    </div>
                  </div>
                )}

                {/* Candidate cards */}
                {sessionCandidates.length === 0 ? (
                  <div className="empty-candidate-state">No candidates found for this session.</div>
                ) : (
                  <div className="candidate-list">
                    {sessionCandidates.map((c) => {
                      const status = normalizeStatus(c.decision_status || c.final_recommendation?.decision);
                      return (
                        <button type="button" key={c.id} className={`candidate-card ${selectedCandidateId === c.id ? "active" : ""}`} onClick={() => setSelectedCandidateId(c.id)}>
                          <input type="checkbox" className="candidate-checkbox" checked={selectedCandidateIds.includes(c.id)} onChange={(e) => { e.stopPropagation(); handleCandidateSelection(c.id); }} />
                          <div className="candidate-card-content">
                            <div className="candidate-card-header">
                              <div>
                                <h4>
                                  {c.candidate_overview?.name || "Unnamed"}
                                  {c.candidate_overview?.group ? ` (Group ${c.candidate_overview.group})` : ""}
                                </h4>
                                <p>{c.candidate_overview?.email || "N/A"}</p>
                              </div>
                              <span className={`status-badge status-${status}`}>{status}</span>
                            </div>
                            <div className="candidate-card-footer">
                              <span>Score: {c.overall_performance?.score ?? "N/A"}</span>
                              <span>Decision: {c.company_name || "pending"}</span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Right: candidate detail */}
              <div className="candidate-detail-panel">
              {selectedCandidate ? (
                  <div className="candidate-detail-card">
                    <div className="detail-head">
                      <div>
                        <p className="detail-label">Candidate details</p>
                        <div className="detail-header-info">
                          <h3>
                            {selectedCandidate.candidate_overview?.name || "Unnamed"}
                            {selectedCandidate.candidate_overview?.group && (
                              <span style={{ fontSize: "0.8em", color: "#6b7280", marginLeft: "8px" }}>
                                (Group {selectedCandidate.candidate_overview.group})
                              </span>
                            )}
                          </h3>
                          <p className="detail-email">{selectedCandidate.candidate_overview?.email || "N/A"}</p>
                        </div>

                      </div>
                      <span className={`status-badge status-${normalizeStatus(selectedCandidate.decision_status)}`}>
                        {normalizeStatus(selectedCandidate.decision_status)}
                      </span>
                    </div>

                    <div className="detail-grid">
                      <div><span>Session</span><strong>{selectedCampaign?.jobTitle || "N/A"}</strong></div>
                      <div><span>Decision date</span><strong>{formatDateTime(selectedCandidate.decision_date)}</strong></div>
                      <div><span>Decided by</span><strong>{decidedByDisplay}</strong></div>
                      <div><span>Company</span><strong>{selectedCandidate.company_name || "N/A"}</strong></div>
                    </div>

                    {/* ── Overall Performance ─────────────── */}
                    {selectedCandidate.overall_performance && (
                      <div className="detail-section overall-performance-section">
                        <h4>Overall Performance</h4>
                        <div className="performance-row">
                          <div className="score-badge-large">
                            <span className="score-value">{selectedCandidate.overall_performance.score ?? selectedCandidate.overall_performance.average_score ?? "N/A"}</span>
                            <span className="score-label">/ 10</span>
                          </div>
                          {selectedCandidate.overall_performance.performance_level && (
                            <span className={`performance-level level-${(selectedCandidate.overall_performance.performance_level || "").toLowerCase()}`}>
                              {selectedCandidate.overall_performance.performance_level}
                            </span>
                          )}
                        </div>
                        {selectedCandidate.overall_performance.summary && (
                          <p className="performance-summary">{selectedCandidate.overall_performance.summary}</p>
                        )}
                      </div>
                    )}

                    {/* ── Section-wise Evaluation ─────────── */}
                    {selectedCandidate.section_wise_evaluation && (
                      <div className="detail-section">
                        <h4>Section-wise Evaluation</h4>
                        <div className="section-eval-grid">
                          {[
                            { key: "technical", label: "Technical" },
                            { key: "hr", label: "HR" },
                            { key: "general", label: "General" },
                          ].map(({ key, label }) => {
                            const sec = selectedCandidate.section_wise_evaluation[key] || selectedCandidate.section_wise_evaluation[label] || {};
                            const score = sec.average_score ?? sec.score;
                            return (
                              <div className="section-eval-card" key={key}>
                                <div className="section-eval-header">
                                  <span className="section-eval-label">{label}</span>
                                  <span className={`section-eval-score ${score != null && score >= 7 ? "score-high" : score != null && score >= 4 ? "score-mid" : "score-low"}`}>
                                    {score != null ? score : "N/A"}
                                  </span>
                                </div>
                                {sec.feedback && <p className="section-eval-feedback">{sec.feedback}</p>}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* ── Face Analysis ────────────────────── */}
                    {/* ── 📸 Webcam & Face Proctoring ────────── */}
                    <div className="detail-section face-analysis-section">
                      <h4>📸 Webcam & Face Proctoring</h4>
                      {selectedCandidate.face_analysis ? (
                        <>
                          <div className="face-analysis-grid">
                            <div className="face-stat">
                              <span className="face-stat-label">Confidence</span>
                              <span className="face-stat-value">
                                {selectedCandidate.face_analysis.confidence_score != null 
                                  ? `${selectedCandidate.face_analysis.confidence_score.toFixed(1)}/10` 
                                  : "N/A"}
                              </span>
                            </div>
                            <div className="face-stat">
                              <span className="face-stat-label">Emotion</span>
                              <span className="face-stat-value emoji-value">{selectedCandidate.face_analysis.dominant_emotion || "N/A"}</span>
                            </div>
                            <div className="face-stat">
                              <span className="face-stat-label">Verification</span>
                              <span className={`face-stat-value ${selectedCandidate.face_analysis.verification_status === "verified" ? "verified-badge" : "unverified-badge"}`}>
                                {selectedCandidate.face_analysis.verification_status === "no_reference"
                                  ? "No Reference Photo"
                                  : selectedCandidate.face_analysis.verification_status || "N/A"}
                              </span>
                            </div>
                            <div className="face-stat">
                              <span className="face-stat-label">Verified Frames</span>
                              <span className="face-stat-value">
                                {selectedCandidate.face_analysis.verified_frames ?? "?"}/{selectedCandidate.face_analysis.verification_checks ?? selectedCandidate.face_analysis.total_frames ?? "?"}
                                {selectedCandidate.face_analysis.verification_rate != null && (
                                  <small> ({selectedCandidate.face_analysis.verification_rate}%)</small>
                                )}
                              </span>
                            </div>
                          </div>
                          {selectedCandidate.face_analysis.behavior_assessment && (
                            <p className="behavior-assessment" style={{ marginTop: '10px', fontStyle: 'italic' }}>
                              {selectedCandidate.face_analysis.behavior_assessment}
                            </p>
                          )}

                          {/* Webcam Violations Warning Box */}
                          {hasRelevantProctoringWarning(selectedCandidate) ? (
                            <div className="proctoring-alert proctoring-failed" style={{ marginTop: '12px' }}>
                              <span className="proctoring-icon">⚠️</span>
                              <div>
                                <strong>Webcam Proctoring Violation Flagged</strong>
                                <p>{getRelevantProctoringReasons(selectedCandidate.face_analysis)[0]?.[0] || selectedCandidate.cheating_reason || "Suspicious behavior flagged by camera proctoring."}</p>
                              </div>
                            </div>
                          ) : (
                            <div className="proctoring-alert proctoring-passed" style={{ marginTop: '12px' }}>
                              <span className="proctoring-icon">✅</span>
                              <div>
                                <strong>Webcam Integrity Passed</strong>
                                <p>No suspicious visual activity or phone usage detected by camera proctoring.</p>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <p>No webcam proctoring data available for this session.</p>
                      )}
                    </div>

                    {/* ── 💻 Browser & Tab Tracking ────────── */}
                    <div className="detail-section proctoring-section">
                      <h4>💻 Browser & Tab Tracking</h4>
                      {selectedCandidate.cheating_detected || selectedCandidate.final_report?.cheating_detected ? (
                        <div className="proctoring-alert proctoring-failed">
                          <span className="proctoring-icon">⚠️</span>
                          <div>
                            <strong>Tab/Screen Integrity Violation</strong>
                            <p>{selectedCandidate.cheating_reason || selectedCandidate.final_report?.cheating_reason || "Candidate switched tabs or exited fullscreen mode."}</p>
                            <small style={{ color: '#ff4d4f', fontWeight: 'bold' }}>Action: Candidate was force-terminated from the session.</small>
                          </div>
                        </div>
                      ) : (
                        <div className="proctoring-alert proctoring-passed">
                          <span className="proctoring-icon">✅</span>
                          <div>
                            <strong>Screen Integrity Passed</strong>
                            <p>Fullscreen focus maintained perfectly. No tab-switching or escape-key exits detected.</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ── Summary ──────────────────────────── */}
                    <div className="detail-section">
                      <h4>Summary</h4>
                      <p>{selectedCandidate.candidate_overview?.summary || selectedCandidate.overall_performance?.summary || "No summary available."}</p>
                    </div>

                    {/* ── Strengths & Weaknesses ──────────── */}
                    <div className="detail-section split">
                      <div>
                        <h4>Strengths</h4>
                        {selectedCandidate.strengths?.length ? (
                          <ul>{selectedCandidate.strengths.map((s, i) => <li key={`${s}-${i}`}>{s}</li>)}</ul>
                        ) : <p>N/A</p>}
                      </div>
                      <div>
                        <h4>Weaknesses</h4>
                        {selectedCandidate.weaknesses?.length ? (
                          <ul>{selectedCandidate.weaknesses.map((w, i) => <li key={`${w}-${i}`}>{w}</li>)}</ul>
                        ) : <p>N/A</p>}
                      </div>
                    </div>

                    {/* ── AI Recommendation ───────────────── */}
                    <div className="detail-section recommendation-section">
                      <h4>AI Recommendation</h4>
                      {selectedCandidate.final_recommendation?.decision && (
                        <span className={`recommendation-badge ${(selectedCandidate.final_recommendation.decision || "").toLowerCase().includes("not") ? "rec-negative" : "rec-positive"}`}>
                          {selectedCandidate.final_recommendation.decision}
                        </span>
                      )}
                      <p>{selectedCandidate.final_recommendation?.justification || "No recommendation available."}</p>
                    </div>

                    <div className="detail-actions">
                        <button type="button" className="action-btn select" onClick={() => handleCandidateAction("selected")} disabled={actionLoading}>Mark Selected</button>
                        <button type="button" className="action-btn reject" onClick={() => handleCandidateAction("rejected")} disabled={actionLoading}>Mark Rejected</button>
                      </div>
                  </div>
                ) : (
                  <div className="empty-detail-state">Select a candidate to view details.</div>
                )}
              </div>
            </div>
          )}

          {/* No campaign selected */}
          {!loading && !selectedCampaign && (
            <div className="empty-session-state">Select a campaign on the left to load its candidates.</div>
          )}
        </section>
      </div>
    </div>
  );
};

export default CandidateOverview;
