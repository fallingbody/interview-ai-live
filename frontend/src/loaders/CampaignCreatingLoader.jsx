import React from "react";

const CampaignCreatingLoader = ({
  status = "loading",
  message = "",
  onDone,
}) => {
  const isError = status === "error";

  return (
  <div
    className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/80 px-5 backdrop-blur-sm"
    role={isError ? "alert" : "status"}
    aria-live="polite"
  >
    <div className="w-full max-w-sm rounded-2xl border border-indigo-400/20 bg-white px-7 py-8 text-center text-gray-900 shadow-2xl shadow-indigo-500/10">
      {isError ? (
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-500">
          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"
            strokeLinecap="round" strokeLinejoin="round" className="h-7 w-7">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>
      ) : (
        <div
          className="mx-auto mb-5 h-14 w-14 animate-spin rounded-full border-4 border-indigo-500/20 border-t-[#6265f4]"
          aria-hidden="true"
        />
      )}
      <h3 className="mb-2 text-xl font-extrabold">
        {isError ? "Campaign failed" : "Creating campaign"}
      </h3>
      <p className="m-0 text-[0.95rem] text-gray-500">
        {isError ? message || "Something went wrong while creating the campaign." : "Preparing the interview session and candidate links."}
      </p>
      {isError && (
        <button
          type="button"
          onClick={onDone}
          className="mt-6 w-full rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-red-600 active:scale-95"
        >
          OK
        </button>
      )}
    </div>
  </div>
  );
};

export default CampaignCreatingLoader;
