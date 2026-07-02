import React, { useEffect, useState } from "react";

/**
 * InviteSendingLoader
 *
 * Flow:
 *  1. Loader opens → spinner spins + "Sending session links…" heading
 *  2. API returns (isSending → false):
 *       Spinner keeps spinning WHILE stat rows animate in simultaneously:
 *         • Sent row counts up   (green)
 *         • Failed row counts up (red)  — starts after sent finishes
 *  3. After BOTH stat animations are done:
 *       Spinner morphs → purple tick
 *       Heading swaps  → "Links sent!"
 *       OK button slides up
 *
 * Props:
 *  isVisible  {boolean}
 *  isSending  {boolean}   true while API in-flight
 *  sent       {number}
 *  failed     {number}
 *  onDone     {() => void}
 */
const InviteSendingLoader = ({
  isVisible,
  isSending = true,
  status = "success",
  sent   = 0,
  failed = 0,
  errorMessage = "",
  onDone,
}) => {
  const isError = status === "error";
  const isPartial = status === "partial";
  const [sentState,     setSentState]     = useState("idle"); // idle|counting|done
  const [failedState,   setFailedState]   = useState("idle");
  const [sentDisplay,   setSentDisplay]   = useState(0);
  const [failedDisplay, setFailedDisplay] = useState(0);
  // allDone = both rows finished → trigger tick + OK
  const [allDone,       setAllDone]       = useState(false);

  // Reset on close
  useEffect(() => {
    if (!isVisible) {
      setSentState("idle");
      setFailedState("idle");
      setSentDisplay(0);
      setFailedDisplay(0);
      setAllDone(false);
    }
  }, [isVisible]);

  // When API finishes, animate stats simultaneously with the still-spinning circle
  useEffect(() => {
    if (!isVisible || isSending) return;

    const animateCount = (target, setter, onComplete) => {
      if (target === 0) { setter(0); onComplete(); return null; }
      const steps    = Math.min(target, 40);
      const interval = 700 / steps;
      let current    = 0;
      const timer    = setInterval(() => {
        current += Math.ceil(target / steps);
        if (current >= target) {
          setter(target);
          clearInterval(timer);
          onComplete();
        } else {
          setter(current);
        }
      }, interval);
      return timer;
    };

    let t1, t2, c1, c2;

    // Tiny lead-in so the rows aren't already visible before the user notices
    t1 = setTimeout(() => {
      // Sent row starts immediately
      setSentState("counting");
      c1 = animateCount(sent, setSentDisplay, () => {
        setSentState("done");

        // Failed row starts right after sent finishes
        t2 = setTimeout(() => {
          setFailedState("counting");
          c2 = animateCount(failed, setFailedDisplay, () => {
            setFailedState("done");

            // Both done → morph spinner to tick after a brief pause
            setTimeout(() => setAllDone(true), 300);
          });
        }, 150);
      });
    }, 250);

    return () => {
      [t1, t2].forEach(clearTimeout);
      [c1, c2].forEach(id => id && clearInterval(id));
    };
  }, [isVisible, isSending, sent, failed]);

  if (!isVisible) return null;

  // Spinner is visible while sending OR while stats are still animating
  const showSpinner = isSending || !allDone;
  const showTick    = allDone;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-5 backdrop-blur-sm">
      <div
        className="flex w-full max-w-[340px] flex-col items-center rounded-2xl bg-white px-8 py-8 shadow-2xl"
        style={{ minHeight: "360px" }}
      >

        {/* ── Spinner / Tick ─────────────────────────────────────────── */}
        <div className="relative flex h-16 w-16 items-center justify-center">

          {/* Spinning arc — stays spinning until allDone */}
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 64 64"
            fill="none"
            style={{
              opacity:    showSpinner ? 1 : 0,
              transform:  showSpinner ? "scale(1)" : "scale(0.75)",
              transition: "opacity 0.4s ease, transform 0.4s ease",
              animation:  "inviteSpin 1s linear infinite",
            }}
          >
            <circle cx="32" cy="32" r="26" stroke="#E5E7EB" strokeWidth="5" />
            <circle
              cx="32" cy="32" r="26"
              stroke={isError ? "#ef4444" : "#6265f4"}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray="60 104"
            />
          </svg>

          {/* Purple tick — appears only after all stat animations finish */}
          <div
            className="absolute inset-0 flex items-center justify-center rounded-full"
            style={{
              backgroundColor: isError ? "#ef4444" : (isPartial ? "#f59e0b" : "#6265f4"),
              opacity:    showTick ? 1 : 0,
              transform:  showTick ? "scale(1)" : "scale(0.4)",
              transition: "opacity 0.45s cubic-bezier(0.34,1.56,0.64,1), transform 0.45s cubic-bezier(0.34,1.56,0.64,1)",
            }}
          >
            {isError ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"
                strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"
                strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
        </div>

        {/* ── Heading ────────────────────────────────────────────────── */}
        <div className="relative mt-4 flex h-7 w-full items-center justify-center">
          <p
            className="absolute whitespace-nowrap text-lg font-bold tracking-tight text-gray-900"
            style={{
              opacity:    allDone ? 0 : 1,
              transform:  allDone ? "translateY(-6px)" : "translateY(0)",
              transition: "opacity 0.35s ease, transform 0.35s ease",
            }}
          >
            Sending session links…
          </p>
          <p
            className="absolute whitespace-nowrap text-lg font-bold tracking-tight text-gray-900"
            style={{
              opacity:    allDone ? 1 : 0,
              transform:  allDone ? "translateY(0)" : "translateY(6px)",
              transition: "opacity 0.35s ease 0.1s, transform 0.35s ease 0.1s",
            }}
          >
            {isError ? "Invite failed" : (isPartial ? "Invite summary" : "Links sent!")}
          </p>
        </div>

        <div className="mt-2 h-8 w-full">
          <p
            className="m-0 text-center text-xs font-medium leading-snug text-red-500 transition-all duration-300"
            style={{
              opacity: (isError || isPartial) && allDone ? 1 : 0,
              transform: (isError || isPartial) && allDone ? "translateY(0)" : "translateY(4px)",
            }}
          >
            {errorMessage}
          </p>
        </div>

        {/* ── Divider ────────────────────────────────────────────────── */}
        <div className="mt-3 h-px w-full bg-gray-100" />

        {/* ── Stat rows — animate while spinner still spins ──────────── */}
        <div className="mt-5 flex w-full flex-col gap-4" style={{ minHeight: "88px" }}>
          <StatLine
            state={sentState}
            displayValue={sentDisplay}
            label="Sent"
            numColor="#16a34a"
            dotColor="#22c55e"
          />
          <StatLine
            state={failedState}
            displayValue={failedDisplay}
            label="Failed"
            numColor="#ef4444"
            dotColor="#ef4444"
          />
        </div>

        {/* ── OK button — appears after tick ─────────────────────────── */}
        <button
          type="button"
          onClick={onDone}
          disabled={!allDone}
          className="mt-auto w-full rounded-xl py-2.5 text-sm font-semibold text-white
                     active:scale-95 disabled:cursor-not-allowed transition-all duration-300"
          style={{
            backgroundColor: isError ? "#ef4444" : (isPartial ? "#f59e0b" : "#6265f4"),
            opacity:   allDone ? 1 : 0,
            transform: allDone ? "translateY(0)" : "translateY(8px)",
          }}
          onMouseEnter={e => { if (allDone) e.currentTarget.style.backgroundColor = isError ? "#dc2626" : (isPartial ? "#d97706" : "#4f52d4"); }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = isError ? "#ef4444" : (isPartial ? "#f59e0b" : "#6265f4"); }}
        >
          OK
        </button>
      </div>

      <style>{`
        @keyframes inviteSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

/* ── Stat row ──────────────────────────────────────────────────────────────── */
const StatLine = ({ state, displayValue, label, numColor, dotColor }) => {
  const visible = state !== "idle";
  return (
    <div
      className="flex items-center gap-3 transition-all duration-500"
      style={{
        opacity:   visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(14px)",
        transitionTimingFunction: "cubic-bezier(0.22,1,0.36,1)",
      }}
    >
      <span
        className="h-2.5 w-2.5 flex-shrink-0 rounded-full transition-transform duration-200"
        style={{
          backgroundColor: dotColor,
          transform: state === "counting" ? "scale(1.3)" : "scale(1)",
        }}
      />
      <span
        className="font-bold leading-none tabular-nums transition-all duration-200"
        style={{
          color:    numColor,
          fontSize: state === "counting" ? "1.875rem" : "1.5rem",
        }}
      >
        {Number(displayValue || 0).toLocaleString()}
      </span>
      <span className="text-sm leading-tight text-gray-500">{label}</span>
    </div>
  );
};

export default InviteSendingLoader;
