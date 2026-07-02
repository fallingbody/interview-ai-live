import React from 'react';
import './InterviewCompleteModal.css';

/** Full-screen modal shown when the interview ends */
const InterviewCompleteModal = () => {
  return (
    <div className="icm-overlay">
      <div className="icm-box">
        <h2 className="icm-title">Interview Complete!</h2>
        <p className="icm-message">You may close this tab, your interview is finished.</p>
        <p className="icm-subtext">
          Your responses have been submitted successfully.<br />
          If selected, you will receive an email with next steps.
        </p>
      </div>
    </div>
  );
};

export default InterviewCompleteModal;