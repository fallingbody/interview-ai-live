import React, { useEffect, useState } from 'react';

const styles = `
  @keyframes bml-fade-in { from{opacity:0} to{opacity:1} }
  @keyframes bml-card-in { from{opacity:0;transform:scale(0.88) translateY(10px)} to{opacity:1;transform:scale(1) translateY(0)} }
  @keyframes bml-shimmer  { 0%{left:-60%} 100%{left:140%} }
  @keyframes bml-spin     { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes bml-unspin   { from{transform:rotate(0deg)} to{transform:rotate(-360deg)} }
  @keyframes bml-lm-pulse { 0%,100%{opacity:.3;transform:scale(.8)} 50%{opacity:1;transform:scale(1.4)} }
  @keyframes bml-step-ring{ 0%,100%{box-shadow:0 0 0 0 rgba(52,152,219,.45)} 50%{box-shadow:0 0 0 5px rgba(52,152,219,0)} }
  @keyframes bml-progress { 0%{transform:translateX(-100%) scaleX(.4)} 50%{transform:translateX(30%) scaleX(.8)} 100%{transform:translateX(160%) scaleX(.4)} }
  @keyframes bml-breathe  { 0%,100%{opacity:.5} 50%{opacity:1} }
  @keyframes bml-scan     { 0%{top:14px;opacity:0} 8%{opacity:1} 92%{opacity:1} 100%{top:82px;opacity:0} }
  @keyframes bml-pop      { 0%{transform:scale(0)} 60%{transform:scale(1.35)} 100%{transform:scale(1)} }

  .bml-overlay{position:fixed;inset:0;z-index:9999;background:rgba(15,23,42,.72);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;animation:bml-fade-in .25s ease-out}
  .bml-card{background:#fff;border-radius:1rem;padding:2.5rem 2rem;display:flex;flex-direction:column;align-items:center;gap:1.2rem;width:300px;position:relative;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.3);animation:bml-card-in .3s cubic-bezier(.34,1.56,.64,1)}
  .bml-card::before{content:'';position:absolute;top:0;left:-100%;width:60%;height:2px;background:linear-gradient(90deg,transparent,#3498db,transparent);animation:bml-shimmer 2s ease-in-out infinite}
  .bml-arc{position:absolute;inset:0;animation:bml-spin 1.4s linear infinite}
  .bml-arc-r{position:absolute;inset:0;animation:bml-unspin 2s linear infinite}
  .bml-nodes{position:absolute;inset:0;pointer-events:none;animation:bml-spin 7s linear infinite}
  .bml-lm{position:absolute;width:4px;height:4px;border-radius:50%;background:#3498db;animation:bml-lm-pulse 1.6s ease-in-out infinite}
  .bml-scan-line{position:absolute;left:8px;right:8px;height:2px;background:linear-gradient(90deg,transparent,#3498db 30%,#2980b9 70%,transparent);border-radius:2px;box-shadow:0 0 8px rgba(52,152,219,.6);animation:bml-scan 2s cubic-bezier(.4,0,.6,1) infinite}
  .bml-steps{width:100%;display:flex;flex-direction:column;gap:10px}
  .bml-step{display:flex;align-items:center;gap:10px;font-size:.83rem;color:#b0bec5;transition:color .35s}
  .bml-step.active{color:#2c3e50;font-weight:600}
  .bml-step.done{color:#27ae60;font-weight:600}
  .bml-step.error{color:#e74c3c;font-weight:600}
  .bml-dot{width:14px;height:14px;border-radius:50%;flex-shrink:0;background:#e9ecef;transition:background .3s;display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:800;line-height:1}
  .bml-dot.active{background:#3498db;animation:bml-step-ring 1s ease-in-out infinite}
  .bml-dot.done{background:#27ae60;animation:bml-pop .35s ease-out forwards}
  .bml-dot.error{background:#e74c3c;animation:bml-pop .35s ease-out forwards}
  .bml-bar{width:100%;height:3px;background:#e9ecef;border-radius:2px;overflow:hidden}
  .bml-bar-fill{height:100%;background:linear-gradient(90deg,#3498db,#2980b9);border-radius:2px;animation:bml-progress 1.8s ease-in-out infinite;transform-origin:left}
  .bml-sublabel{font-size:.82rem;color:#7f8c8d;margin:0;text-align:center;line-height:1.5;max-width:220px;animation:bml-breathe 3s ease-in-out infinite}
`;

const STEPS = ['Detecting face', 'Mapping facial landmarks', 'Generating embedding vector'];
const STEP_DELAY = 420;
const CLOSE_DELAY = 900;

const BiometricsLoader = ({ visible, status = 'processing', onComplete }) => {
  const [shouldRender, setShouldRender] = useState(false);
  const [completedSteps, setCompletedSteps] = useState(0);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    if (!visible) return undefined;

    setShouldRender(true);

    if (status === 'processing') {
      setHasError(false);
      setCompletedSteps(0);
      return undefined;
    }

    if (status === 'error') {
      setHasError(true);
      setCompletedSteps(0);
      const timeout = setTimeout(() => {
        setShouldRender(false);
        setHasError(false);
        onComplete?.();
      }, CLOSE_DELAY);
      return () => clearTimeout(timeout);
    }

    if (status === 'success') {
      setHasError(false);
      setCompletedSteps(0);
      const timers = [
        setTimeout(() => setCompletedSteps(1), STEP_DELAY),
        setTimeout(() => setCompletedSteps(2), STEP_DELAY * 2),
        setTimeout(() => setCompletedSteps(3), STEP_DELAY * 3),
        setTimeout(() => {
          setShouldRender(false);
          setCompletedSteps(0);
          onComplete?.();
        }, STEP_DELAY * 3 + CLOSE_DELAY),
      ];
      return () => timers.forEach(clearTimeout);
    }

    return undefined;
  }, [visible, status, onComplete]);

  if (!shouldRender && !visible) return null;

  const stepClass = (index) => {
    if (hasError) return 'bml-step error';
    if (index < completedSteps) return 'bml-step done';
    if (index === completedSteps && status === 'processing') return 'bml-step active';
    return 'bml-step';
  };

  const dotClass = (index) => {
    if (hasError) return 'bml-dot error';
    if (index < completedSteps) return 'bml-dot done';
    if (index === completedSteps && status === 'processing') return 'bml-dot active';
    return 'bml-dot';
  };

  const dotText = (index) => {
    if (hasError) return '!';
    if (index < completedSteps) return '✓';
    return '';
  };

  return (
    <>
      <style>{styles}</style>
      <div className="bml-overlay" role="dialog" aria-modal="true" aria-label="Extracting biometric profile">
        <div className="bml-card">
          <div style={{ position: 'relative', width: 96, height: 96 }}>
            <svg viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: 96, height: 96, display: 'block' }}>
              <g className="bml-arc">
                <circle cx="48" cy="48" r="44" stroke="#3498db" strokeWidth="1.5" strokeDasharray="80 196" strokeLinecap="round" opacity=".7"/>
              </g>
              <g className="bml-arc-r">
                <circle cx="48" cy="48" r="36" stroke="#AED6F1" strokeWidth="1" strokeDasharray="40 186" strokeLinecap="round" opacity=".6"/>
              </g>
              <ellipse cx="48" cy="46" rx="22" ry="26" fill="#EBF5FB" stroke="#3498db" strokeWidth="1.2"/>
              <path d="M26 44 Q26 20 48 20 Q70 20 70 44" stroke="#3498db" strokeWidth="1.2" fill="#D6EAF8" opacity=".7"/>
              <ellipse cx="41" cy="42" rx="3.5" ry="2.5" fill="#AED6F1"/>
              <ellipse cx="55" cy="42" rx="3.5" ry="2.5" fill="#AED6F1"/>
              <path d="M48 46 L45.5 52 Q48 53.5 50.5 52 Z" fill="#D6EAF8"/>
              <path d="M42 57 Q48 61 54 57" stroke="#AED6F1" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
              <circle cx="41" cy="42" r="2" fill="#3498db" opacity=".9"/>
              <circle cx="55" cy="42" r="2" fill="#3498db" opacity=".9"/>
              <circle cx="48" cy="50" r="1.5" fill="#3498db" opacity=".7"/>
              <circle cx="42" cy="57" r="1.5" fill="#3498db" opacity=".7"/>
              <circle cx="54" cy="57" r="1.5" fill="#3498db" opacity=".7"/>
              <circle cx="48" cy="35" r="1.5" fill="#2980b9" opacity=".6"/>
              <circle cx="35" cy="46" r="1.5" fill="#2980b9" opacity=".5"/>
              <circle cx="61" cy="46" r="1.5" fill="#2980b9" opacity=".5"/>
            </svg>

            <div className="bml-nodes">
              {[{t:4,l:44,d:'0s'},{t:14,l:78,d:'.3s'},{t:50,l:88,d:'.6s'},{t:80,l:70,d:'.9s'},{t:86,l:38,d:'1.2s'},{t:68,l:4,d:'1.5s'},{t:28,l:2,d:'1.8s'}]
                .map((n, i) => (
                  <div key={i} className="bml-lm" style={{ top: n.t, left: n.l, animationDelay: n.d }} />
                ))}
            </div>

            <div className="bml-scan-line" aria-hidden="true" />
          </div>

          <p style={{ fontSize: '.95rem', fontWeight: 700, color: '#2c3e50', margin: 0, letterSpacing: '.01em' }}>
            Extracting biometric profile
          </p>
          <p className="bml-sublabel">
            Processing locally - your photo never leaves this device
          </p>

          <div className="bml-steps">
            {STEPS.map((label, index) => (
              <div key={label} className={stepClass(index)}>
                <div className={dotClass(index)}>{dotText(index)}</div>
                <span>{label}</span>
              </div>
            ))}
          </div>

          <div className="bml-bar" role="progressbar" aria-label="Extracting biometrics">
            <div className="bml-bar-fill" />
          </div>
        </div>
      </div>
    </>
  );
};

export default BiometricsLoader;
