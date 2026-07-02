/**
 * Navbar.jsx — Revamped to match new HomeContent design system
 * Fonts: DM Serif Display + Sora (injected by HomeContent's FontInjector)
 * All styling inline — no separate CSS file needed.
 * Props/logic preserved exactly from original.
 */

import React from "react";

const C = {
  indigo: "#6265F4",
  indigoDark: "#4B4EC8",
  ink: "#0D0D1A",
  muted: "#6B7280",
  borderLight: "rgba(0,0,0,0.07)",
  surface: "#F7F7FC",
};

const Navbar = ({
  toggleSidebar,
  activePage,
  setActivePage,
  scrollToSection,
  isLoggedIn,
  username,
  handleLogout,
  navigate,
  NAV_ITEMS,
}) => {
  const [scrolled, setScrolled] = React.useState(false);
  const [hovered, setHovered] = React.useState(null);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [windowWidth, setWindowWidth] = React.useState(
    typeof window !== "undefined" ? window.innerWidth : 1200
  );

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const isMobile = windowWidth <= 768;
  const isTablet = windowWidth > 768 && windowWidth <= 1024;
  const showMobileMenu = isMobile || isTablet;

  return (
    <>
      <nav
        style={{
          width: "100%",
          position: "sticky",
          top: 0,
          zIndex: 1000,
          background: scrolled ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.85)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          borderBottom: `1px solid ${scrolled ? C.borderLight : "transparent"}`,
          boxShadow: scrolled ? "0 2px 20px rgba(0,0,0,0.06)" : "none",
          transition: "background 0.3s, border-color 0.3s, box-shadow 0.3s",
          padding: isMobile ? "0 16px" : "0 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "64px",
          fontFamily: "'Sora', sans-serif",
        }}
      >
        {/* Left: hamburger + logo */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Hamburger — mobile/tablet only */}
          {showMobileMenu && (
            <button
              onClick={() => {
                setMenuOpen(!menuOpen);
                if (toggleSidebar) toggleSidebar();
              }}
              aria-label="Open menu"
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: C.ink, padding: "6px", borderRadius: "8px",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {menuOpen ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M4 6H20M4 12H20M4 18H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              )}
            </button>
          )}

          {/* Logo box */}
          <div style={{
            width: "36px", height: "36px", borderRadius: "10px",
            background: `linear-gradient(135deg, ${C.indigo}, ${C.indigoDark})`,
            boxShadow: `0 4px 12px ${C.indigo}45`,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
          }}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ color: "white" }}>
              <path d="M9.18083 2.345C9.21654 2.15384 9.31798 1.98118 9.46758 1.85693C9.61718 1.73268 9.80553 1.66467 10 1.66467C10.1945 1.66467 10.3828 1.73268 10.5324 1.85693C10.682 1.98118 10.7835 2.15384 10.8192 2.345L11.695 6.97667C11.7572 7.30596 11.9172 7.60885 12.1542 7.84581C12.3912 8.08277 12.694 8.2428 13.0233 8.305L17.655 9.18083C17.8462 9.21654 18.0188 9.31798 18.1431 9.46758C18.2673 9.61718 18.3353 9.80553 18.3353 10C18.3353 10.1945 18.2673 10.3828 18.1431 10.5324C18.0188 10.682 17.8462 10.7835 17.655 10.8192L13.0233 11.695C12.694 11.7572 12.3912 11.9172 12.1542 12.1542C11.9172 12.3912 11.7572 12.694 11.695 13.0233L10.8192 17.655C10.7835 17.8462 10.682 18.0188 10.5324 18.1431C10.3828 18.2673 10.1945 18.3353 10 18.3353C9.80553 18.3353 9.61718 18.2673 9.46758 18.1431C9.31798 18.0188 9.21654 17.8462 9.18083 17.655L8.305 13.0233C8.2428 12.694 8.08277 12.3912 7.84581 12.1542C7.60885 11.9172 7.30596 11.7572 6.97667 11.695L2.345 10.8192C2.15384 10.7835 1.98118 10.682 1.85693 10.5324C1.73268 10.3828 1.66467 10.1945 1.66467 10C1.66467 9.80553 1.73268 9.61718 1.85693 9.46758C1.98118 9.31798 2.15384 9.21654 2.345 9.18083L6.97667 8.305C7.30596 8.2428 7.60885 8.08277 7.84581 7.84581C8.08277 7.60885 8.2428 7.30596 8.305 6.97667L9.18083 2.345Z"
                stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667"/>
              <path d="M16.6667 1.66667V5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667"/>
              <path d="M18.3333 3.33333H15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667"/>
              <path d="M3.33333 18.3333C4.25381 18.3333 5 17.5871 5 16.6667C5 15.7462 4.25381 15 3.33333 15C2.41286 15 1.66667 15.7462 1.66667 16.6667C1.66667 17.5871 2.41286 18.3333 3.33333 18.3333Z"
                stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667"/>
            </svg>
          </div>

          {/* Brand name */}
          <span style={{
            fontFamily: "'Sora', sans-serif", fontWeight: 700,
            fontSize: "1.05rem", color: C.ink, letterSpacing: "-0.03em",
          }}>
            Interview<span style={{ color: C.indigo }}>.ai</span>
          </span>
        </div>

        {/* Centre: nav links — desktop only */}
        {!showMobileMenu && (
          <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
            {NAV_ITEMS.map((item) => {
              const isActive = activePage === item.key;
              const isHov = hovered === item.key;
              return (
                <button
                  key={item.key}
                  onMouseEnter={() => setHovered(item.key)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => {
                    if (["features","platform","customers"].includes(item.key)) {
                      scrollToSection(item.key);
                    } else {
                      setActivePage(item.key);
                    }
                  }}
                  style={{
                    fontFamily: "'Sora', sans-serif",
                    fontWeight: isActive ? 600 : 500,
                    fontSize: "0.875rem",
                    color: isActive ? C.indigo : isHov ? C.ink : C.muted,
                    background: isActive ? `${C.indigo}0E` : isHov ? "rgba(0,0,0,0.04)" : "transparent",
                    border: "none", borderRadius: "8px",
                    padding: "7px 14px", cursor: "pointer",
                    letterSpacing: "-0.01em",
                    transition: "color 0.15s, background 0.15s",
                    position: "relative",
                  }}
                >
                  {item.label}
                  {isActive && (
                    <span style={{
                      position: "absolute", bottom: "4px", left: "50%",
                      transform: "translateX(-50%)", width: "4px", height: "4px",
                      borderRadius: "50%", background: C.indigo,
                    }} />
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Right: auth — desktop only */}
        {!showMobileMenu && (
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            {isLoggedIn ? (
              <>
                <span style={{ fontFamily: "'Sora', sans-serif", fontSize: "0.85rem", color: C.muted }}>
                  Hello, <strong style={{ color: C.ink, fontWeight: 700 }}>{username}</strong>
                </span>
                <button
                  onClick={handleLogout}
                  style={{
                    fontFamily: "'Sora', sans-serif", fontWeight: 600,
                    fontSize: "0.85rem", padding: "8px 18px", borderRadius: "8px",
                    border: `1.5px solid ${C.borderLight}`, background: "transparent",
                    color: C.ink, cursor: "pointer", transition: "border-color 0.2s, background 0.2s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor="#DC2626"; e.currentTarget.style.color="#DC2626"; e.currentTarget.style.background="#FEF2F2"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor=C.borderLight; e.currentTarget.style.color=C.ink; e.currentTarget.style.background="transparent"; }}
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => navigate("/login")}
                  style={{
                    fontFamily: "'Sora', sans-serif", fontWeight: 500,
                    fontSize: "0.875rem", color: C.muted, background: "transparent",
                    border: "none", borderRadius: "8px", padding: "7px 14px",
                    cursor: "pointer", transition: "color 0.15s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = C.ink}
                  onMouseLeave={e => e.currentTarget.style.color = C.muted}
                >
                  Sign in
                </button>
                <button
                  onClick={() => navigate("/login")}
                  style={{
                    fontFamily: "'Sora', sans-serif", fontWeight: 700,
                    fontSize: "0.875rem", padding: "9px 20px", borderRadius: "8px",
                    border: "none",
                    background: `linear-gradient(135deg, ${C.indigo}, ${C.indigoDark})`,
                    color: "#fff", cursor: "pointer",
                    boxShadow: `0 4px 14px ${C.indigo}35`,
                    transition: "transform 0.15s, box-shadow 0.15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform="translateY(-1px)"; e.currentTarget.style.boxShadow=`0 6px 20px ${C.indigo}50`; }}
                  onMouseLeave={e => { e.currentTarget.style.transform="translateY(0)"; e.currentTarget.style.boxShadow=`0 4px 14px ${C.indigo}35`; }}
                >
                  Get started
                </button>
              </>
            )}
          </div>
        )}

        {/* Mobile: show Get Started / Logout button only */}
        {showMobileMenu && (
          <div>
            {isLoggedIn ? (
              <button
                onClick={handleLogout}
                style={{
                  fontFamily: "'Sora', sans-serif", fontWeight: 600,
                  fontSize: "0.8rem", padding: "7px 14px", borderRadius: "8px",
                  border: `1.5px solid ${C.borderLight}`, background: "transparent",
                  color: C.ink, cursor: "pointer",
                }}
              >
                Logout
              </button>
            ) : (
              <button
                onClick={() => navigate("/login")}
                style={{
                  fontFamily: "'Sora', sans-serif", fontWeight: 700,
                  fontSize: "0.8rem", padding: "8px 16px", borderRadius: "8px",
                  border: "none",
                  background: `linear-gradient(135deg, ${C.indigo}, ${C.indigoDark})`,
                  color: "#fff", cursor: "pointer",
                  boxShadow: `0 4px 14px ${C.indigo}35`,
                }}
              >
                Get started
              </button>
            )}
          </div>
        )}
      </nav>

      {/* Mobile dropdown menu */}
      {showMobileMenu && menuOpen && (
        <div style={{
          position: "fixed", top: "64px", left: 0, right: 0,
          background: "rgba(255,255,255,0.98)",
          backdropFilter: "blur(16px)",
          borderBottom: `1px solid ${C.borderLight}`,
          boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
          zIndex: 999,
          padding: "12px 16px 20px",
          display: "flex", flexDirection: "column", gap: "4px",
        }}>
          {NAV_ITEMS.map((item) => {
            const isActive = activePage === item.key;
            return (
              <button
                key={item.key}
                onClick={() => {
                  if (["features","platform","customers"].includes(item.key)) {
                    scrollToSection(item.key);
                  } else {
                    setActivePage(item.key);
                  }
                  setMenuOpen(false);
                }}
                style={{
                  fontFamily: "'Sora', sans-serif",
                  fontWeight: isActive ? 600 : 500,
                  fontSize: "0.95rem",
                  color: isActive ? C.indigo : C.ink,
                  background: isActive ? `${C.indigo}0E` : "transparent",
                  border: "none", borderRadius: "8px",
                  padding: "12px 14px", cursor: "pointer",
                  textAlign: "left", letterSpacing: "-0.01em",
                }}
              >
                {item.label}
              </button>
            );
          })}

          {/* Auth in dropdown */}
          <div style={{ marginTop: "8px", paddingTop: "12px", borderTop: `1px solid ${C.borderLight}` }}>
            {isLoggedIn ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontFamily: "'Sora', sans-serif", fontSize: "0.85rem", color: C.muted }}>
                  Hello, <strong style={{ color: C.ink }}>{username}</strong>
                </span>
                <button
                  onClick={() => { handleLogout(); setMenuOpen(false); }}
                  style={{
                    fontFamily: "'Sora', sans-serif", fontWeight: 600,
                    fontSize: "0.85rem", padding: "8px 18px", borderRadius: "8px",
                    border: `1.5px solid ${C.borderLight}`, background: "transparent",
                    color: "#DC2626", cursor: "pointer",
                  }}
                >
                  Logout
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  onClick={() => { navigate("/login"); setMenuOpen(false); }}
                  style={{
                    flex: 1, fontFamily: "'Sora', sans-serif", fontWeight: 500,
                    fontSize: "0.9rem", color: C.ink, background: "transparent",
                    border: `1.5px solid ${C.borderLight}`, borderRadius: "8px",
                    padding: "11px", cursor: "pointer",
                  }}
                >
                  Sign in
                </button>
                <button
                  onClick={() => { navigate("/login"); setMenuOpen(false); }}
                  style={{
                    flex: 1, fontFamily: "'Sora', sans-serif", fontWeight: 700,
                    fontSize: "0.9rem", padding: "11px", borderRadius: "8px",
                    border: "none",
                    background: `linear-gradient(135deg, ${C.indigo}, ${C.indigoDark})`,
                    color: "#fff", cursor: "pointer",
                    boxShadow: `0 4px 14px ${C.indigo}35`,
                  }}
                >
                  Get started
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar;