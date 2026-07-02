import React from 'react';

const styles = `
  @keyframes rsl-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes rsl-card-in {
    from { opacity: 0; transform: scale(0.88) translateY(10px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
  }
  @keyframes rsl-shimmer-bar {
    0%   { left: -60%; }
    100% { left: 140%; }
  }
  @keyframes rsl-ring-pulse {
    0%   { transform: scale(0.7); opacity: 0.8; }
    100% { transform: scale(1.1); opacity: 0; }
  }
  @keyframes rsl-scan-pass {
    0%   { top: 8px;  opacity: 0; }
    10%  { opacity: 1; }
    90%  { opacity: 1; }
    100% { top: 80px; opacity: 0; }
  }
  @keyframes rsl-dot-bounce {
    0%, 80%, 100% { transform: scale(0.7); opacity: 0.5; }
    40%           { transform: scale(1.2); opacity: 1; }
  }
  @keyframes rsl-label-breathe {
    0%, 100% { opacity: 0.55; }
    50%      { opacity: 1; }
  }
  @keyframes rsl-progress-slide {
    0%   { transform: translateX(-100%) scaleX(0.4); }
    50%  { transform: translateX(30%)   scaleX(0.8); }
    100% { transform: translateX(160%)  scaleX(0.4); }
  }

  .rsl-overlay {
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: rgba(15, 23, 42, 0.72);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: rsl-fade-in 0.25s ease-out;
  }
  .rsl-card {
    background: #ffffff;
    border-radius: 1rem;
    padding: 2.5rem 2rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.25rem;
    width: 300px;
    position: relative;
    overflow: hidden;
    box-shadow: 0 24px 60px rgba(0,0,0,0.3);
    animation: rsl-card-in 0.3s cubic-bezier(0.34,1.56,0.64,1);
  }
  .rsl-card::before {
    content: '';
    position: absolute;
    top: 0; left: -100%;
    width: 60%;
    height: 2px;
    background: linear-gradient(90deg, transparent, #3498db, transparent);
    animation: rsl-shimmer-bar 2s ease-in-out infinite;
  }
  .rsl-ring {
    position: absolute;
    border-radius: 50%;
    border: 1px solid rgba(52,152,219,0.25);
    animation: rsl-ring-pulse 2s ease-out infinite;
  }
  .rsl-ring-1 { width: 80px;  height: 80px;  top: 20px; left: 20px; animation-delay: 0s;   }
  .rsl-ring-2 { width: 100px; height: 100px; top: 10px; left: 10px; animation-delay: 0.5s; }
  .rsl-ring-3 { width: 120px; height: 120px; top: 0;    left: 0;    animation-delay: 1s;   }
  .rsl-scan-line {
    position: absolute;
    left: 6px; right: 6px;
    height: 2px;
    background: linear-gradient(90deg, transparent, #3498db 30%, #2980b9 70%, transparent);
    border-radius: 2px;
    top: 8px;
    animation: rsl-scan-pass 1.8s cubic-bezier(0.4,0,0.6,1) infinite;
    box-shadow: 0 0 8px rgba(52,152,219,0.6), 0 0 16px rgba(52,152,219,0.3);
  }
  .rsl-dot {
    width: 8px; height: 8px;
    border-radius: 50%;
    background: #3498db;
    animation: rsl-dot-bounce 1.4s ease-in-out infinite;
  }
  .rsl-dot-2 { animation-delay: 0.2s; background: #2980b9; }
  .rsl-dot-3 { animation-delay: 0.4s; }
  .rsl-sublabel {
    font-size: 0.85rem;
    color: #7f8c8d;
    text-align: center;
    line-height: 1.5;
    max-width: 200px;
    margin: 0;
    animation: rsl-label-breathe 3s ease-in-out infinite;
  }
  .rsl-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #3498db, #2980b9);
    border-radius: 2px;
    animation: rsl-progress-slide 1.8s ease-in-out infinite;
    transform-origin: left;
  }
`;

const ResumeScanLoader = ({ visible }) => {
  if (!visible) return null;

  return (
    <>
      <style>{styles}</style>
      <div className="rsl-overlay" role="dialog" aria-modal="true" aria-label="Scanning resume">
        <div className="rsl-card">

          {/* Doc + scan animation */}
          <div style={{ position: 'relative', width: 72, height: 88 }}>
            {/* Ripple rings */}
            <div style={{ position: 'absolute', width: 120, height: 120, top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }}>
              <div className="rsl-ring rsl-ring-1" />
              <div className="rsl-ring rsl-ring-2" />
              <div className="rsl-ring rsl-ring-3" />
            </div>

            {/* Document SVG */}
            <div style={{ position: 'relative', width: 72, height: 88, zIndex: 1 }}>
              <svg viewBox="0 0 72 88" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
                <rect x="4" y="2" width="52" height="68" rx="5" fill="#EBF5FB" stroke="#3498db" strokeWidth="1.5"/>
                <path d="M42 2 L56 16 L42 16 Z" fill="#D6EAF8" stroke="#3498db" strokeWidth="1"/>
                <rect x="12" y="24" width="28" height="2.5" rx="1.2" fill="#AED6F1"/>
                <rect x="12" y="31" width="36" height="2" rx="1" fill="#D6EAF8"/>
                <rect x="12" y="37" width="32" height="2" rx="1" fill="#D6EAF8"/>
                <rect x="12" y="43" width="28" height="2" rx="1" fill="#D6EAF8"/>
                <rect x="12" y="49" width="20" height="2" rx="1" fill="#D6EAF8"/>
                <circle cx="23" cy="14" r="6" fill="#D6EAF8" stroke="#3498db" strokeWidth="1"/>
              </svg>
              <div className="rsl-scan-line" aria-hidden="true" />
            </div>
          </div>

          {/* Dots */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }} aria-hidden="true">
            <span className="rsl-dot" />
            <span className="rsl-dot rsl-dot-2" />
            <span className="rsl-dot rsl-dot-3" />
          </div>

          {/* Labels */}
          <p style={{ fontSize: '0.95rem', fontWeight: 700, color: '#2c3e50', margin: 0, letterSpacing: '0.01em' }}>
            Scanning resume for photo
          </p>
          <p className="rsl-sublabel">
            Detecting profile image in your document...
          </p>

          {/* Progress bar */}
          <div
            role="progressbar"
            aria-label="Scanning in progress"
            style={{ width: '100%', height: 3, background: '#e9ecef', borderRadius: 2, overflow: 'hidden' }}
          >
            <div className="rsl-progress-fill" />
          </div>

        </div>
      </div>
    </>
  );
};

export default ResumeScanLoader;