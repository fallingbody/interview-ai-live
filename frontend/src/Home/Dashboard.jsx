/**
 * Dashboard.jsx
 * Campaign analytics dashboard - shows overall metric
 * cards and a table of all campaigns with stats.
 */
import React, { useState, useEffect, useCallback } from "react";
import "./Dashboard.css";
import { getCookie } from "../utils/cookieUtils";

const Dashboard = ({ onOpenCampaign }) => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardStats = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    const token = getCookie("token");
    if (!token) {
      setError("Session expired.");
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const res = await fetch(`${process.env.REACT_APP_API_BASE_URL}/campaign/dashboard-stats`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Cache-Control": "no-cache",
          "Pragma": "no-cache",
        },
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message || "Failed to load dashboard.");

      setDashboardData(data);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardStats();
  }, [fetchDashboardStats]);

  const metrics = dashboardData?.totalMetrics || {};
  const campaigns = dashboardData?.campaigns || [];

  const getStatusColor = (status) => {
    if (status === "Upcoming") return { bg: "#eff6ff", color: "#1d4ed8" };
    if (status === "Active") return { bg: "#fef2f2", color: "#dc2626" };
    if (status === "Expired") return { bg: "#f5f5f5", color: "#6b7280" };
    if (status === "Completed") return { bg: "#e3f2fd", color: "#1565c0" };
    return { bg: "#f5f5f5", color: "#757575" };
  };

  const getRateColor = (rate) => {
    if (rate >= 70) return "#27ae60";
    if (rate >= 40) return "#e67e22";
    return "#e74c3c";
  };

  if (loading) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-loading"><p>Loading dashboard...</p></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-error">
          <p>{error}</p>
          <button onClick={() => fetchDashboardStats()} className="dashboard-retry-btn">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Campaign Analytics</h1>
          <p className="dashboard-subtitle">Overview of all your hiring campaigns and candidate performance</p>
        </div>
        <div className="dashboard-refresh-section">
          {lastUpdated && <p className="dashboard-last-updated">Last updated: {lastUpdated}</p>}
          <button onClick={() => fetchDashboardStats(true)} disabled={refreshing} className="dashboard-refresh-btn">
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="dashboard-metrics-grid">
        <div className="dashboard-metric-card">
          <p className="dashboard-metric-label">Total Candidates</p>
          <p className="dashboard-metric-value" style={{ color: "#2c3e50" }}>{metrics.totalCandidates || 0}</p>
          <p className="dashboard-metric-sub">Across all campaigns</p>
        </div>
        <div className="dashboard-metric-card">
          <p className="dashboard-metric-label">Selected</p>
          <p className="dashboard-metric-value" style={{ color: "#27ae60" }}>{metrics.totalSelected || 0}</p>
          <p className="dashboard-metric-sub">Candidates passed</p>
        </div>
        <div className="dashboard-metric-card">
          <p className="dashboard-metric-label">Rejected</p>
          <p className="dashboard-metric-value" style={{ color: "#e74c3c" }}>{metrics.totalRejected || 0}</p>
          <p className="dashboard-metric-sub">Candidates not moved forward</p>
        </div>
        <div className="dashboard-metric-card">
          <p className="dashboard-metric-label">Selection Rate</p>
          <p className="dashboard-metric-value" style={{ color: getRateColor(metrics.overallSelectionRate || 0) }}>
            {metrics.overallSelectionRate || 0}%
          </p>
          <p className="dashboard-metric-sub">Overall pass rate</p>
        </div>
      </div>

      <div className="dashboard-table-card">
        <div className="dashboard-table-header">
          <h2 className="dashboard-table-title">All Campaigns</h2>
          <span className="dashboard-campaign-count">{campaigns.length} campaign{campaigns.length !== 1 ? "s" : ""}</span>
        </div>

        {campaigns.length === 0 ? (
          <div className="dashboard-empty">
            <p className="dashboard-empty-title">No campaigns yet</p>
            <p className="dashboard-empty-text">Create a campaign from Generate Link to see analytics here</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="dashboard-table">
              <thead>
                <tr>
                  <th>Job Title</th>
                  <th>Status</th>
                  <th>Invited</th>
                  <th>Selected</th>
                  <th>Rejected</th>
                  <th>Pending</th>
                  <th>Selection Rate</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((camp) => {
                  const sc = getStatusColor(camp.status);
                  return (
                    <tr key={camp._id}>
                      <td>
                        <button
                          type="button"
                          className="dashboard-campaign-name-btn"
                          onClick={() => onOpenCampaign?.(camp._id)}
                        >
                          {camp.jobTitle || "N/A"}
                        </button>
                      </td>
                      <td>
                        <span className="dashboard-status-pill" style={{ backgroundColor: sc.bg, color: sc.color }}>
                          {camp.status || "Draft"}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}><strong>{camp.invitedCount || 0}</strong></td>
                      <td style={{ textAlign: "center" }}><strong style={{ color: "#27ae60" }}>{camp.selectedCount || 0}</strong></td>
                      <td style={{ textAlign: "center" }}><strong style={{ color: "#e74c3c" }}>{camp.rejectedCount || 0}</strong></td>
                      <td style={{ textAlign: "center" }}><strong style={{ color: "#e67e22" }}>{camp.pendingCount || 0}</strong></td>
                      <td style={{ textAlign: "center" }}>
                        <span style={{ fontWeight: 700, color: getRateColor(camp.selectionRate || 0) }}>
                          {Number.isNaN(camp.selectionRate) ? "0" : camp.selectionRate}%
                        </span>
                      </td>
                      <td style={{ color: "#7f8c8d", fontSize: "12px" }}>
                        {camp.createdAt ? new Date(camp.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "N/A"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
