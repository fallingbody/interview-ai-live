import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

// Core Color Palette
const colors = {
  primary: '#3498db',
  secondary: '#2980b9',
  text: '#2c3e50',
  secondaryText: '#7f8c8d',
  backgroundLight: '#f8f9fa',
  backgroundWhite: '#ffffff',
  border: '#e9ecef',
  active: '#27ae60',
  destructive: '#e74c3c',
  inactive: '#bdc3c7',
};

// Styles
const styles = `
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  body { background: ${colors.backgroundLight}; font-family: 'Inter', sans-serif; }
  .main-container {
    background: ${colors.backgroundLight};
    min-height: 100vh;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 20px;
  }
  .header {
    width: 100%;
    padding: 20px;
    display: flex; justify-content: center;
    animation: fadeIn 0.8s ease-out;
  }
  .logo {
    font-size: 2.5rem; font-weight: bold;
    background: linear-gradient(135deg, ${colors.primary}, ${colors.secondary});
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    position: absolute; top: 20px;
  }
  .instructions-card {
    background: ${colors.backgroundWhite};
    border-radius: 1rem;
    padding: 3rem;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
    max-width: 800px; width: 95%;
    text-align: left;
    animation: fadeIn 0.8s ease-out;
    margin-top: 50px;
  }
  .card-title {
    font-size: 1.8rem; font-weight: 700;
    color: ${colors.primary}; margin-bottom: 0.5rem;
    text-align: center;
  }
  .card-description {
    font-size: 1rem; color: ${colors.text};
    margin-bottom: 2rem; text-align: center;
    border-bottom: 1px solid ${colors.border};
    padding-bottom: 1rem;
  }
  .rules-container {
    max-height: 50vh;
    overflow-y: auto;
    padding-right: 15px;
    margin-bottom: 2rem;
    color: ${colors.text};
  }
  .rules-container::-webkit-scrollbar {
    width: 6px;
  }
  .rules-container::-webkit-scrollbar-thumb {
    background: #ccc;
    border-radius: 4px;
  }
  .rule-section {
    margin-bottom: 1.5rem;
  }
  .rule-section h3 {
    font-size: 1.1rem;
    color: ${colors.secondary};
    margin-bottom: 0.5rem;
  }
  .rule-section ul {
    list-style-type: disc;
    padding-left: 1.5rem;
    margin: 0;
  }
  .rule-section li {
    margin-bottom: 0.3rem;
    font-size: 0.95rem;
    line-height: 1.5;
  }
  .divider {
    border: 0;
    height: 1px;
    background: ${colors.border};
    margin: 1.5rem 0;
  }
  .final-note, .best-of-luck {
    text-align: center;
    margin-bottom: 1rem;
  }
  .final-note h4, .best-of-luck h4 {
    font-size: 1.2rem;
    color: ${colors.primary};
    margin-bottom: 0.5rem;
  }
  .confirmation-section {
    background: ${colors.backgroundLight};
    padding: 1rem;
    border-radius: 0.5rem;
    margin-bottom: 1.5rem;
    border: 1px solid ${colors.border};
  }
  .checkbox-label {
    display: flex;
    align-items: center;
    cursor: pointer;
    font-weight: 500;
  }
  .checkbox-label input {
    margin-right: 10px;
    width: 18px;
    height: 18px;
    cursor: pointer;
  }
  .start-button {
    width: 100%; padding: 1.1rem;
    border: none; border-radius: 0.75rem;
    font-size: 1.2rem; font-weight: bold;
    cursor: pointer;
    background: linear-gradient(135deg, ${colors.active}, #1e8449);
    color: ${colors.backgroundWhite};
    transition: all 0.3s ease;
    box-shadow: 0 6px 20px rgba(39, 174, 96, 0.4);
    display: flex; justify-content: center; align-items: center;
  }
  .start-button:hover:not(:disabled) {
    background: linear-gradient(135deg, #1e8449, ${colors.active});
    box-shadow: 0 8px 25px rgba(39, 174, 96, 0.5);
  }
  .start-button:disabled {
    background: ${colors.inactive};
    cursor: not-allowed;
    box-shadow: none;
  }
  .footer {
    width: 100%; text-align: center; padding: 1rem;
    color: ${colors.secondaryText}; font-size: 0.8rem; margin-top: 2rem;
  }
  .footer-highlight { color: ${colors.primary}; font-weight: bold; }
  .error-message {
    color: ${colors.destructive};
    background: #fbecec;
    padding: 0.75rem; border-radius: 0.5rem;
    border: 1px solid ${colors.destructive};
    margin-bottom: 1rem;
    text-align: center;
  }
`;

const injectStyles = () => {
  const styleTag = document.createElement('style');
  styleTag.textContent = styles;
  document.head.appendChild(styleTag);
};

// ✅ Icons


const StartInterview = () => {
  useEffect(() => {
    injectStyles();

  }, []);

  const navigate = useNavigate();
  const location = useLocation();
  const candidateId = location.state?.candidateId; // Adjusted to match the new naming from UserForm
  const resumeId = location.state?.resumeId;
  const reportId  = location.state?.reportId;
  const campaignId = location.state?.campaignId;
  const role = location.state?.role;

  console.log('reportId in StartInterview:', reportId);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [countdown, setCountdown] = useState(null);

  const handleStartInterview = async () => {
    if (!candidateId) {
      setError("User ID not found. Please go back and re-upload your resume.");
      return;
    }
    if (!campaignId) {
      setError("Campaign session not found. Please reopen the interview link and try again.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Ask for camera & mic permissions
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      stream.getTracks().forEach(track => track.stop()); // stop preview immediately

      // 🔹 Enter Fullscreen Mode
      try {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        } else if (document.documentElement.webkitRequestFullscreen) {
          await document.documentElement.webkitRequestFullscreen();
        } else if (document.documentElement.msRequestFullscreen) {
          await document.documentElement.msRequestFullscreen();
        }
      } catch (fsErr) {
        console.warn("Fullscreen request failed:", fsErr);
        // We continue anyway, but it's better if it works
      }

      //  Proceed with backend API call
      const response = await fetch(`${process.env.REACT_APP_FLASK_API_BASE_URL}/api/interviews/start`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-API-KEY': process.env.REACT_APP_FLASK_API_KEY
        },
        body: JSON.stringify({ 
          candidate_id: candidateId,
          resume_id: resumeId,
          campaign_id: campaignId,
          role: role
        }),
      });

      if (!response.ok) {
        let errData = null;
        try {
          errData = await response.json();
        } catch (_) {
          // ignore JSON parse errors and use generic fallback below
        }

        throw new Error(
          errData?.detail || errData?.error || `Failed to start interview (Status: ${response.status})`
        );
      }

      const data = await response.json();
      console.log("Start Interview API Response:", data);

      setCountdown(5);
      let timeLeft = 5;
      const interval = setInterval(() => {
        timeLeft -= 1;
        if (timeLeft <= 0) {
          clearInterval(interval);
          navigate('/interviewroom', {
            state: {
              interviewId: data.interview_id,
              firstQuestion: data.question,
              totalQuestions: data.total_questions,
              resumeId: resumeId,
              reportId: reportId,
            },
          });
        } else {
          setCountdown(timeLeft);
        }
      }, 1000);

    } catch (err) {
      console.error("Error starting interview:", err);

      if (err.name === "NotAllowedError" || err.name === "NotFoundError") {
        setError(
          "Microphone or camera access is blocked. Please manually enable them in your browser settings, then reload this page."
        );
      } else if (err.message.includes("permissions") || err.message.includes("device")) {
        setError(
          "Microphone or camera issue detected. Please check your device connections and allow access."
        );
      } else {
        setError(err.message || "An unexpected error occurred.");
      }

    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="main-container">
      <header className="header">
        <h1 className="logo">Interview.ai</h1>
      </header>

      <main>
        <div className="instructions-card">
          <h2 className="card-title">Interview Guidelines &amp; Rules</h2>
          <p className="card-description">
            Please read the following instructions carefully before proceeding to your interview.
          </p>

          <div className="rules-container">
            <div className="rule-section">
              <h3>1. Follow On-Screen Instructions</h3>
              <ul>
                <li>Carefully read each question displayed on your screen.</li>
                <li>Ensure you understand the question before answering.</li>
                <li>Do not rush—take a moment to process what is being asked.</li>
              </ul>
            </div>

            <div className="rule-section">
              <h3>2. Listen to the Interviewer</h3>
              <ul>
                <li>Pay full attention when the interviewer asks a question.</li>
                <li>Do not interrupt or speak over the interviewer.</li>
                <li>Begin your response only after the question is completely asked.</li>
              </ul>
            </div>

            <div className="rule-section">
              <h3>3. Stay Aligned with the Question</h3>
              <ul>
                <li>Your answer must be directly related to the question asked.</li>
                <li>Avoid going off-topic or giving irrelevant information.</li>
                <li>Keep your responses clear, structured, and to the point.</li>
              </ul>
            </div>

            <div className="rule-section">
              <h3>4. Maintain Professional Communication</h3>
              <ul>
                <li>Speak clearly and confidently.</li>
                <li>Use formal and respectful language throughout the interview.</li>
                <li>Avoid slang or overly casual expressions.</li>
              </ul>
            </div>

            <div className="rule-section">
              <h3>5. Time Awareness</h3>
              <ul>
                <li>Keep your answers concise and within the expected time.</li>
                <li>Avoid unnecessarily long explanations unless required.</li>
              </ul>
            </div>

            <div className="rule-section">
              <h3>6. Body Language &amp; Focus (for video interviews)</h3>
              <ul>
                <li>Stay present in the interview window and read each question carefully.</li>
                <li>Sit in a proper posture and avoid distractions.</li>
                <li>Ensure your surroundings are quiet and professional.</li>
              </ul>
            </div>

            <div className="rule-section">
              <h3>7. Technical Readiness</h3>
              <ul>
                <li>Check your internet connection, audio, and video before starting.</li>
                <li>Do not refresh or close the window during the interview.</li>
              </ul>
            </div>

            <div className="rule-section">
              <h3>8. Honesty &amp; Integrity</h3>
              <ul>
                <li>Provide genuine answers based on your knowledge and experience.</li>
                <li>Do not use external help or unfair means during the interview.</li>
              </ul>
            </div>

            <div className="rule-section">
              <h3>9. Answer Time Limit</h3>
              <ul>
                <li>The answer time limit is 2 minutes per question.</li>
                <li>Keep your answers concise and ensure you finish within the limit.</li>
              </ul>
            </div>

            <hr className="divider" />
            <div className="final-note">
              <h4>Final Note</h4>
              <p>This interview is an opportunity to showcase your skills and thought process. Stay calm, focused, and confident.</p>
            </div>
            
            <hr className="divider" />
            <div className="best-of-luck">
              <h4>Best of Luck!</h4>
              <p>We wish you all the best for your interview.</p>
            </div>
          </div>

          <div className="confirmation-section">
            <label className="checkbox-label">
              <input 
                type="checkbox" 
                checked={agreed} 
                onChange={(e) => setAgreed(e.target.checked)} 
              />
              <span className="checkbox-text">I confirm that I have read and understood all the instructions mentioned above.</span>
            </label>
          </div>

          {error && <p className="error-message">⚠️ {error}</p>}

          <div>
            <button
              type="button"
              onClick={handleStartInterview}
              className="start-button"
              disabled={loading || !agreed || countdown !== null}
            >
              {countdown !== null 
                ? `Interview starting in ${countdown}...` 
                : loading 
                  ? "Starting..." 
                  : "Start Interview"}
            </button>
          </div>
        </div>
      </main>

      <footer className="footer">
        <p className="footer-text">
          &copy; {new Date().getFullYear()} <span className="footer-highlight">Interview.ai</span>. All rights reserved.
        </p>
      </footer>
    </div>
  );
};

export default StartInterview;
