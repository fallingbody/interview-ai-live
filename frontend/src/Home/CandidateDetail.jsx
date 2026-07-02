/**
 * CandidateDetail.jsx
 * Full detail view for a single candidate: interview
 * transcript, report card, and select/reject actions.
 */
import React from "react";
import "./CandidateDetail.css";

const CandidateDetail = ({ candidate, handleSelect, handleReject, goBack }) => {
  return (
    <div className="candidate-detail-wrapper">
      {/* Back navigation */}
      <button onClick={goBack} className="back-btn">&larr; Back to Overview</button>

      {/* Candidate header */}
      <h1 className="candidate-detail-title">{candidate.name} Interview</h1>
      <p className="interview-date">Interview Date: {candidate.date}</p>

      <div className="detail-content-grid">
        {/* Transcript panel */}
        <div className="transcript-section">
          <h2 className="section-title">Interview Transcript</h2>
          <p className="transcript-text">{candidate.transcript}</p>
        </div>

        {/* Report panel */}
        <div className="report-section">
          <div className="report-content">
            <h2 className="section-title">Result Report</h2>
            <div className="report-details">
              <p className="report-item"><span className="report-label">Communication:</span> Excellent</p>
              <p className="report-item"><span className="report-label">Technical Skill:</span> Good</p>
              <p className="report-item"><span className="report-label">Fluency:</span> {candidate.score > 5 ? "Very Good" : "Good"}</p>
              <p className="report-item"><span className="report-label">Confidence:</span> High</p>
              <a href={candidate.pdfLink} className="pdf-download-link">Download Full Report (PDF)</a>
            </div>
          </div>

          {/* Action buttons */}
          <div className="action-buttons">
            <button onClick={() => handleSelect(candidate.id)} className="select-btn">Select Candidate</button>
            <button onClick={() => handleReject(candidate.id)} className="reject-btn">Reject Candidate</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CandidateDetail;