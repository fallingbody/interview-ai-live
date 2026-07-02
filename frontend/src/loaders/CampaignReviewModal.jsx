import React, { useEffect, useRef } from "react";

const CampaignReviewModal = ({
  isOpen,
  onBack,
  onConfirm,
  jobTitle = "",
  jobDescription = "",
  interviewType = "",
  experienceLevel = "",
  passThreshold = "",
  interviewDate = "",
  startTime = "",
  backendPreview = null,
  generatedLink = "",
  sessionId = "",
}) => {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (isOpen && scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handler = (event) => {
      if (event.key === "Escape") onBack();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onBack]);

  if (!isOpen) return null;

  const candidateCount =
    backendPreview?.valid ??
    backendPreview?.unique_count ??
    backendPreview?.unique ??
    backendPreview?.total_candidates ??
    backendPreview?.candidate_count ??
    0;
  const groupCount =
    backendPreview?.group_count ??
    backendPreview?.batch_count ??
    backendPreview?.groups?.length ??
    Math.max(1, Math.ceil(Number(candidateCount || 0) / 50));

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onBack();
      }}
    >
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-7 py-5">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Review before sending</h2>
            <p className="mt-0.5 text-xs text-gray-400">
              Confirm all details below, then click Continue & Send.
            </p>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-7 py-6">
          <div className="flex flex-col gap-5">
            <Section title="Campaign">
              <Row label="Job title" value={jobTitle} highlight />
              <Row label="Interview type" value={interviewType} />
              <Row label="Experience" value={experienceLevel} />
              <Row label="Pass threshold" value={passThreshold !== "" ? `${passThreshold}%` : "-"} />
            </Section>

            <Section title="Schedule">
              <Row label="Interview date" value={formatDate(interviewDate)} />
              <Row label="Start time" value={startTime || "-"} />
            </Section>

            <Section title="Candidates">
              <Row label="Total candidates" value={candidateCount} highlight />
              <Row label="Groups / batches" value={groupCount} />
            </Section>

            <Section title="Session">
              {sessionId && <Row label="Session ID" value={sessionId} mono />}
              {generatedLink && (
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-gray-400">Session link</span>
                  <a href={generatedLink} target="_blank" rel="noreferrer" className="break-all text-sm text-[#6265f4] underline-offset-2 hover:underline">
                    {generatedLink}
                  </a>
                </div>
              )}
            </Section>

            {jobDescription && (
              <Section title="Job description">
                <p className="line-clamp-6 whitespace-pre-line text-sm leading-relaxed text-gray-600">
                  {jobDescription}
                </p>
              </Section>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-7 py-5">
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-600 transition-all hover:bg-gray-50 active:scale-95"
          >
            Back
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 rounded-xl bg-[#6265f4] py-2.5 text-sm font-semibold text-white transition-all hover:bg-[#4f46e5] active:scale-95"
          >
            Continue & Send
          </button>
        </div>
      </div>
    </div>
  );
};

const Section = ({ title, children }) => (
  <div className="flex flex-col gap-3">
    <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">{title}</p>
    <div className="flex flex-col gap-2.5 rounded-xl border border-gray-100 bg-gray-50 px-4 py-4">
      {children}
    </div>
  </div>
);

const Row = ({ label, value, highlight = false, mono = false }) => (
  <div className="flex items-start justify-between gap-4">
    <span className="shrink-0 text-sm text-gray-400">{label}</span>
    <span className={[
      "text-right text-sm",
      highlight ? "font-semibold text-gray-900" : "text-gray-700",
      mono ? "font-mono text-xs" : "",
    ].join(" ")}>
      {value || "-"}
    </span>
  </div>
);

const formatDate = (raw) => {
  if (!raw) return "-";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

export default CampaignReviewModal;
