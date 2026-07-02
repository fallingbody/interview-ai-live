import React, { useEffect, useState } from "react";

const EmailValidationLoader = ({
  isVisible,
  status = "success",
  unique = 0,
  duplicates = 0,
  invalid = 0,
  errorMessage = "",
  onDone,
}) => {
  const isError = status === "error";
  const [uniqueState, setUniqueState] = useState("idle");
  const [dupState, setDupState] = useState("idle");
  const [invalidState, setInvalidState] = useState("idle");
  const [showResult, setShowResult] = useState(false);

  const [uniqueDisplay, setUniqueDisplay] = useState(0);
  const [dupDisplay, setDupDisplay] = useState(0);
  const [invalidDisplay, setInvalidDisplay] = useState(0);

  useEffect(() => {
    if (!isVisible) {
      setUniqueState("idle");
      setDupState("idle");
      setInvalidState("idle");
      setShowResult(false);
      setUniqueDisplay(0);
      setDupDisplay(0);
      setInvalidDisplay(0);
      return;
    }

    if (isError) {
      const timer = setTimeout(() => setShowResult(true), 450);
      return () => clearTimeout(timer);
    }

    const animateCount = (target, setter, onComplete) => {
      if (target === 0) {
        setter(0);
        onComplete();
        return null;
      }

      const steps = Math.min(target, 30);
      const interval = 600 / steps;
      let current = 0;
      const timer = setInterval(() => {
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

    let t1, t2, t3, c1, c2, c3;

    t1 = setTimeout(() => {
      setUniqueState("counting");
      c1 = animateCount(unique, setUniqueDisplay, () => {
        setUniqueState("done");
        t2 = setTimeout(() => {
          setDupState("counting");
          c2 = animateCount(duplicates, setDupDisplay, () => {
            setDupState("done");
            t3 = setTimeout(() => {
              setInvalidState("counting");
              c3 = animateCount(invalid, setInvalidDisplay, () => {
                setInvalidState("done");
                setTimeout(() => setShowResult(true), 350);
              });
            }, 180);
          });
        }, 180);
      });
    }, 300);

    return () => {
      [t1, t2, t3].forEach(clearTimeout);
      [c1, c2, c3].forEach((id) => id && clearInterval(id));
    };
  }, [isVisible, isError, unique, duplicates, invalid]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 px-5 backdrop-blur-sm">
      <div className="flex h-[430px] w-full max-w-[360px] flex-col items-center rounded-2xl bg-white px-8 py-8 shadow-2xl">
        <div className="relative flex h-16 w-16 items-center justify-center">
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 64 64"
            fill="none"
            style={{
              opacity: showResult ? 0 : 1,
              transform: showResult ? "scale(0.8)" : "scale(1)",
              transition: "opacity 0.4s ease, transform 0.4s ease",
              animation: "emailValidationSpin 1s linear infinite",
            }}
          >
            <circle cx="32" cy="32" r="26" stroke="#E5E7EB" strokeWidth="5" />
            <circle
              cx="32"
              cy="32"
              r="26"
              stroke={isError ? "#ef4444" : "#6265f4"}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray="60 104"
            />
          </svg>

          <div
            className={`absolute inset-0 flex items-center justify-center rounded-full ${isError ? "bg-red-500" : "bg-[#6265f4]"}`}
            style={{
              opacity: showResult ? 1 : 0,
              transform: showResult ? "scale(1)" : "scale(0.4)",
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

        <div className="mt-3 h-7">
          <p
            className="text-lg font-bold tracking-tight text-gray-900 transition-all duration-500"
            style={{
              opacity: showResult ? 1 : 0,
              transform: showResult ? "translateY(0)" : "translateY(6px)",
            }}
          >
            {isError ? "Validation failed" : "Validated"}
          </p>
        </div>

        <div className="mt-5 h-px w-full bg-gray-100" />

        <div className="mt-5 flex h-[132px] w-full flex-col gap-4">
          {isError ? (
            <div
              className="flex h-full items-center rounded-xl border border-red-100 bg-red-50 px-4 text-center text-sm font-medium leading-relaxed text-red-600 transition-all duration-500"
              style={{
                opacity: showResult ? 1 : 0,
                transform: showResult ? "translateY(0)" : "translateY(10px)",
              }}
            >
              {errorMessage || "Could not validate the CSV. Please check the file and try again."}
            </div>
          ) : (
            <>
              <StatLine
                state={uniqueState}
                displayValue={uniqueDisplay}
                label="Unique Emails Ready"
                color="text-green-600"
                dotColor="bg-green-500"
              />
              <StatLine
                state={dupState}
                displayValue={dupDisplay}
                label="Duplicate Emails Ignored"
                color="text-[#D97706]"
                dotColor="bg-[#D97706]"
              />
              <StatLine
                state={invalidState}
                displayValue={invalidDisplay}
                label="Invalid Emails Removed"
                color="text-red-500"
                dotColor="bg-red-500"
              />
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onDone}
          disabled={!showResult}
          className={`mt-auto w-full rounded-xl py-2.5 text-sm font-semibold text-white active:scale-95 disabled:cursor-not-allowed transition-all duration-300 ${
            isError ? "bg-red-500 hover:bg-red-600" : "bg-[#6265f4] hover:bg-[#4f46e5]"
          }`}
          style={{
            opacity: showResult ? 1 : 0,
            transform: showResult ? "translateY(0)" : "translateY(8px)",
          }}
        >
          OK
        </button>
      </div>

      <style>{`
        @keyframes emailValidationSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

const StatLine = ({ state, displayValue, label, color, dotColor }) => {
  const visible = state !== "idle";
  return (
    <div
      className="flex items-center gap-3 transition-all duration-500"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(14px)",
        transitionTimingFunction: "cubic-bezier(0.22,1,0.36,1)",
      }}
    >
      <span className={`h-2.5 w-2.5 flex-shrink-0 rounded-full transition-transform duration-200 ${dotColor} ${state === "counting" ? "scale-125" : "scale-100"}`} />
      <span className={`font-bold leading-none tabular-nums transition-all duration-200 ${color} ${state === "counting" ? "text-3xl" : "text-2xl"}`}>
        {Number(displayValue || 0).toLocaleString()}
      </span>
      <span className="text-sm leading-tight text-gray-500">{label}</span>
    </div>
  );
};

export default EmailValidationLoader;
