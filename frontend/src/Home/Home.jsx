/**
 * Home.jsx
 * Main authenticated shell: top navbar (horizontal navigation),
 * collapsible sidebar, routed page content, and footer.
 *
 * UI updated to match the new premium Dashboard design.
 * All business logic (state, useEffect, API calls, page routing) is preserved.
 */
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

/* ── Page components ──────────────────────────── */
import HomeContent from "./HomeContent.jsx";
import GenerateLink from "./GenerateLink.jsx";
import CandidateOverview from "./CandidateOverview.jsx";
import CandidateDetail from "./CandidateDetail.jsx";
import EditProfile from "./EditProfile.jsx";
import Dashboard from "./Dashboard.jsx";
import { auth } from "../Firebase";
import { getCookie, setCookie, deleteCookie } from "../utils/cookieUtils";
import Footer from "./Footer";
import Navbar from "./Navbar";

/* ── Styles ───────────────────────────────────── */
import "./Home.css";

const Home = () => {
  /* ── UI state ─────────────────────────────────── */
  const [activePage, setActivePage] = useState(() => {
    return localStorage.getItem("recruiter_active_page") || "home";
  });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(!!getCookie("token"));
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [overviewCampaignId, setOverviewCampaignId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [interviewDate, setInterviewDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [username, setUsername] = useState("User");
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  /* ── Candidate data ───────────────────────────── */
  const [candidates, setCandidates] = useState([]);
  const [candidatesLoading, setCandidatesLoading] = useState(true);
  const [candidatesError, setCandidatesError] = useState(null);

  const navigate = useNavigate();

  const handleLogout = React.useCallback(() => {
    setShowLogoutModal(true);
  }, []);

  const confirmLogout = React.useCallback(async () => {
    setShowLogoutModal(false);

    console.debug("Logging out user, clearing all sensitive storage and cookies...");
    
    // 1. Firebase Sign Out
    try {
      await auth.signOut();
    } catch (err) {
      console.error("Firebase logout error:", err);
    }

    // 2. Clear all document cookies completely
    try {
      document.cookie.split(";").forEach((cookie) => {
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
        
        // Clear for current path
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
        // Clear for current domain
        document.cookie = name + `=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${window.location.hostname}`;
        // Clear for root domain if applicable
        const domainParts = window.location.hostname.split('.');
        if (domainParts.length >= 2) {
          const rootDomain = `.${domainParts.slice(-2).join('.')}`;
          document.cookie = name + `=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/;domain=${rootDomain}`;
        }
      });
    } catch (cookieErr) {
      console.error("Error clearing cookies:", cookieErr);
    }

    // 3. Clear LocalStorage and SessionStorage completely
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (storageErr) {
      console.error("Error clearing storage:", storageErr);
    }

    // 4. Delete specific required cookies (failsafe)
    deleteCookie("token");
    deleteCookie("userId");

    // 5. Reset UI State
    setIsLoggedIn(false);
    setUsername("User");
    setCandidates([]);
    setActivePage("home");
    navigate("/");
    if (isSidebarOpen) setIsSidebarOpen(false);
  }, [isSidebarOpen, navigate]);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  /* ── Fetch logged-in user profile ─────────────── */
  useEffect(() => {
    const fetchProfile = async () => {
      const token = getCookie("token");
      if (!token) { setIsLoggedIn(false); return; }
      try {
        const res = await fetch(
          `${process.env.REACT_APP_API_BASE_URL}/profile`,
          { 
            method: "GET", 
            headers: { 
              Authorization: `Bearer ${token}`,
              "Cache-Control": "no-cache",
              "Pragma": "no-cache"
            } 
          }
        );
        if (res.ok) {
          const data = await res.json();
          setUsername(data.username || "User");
          if (data._id) {
            setCookie("userId", data._id, 7);
          }
          setIsLoggedIn(true);
        } else if (res.status === 401) {
          deleteCookie("token");
          setIsLoggedIn(false);
        }
      } catch (err) {
        console.error("Profile fetch error:", err);
      }
    };
    fetchProfile();
  }, [navigate, handleLogout]);

  /* ── Fetch candidates list ────────────────────── */
  useEffect(() => {
    const fetchCandidates = async () => {
      const token = getCookie("token");
      const userId = getCookie("userId");
      if (!token || !userId) { setCandidatesLoading(false); return; }

      setCandidatesLoading(true);
      setCandidatesError(null);
      try {
        const res = await fetch(
          `${process.env.REACT_APP_API_BASE_URL}/candidates/${userId}`,
          { 
            method: "GET", 
            headers: { 
              Authorization: `Bearer ${token}`,
              "Cache-Control": "no-cache",
              "Pragma": "no-cache"
            } 
          }
        );
        const data = await res.json();
        if (res.ok && data.success) {
          setCandidates(data.candidates || []);
        } else if (res.status === 401 || res.status === 403 || data.message === "Session expired.") {
          // Explicit logout on session expiry message
          handleLogout();
        } else {
          setCandidatesError(data.message || "Failed to load candidates.");
        }
      } catch {
        setCandidatesError("Network error. Could not load candidates.");
      } finally {
        setCandidatesLoading(false);
      }
    };
    fetchCandidates();
  }, [navigate, handleLogout]);

  /* ── Tab persistence ──────────────────────────── */
  useEffect(() => {
    localStorage.setItem("recruiter_active_page", activePage);
  }, [activePage]);

  /* ── Candidate actions ────────────────────────── */
  const handleSelect = (id) =>
    setCandidates(candidates.map((c) => c.id === id ? { ...c, decision_status: "selected" } : c));

  const handleReject = (id) =>
    setCandidates(candidates.map((c) => c.id === id ? { ...c, decision_status: "rejected" } : c));

  const filteredCandidates = candidates.filter((c) =>
    (c.decision_status || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  /* ── Quick stats for home page ────────────────── */
  const totalCount = candidates.length;
  const selectedCount = candidates.filter((c) => c.decision_status === "selected").length;
  const rejectedCount = candidates.filter((c) => c.decision_status === "rejected").length;
  const pendingDecisionCount = candidates.filter((c) =>
    !c.decision_status || c.decision_status === "pending"
  ).length;

  /* ── Page router ──────────────────────────────── */
  const renderPage = () => {
    switch (activePage) {
      case "home":
        return (
          <HomeContent
            onGetStarted={() => isLoggedIn ? setActivePage("generate-link") : navigate("/login")}
            onExploreDashboard={() => isLoggedIn ? setActivePage("candidate-overview") : navigate("/login")}
            candidatesLoading={candidatesLoading}
            candidatesError={candidatesError}
            totalCount={totalCount}
            selectedCount={selectedCount}
            rejectedCount={rejectedCount}
            pendingDecisionCount={pendingDecisionCount}
            isLoggedIn={isLoggedIn}
          />
        );
      case "generate-link":
        return (
          <GenerateLink
            interviewDate={interviewDate}
            setInterviewDate={setInterviewDate}
            startTime={startTime}
            setStartTime={setStartTime}
          />
        );
      case "candidate-overview":
        return (
          <CandidateOverview
            initialCampaignId={overviewCampaignId}
            candidates={filteredCandidates}
            onSelect={setSelectedCandidate}
            handleSelect={handleSelect}
            handleReject={handleReject}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
          />
        );
      case "candidate-detail":
        return (
          <CandidateDetail
            candidate={selectedCandidate}
            handleSelect={handleSelect}
            handleReject={handleReject}
            goBack={() => setActivePage("candidate-overview")}
          />
        );
      case "edit-profile":
        return <EditProfile />;
      case "dashboard":
        return (
          <Dashboard
            onOpenCampaign={(campaignId) => {
              setOverviewCampaignId(campaignId);
              setActivePage("candidate-overview");
            }}
          />
        );
      default:
        return null;
    }
  };

  const scrollToSection = (id) => {
    let targetId = id;
    if (id === "features") targetId = "top-anchor";

    if (activePage !== "home") {
      setActivePage("home");
      // Wait for page to render before scrolling
      setTimeout(() => {
        const el = document.getElementById(targetId);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } else {
      const el = document.getElementById(targetId);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  /* ── Nav items config ─────────────────────────── */
  const NAV_ITEMS = isLoggedIn ? [
    { key: "home", label: "Home" },
    { key: "dashboard", label: "Candidate Analytics" },
    { key: "candidate-overview", label: "Candidate Overview" },
    { key: "generate-link", label: "Generate Link" },
    { key: "edit-profile", label: "Edit Profile" },
  ] : [
    { key: "features", label: "Home" },
    { key: "platform", label: "Features" },
    { key: "customers", label: "Customers" },
  ];

  /* ── Render ───────────────────────────────────── */
  return (
    <div className="flex-container">

      {/* ════════════════════════════════════════════
          TOP NAVBAR — new horizontal design
          ════════════════════════════════════════════ */}
      <Navbar
        toggleSidebar={toggleSidebar}
        activePage={activePage}
        setActivePage={setActivePage}
        scrollToSection={scrollToSection}
        isLoggedIn={isLoggedIn}
        username={username}
        handleLogout={handleLogout}
        navigate={navigate}
        NAV_ITEMS={NAV_ITEMS}
      />

      {/* ════════════════════════════════════════════
          SIDEBAR — collapsible drawer (unchanged logic)
          ════════════════════════════════════════════ */}
      <div className={`sidebar ${isSidebarOpen ? "open" : ""}`}>
        <div className="sidebar-content">
          {/* Close button */}
          <button onClick={toggleSidebar} className="close-sidebar-button" aria-label="Close menu">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M6 18L18 6M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>

          {/* Nav links */}
          {NAV_ITEMS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => {
                if (key === "features" || key === "platform" || key === "customers") {
                  scrollToSection(key);
                } else {
                  setActivePage(key);
                }
                toggleSidebar();
              }}
              className={`sidebar-link ${activePage === key ? "active-link" : ""}`}
            >
              {label}
            </button>
          ))}
          <button
            onClick={handleLogout}
            className="sidebar-link logout-link"
          >
            Logout
          </button>
        </div>
      </div>

      {/* ════════════════════════════════════════════
          PAGE CONTENT
          ════════════════════════════════════════════ */}
      <main className="main-content">
        <div className="content-container" style={{ animation: "none" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activePage}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
            >
              {renderPage()}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Footer — only on the Home section */}
      {activePage === "home" && <Footer onProductNavigate={scrollToSection} />}

      {/* Logout Modal */}
      <AnimatePresence>
        {showLogoutModal && (
          <motion.div 
            className="logout-modal-overlay"
            style={{ animation: "none" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            <motion.div 
              className="logout-modal"
              style={{ animation: "none" }}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ type: "spring", stiffness: 350, damping: 25 }}
            >
              <h2>Log Out</h2>
              <p>Are you sure you want to log out of your account?</p>
              <div className="logout-modal-actions">
                <button 
                  className="logout-modal-btn cancel" 
                  onClick={() => setShowLogoutModal(false)}
                >
                  Cancel
                </button>
                <button 
                  className="logout-modal-btn confirm" 
                  onClick={confirmLogout}
                >
                  Log Out
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default Home;
