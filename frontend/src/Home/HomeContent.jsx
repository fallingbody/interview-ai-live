/**
 * HomeContent.jsx — Interview.ai Landing Page
 * ANIMATED: Scroll-driven reveals, slot-machine stats,
 * continuous testimonial marquee, workflow cards sync to line fill,
 * hover micro-interactions, hero image with overlay type.
 * FULLY RESPONSIVE: iPhone, Android, Tablet, Desktop
 */

import React, { useRef, useEffect, useState } from "react";
import {
  motion,
  useScroll,
  useTransform,
  useSpring,
} from "framer-motion";

/* ─── Design tokens ──────────────────────────────── */
const T = {
  bg: "#FAFAF8",
  bgAlt: "#F3F2EE",
  bgDark: "#16151A",
  accent: "#6265F4",
  accentDk: "#4B4EC8",
  accentLt: "#EEEEFF",
  ink: "#16151A",
  inkMid: "#3D3B45",
  muted: "#7C7A85",
  mutedLt: "#B0AEB8",
  border: "rgba(0,0,0,0.08)",
  borderAcc: "rgba(98,101,244,0.18)",
  mono: "'JetBrains Mono', monospace",
  serif: "'DM Serif Display', serif",
  sans: "'Sora', sans-serif",
};

/* ─── Data ───────────────────────────────────────── */
const FEATURES = [
  { num: "01", title: "Interview Transcripts", desc: "AI-generated transcripts with timestamped summaries. Every word captured, every insight surfaced." },
  { num: "02", title: "Real-Time Processing", desc: "Scores, flags, and insights delivered the moment an interview ends. No waiting, no manual review." },
  { num: "03", title: "Smart Interview Links", desc: "Role-specific question banks, custom branding, scheduling — all in one shareable URL." },
  { num: "04", title: "Candidate Pipeline", desc: "Track every applicant from invite to offer. One view. Zero spreadsheets." },
  { num: "05", title: "AI Analytics", desc: "Sentiment, coherence, technical depth — scored by the same model powering the world's best AI." },
  { num: "06", title: "Enterprise Security", desc: "SOC 2 Type II, GDPR, end-to-end encrypted. Your data never trains our models." },
];

const TESTIMONIALS = [
  { quote: "Interview.ai cut our time-to-hire by 40%. The AI scoring is eerily accurate — our hiring managers trust it over their own gut.", author: "Sarah Chen", role: "Head of HR", co: "TechCorp", initials: "SC", col: "#6265F4" },
  { quote: "Bias was a real problem in our first-round screening. This fixed it. Every candidate gets the same fair shot.", author: "Michael Rodriguez", role: "Talent Director", co: "InnovateCo", initials: "MR", col: "#0D9488" },
  { quote: "It's now our most-used tool — more than our ATS. The summaries alone save us 2 hours per candidate.", author: "Emily Watson", role: "VP of People", co: "GrowthStart", initials: "EW", col: "#D97706" },
  { quote: "We moved from 3-week hiring cycles to 6 days. Our competitors still can't figure out how we move so fast.", author: "James Okafor", role: "Engineering Manager", co: "NexaScale", initials: "JO", col: "#DB2777" },
  { quote: "The section-wise scoring breakdown is gold. We finally know why a candidate failed, not just that they did.", author: "Priya Nair", role: "Head of Talent", co: "FinScale", initials: "PN", col: "#7C3AED" },
  { quote: "Rolled out across 14 offices globally. The consistency is something no human recruiter panel could ever achieve.", author: "Lucas Brandt", role: "Global HR Lead", co: "Ventura Corp", initials: "LB", col: "#059669" },
];

const STATS = [
  { value: "248K", suffix: "+", label: "Candidates evaluated", sub: "across all active campaigns", decimals: 0 },
  { value: "94.2", suffix: "%", label: "Selection accuracy", sub: "vs. 6-month retention data", decimals: 1 },
  { value: "12.4", suffix: "h", label: "Saved per hire", sub: "vs. traditional process", decimals: 1 },
  { value: "1820", suffix: "", label: "Active campaigns", sub: "running right now", decimals: 0 },
];

const HOW_STEPS = [
  { num: "01", title: "Create a campaign", desc: "Define the role, upload a JD, and let AI generate role-specific questions automatically." },
  { num: "02", title: "Share interview link", desc: "Candidates receive a unique link and complete async or live AI-powered interviews." },
  { num: "03", title: "AI scores & ranks", desc: "Every response evaluated on relevance, clarity, and culture fit — instantly." },
  { num: "04", title: "Make your hire", desc: "Review ranked candidates, read AI summaries, and extend offers with full confidence." },
];

/* ─── Section tag ────────────────────────────────── */
const Tag = ({ children }) => (
  <motion.p
    initial={{ opacity: 0, x: -12 }}
    whileInView={{ opacity: 1, x: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.45 }}
    style={{
      fontFamily: T.mono, fontSize: "0.7rem", fontWeight: 600,
      color: T.accent, letterSpacing: "0.08em", textTransform: "uppercase",
      marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px",
    }}
  >
    <span style={{ width: "20px", height: "1.5px", background: T.accent, display: "inline-block" }} />
    {children}
  </motion.p>
);

/* ─── Slot-machine number counter ────────────────── */
const SlotCounter = ({ value, suffix, decimals }) => {
  const ref = useRef(null);
  const [display, setDisplay] = useState("0");
  const [triggered, setTriggered] = useState(false);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting || triggered) return;
      setTriggered(true);
      io.disconnect();
      const target = parseFloat(value);
      const duration = 2200;
      const fps = 60;
      const totalFrames = Math.round((duration / 1000) * fps);
      let frame = 0;
      const tick = () => {
        frame++;
        const progress = frame / totalFrames;
        const eased = progress < 1
          ? 1 - Math.pow(1 - progress, 3) + Math.sin(progress * Math.PI) * 0.08
          : 1;
        const cur = Math.min(eased * target, target);
        const formatted = decimals > 0
          ? cur.toFixed(decimals)
          : Math.round(cur).toLocaleString();
        setDisplay(formatted);
        if (frame < totalFrames) requestAnimationFrame(tick);
        else setDisplay(decimals > 0 ? target.toFixed(decimals) : Math.round(target).toLocaleString());
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.6 });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, [value, suffix, decimals, triggered]);

  return <span ref={ref}>{display}{suffix}</span>;
};

/* ═══════════════════════════════════════════════════
   HERO
   ═══════════════════════════════════════════════════ */
const Hero = ({ onGetStarted, onExploreDashboard, isMobile, isTablet }) => {
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 0.35], [0, isMobile ? 0 : -90]);
  const imgY = useTransform(scrollYProgress, [0, 0.35], [0, 50]);
  const imgOpacity = useTransform(scrollYProgress, [0, 0.35], [1, 0.4]);

  const containerVariants = {
    hidden: {},
    show: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 28 },
    show: { opacity: 1, y: 0, transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1] } },
  };

  return (
    <section style={{
      background: T.bg,
      minHeight: isMobile ? "100svh" : "90vh",
      display: "flex", alignItems: "center",
      position: "relative", overflow: "hidden",
      borderBottom: `1px solid ${T.border}`,
    }}>
      {/* Hero bg image */}
      <motion.div
        style={{
          position: "absolute",
          right: 0, top: 0, bottom: 0,
          width: isMobile || isTablet ? "100%" : "50%",
          y: isMobile ? 0 : imgY,
          opacity: isMobile || isTablet ? 0.07 : imgOpacity,
          zIndex: 1,
        }}
      >
        <div style={{
          position: "absolute", left: 0, top: 0, bottom: 0, width: "55%",
          background: `linear-gradient(to right, ${T.bg}, transparent)`, zIndex: 2,
        }} />
        <div style={{
          position: "absolute", left: 0, right: 0, bottom: 0, height: "30%",
          background: `linear-gradient(to top, ${T.bg}, transparent)`, zIndex: 2,
        }} />
        <img
          src="https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=900&q=80&fit=crop"
          alt="Professional interview session"
          style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top", filter: "saturate(0.7) contrast(1.05)" }}
          onError={e => { e.target.src = "https://images.unsplash.com/photo-1551836022-deb4988cc6c0?w=900&q=80&fit=crop"; }}
        />
        <div style={{ position: "absolute", inset: 0, background: "rgba(98,101,244,0.06)", zIndex: 1 }} />
      </motion.div>

      {/* BG numeral — hidden on mobile */}
      {!isMobile && (
        <div style={{
          position: "absolute", right: "5%", top: "50%",
          transform: "translateY(-50%)",
          fontFamily: T.serif, fontSize: "clamp(200px, 28vw, 400px)",
          fontWeight: 400, color: "rgba(98,101,244,0.03)",
          lineHeight: 1, userSelect: "none", pointerEvents: "none",
          letterSpacing: "-0.06em", zIndex: 1,
        }}>AI</div>
      )}

      <motion.div
        style={{
          y,
          position: "relative", zIndex: 3,
          width: "100%", maxWidth: "1200px",
          margin: "0 auto",
          padding: isMobile ? "90px 20px 40px" : isTablet ? "80px 32px 40px" : "80px 40px 40px",
        }}
        variants={containerVariants}
        initial="hidden"
        animate="show"
      >
        {/* Top badge */}
        <motion.div variants={itemVariants} style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: isMobile ? "28px" : "48px" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            border: `1px solid ${T.border}`, borderRadius: "6px",
            padding: "6px 12px", background: "rgba(250,250,248,0.9)",
            backdropFilter: "blur(8px)", maxWidth: isMobile ? "calc(100vw - 56px)" : "none",
          }}>
            <span style={{
              width: "6px", height: "6px", borderRadius: "50%", background: "#22C55E",
              flexShrink: 0, animation: "heroPulse 2s ease-in-out infinite",
            }} />
            <span style={{
              fontFamily: T.mono,
              fontSize: isMobile ? "0.6rem" : "0.7rem",
              color: T.inkMid, letterSpacing: "0.04em",
              whiteSpace: isMobile ? "normal" : "nowrap",
              lineHeight: 1.4,
            }}>
              Introducing Interview AI · Powered by SuPrazo Technologies
            </span>
          </div>
        </motion.div>

        {/* Headline */}
        <div style={{ maxWidth: "900px" }}>
          {[
            { text: "The hiring platform", indent: false },
            { text: "that thinks before", indent: true },
            { text: "you do.", indent: false, accent: true },
          ].map((line, i) => (
            <motion.div
              key={i}
              variants={itemVariants}
              style={{ paddingLeft: line.indent && !isMobile && !isTablet ? "clamp(40px, 8vw, 120px)" : "0" }}
            >
              <span style={{
                display: "block",
                fontFamily: T.serif,
                fontSize: isMobile
                  ? "clamp(2.4rem, 10vw, 3.2rem)"
                  : isTablet
                  ? "clamp(3rem, 6vw, 4.5rem)"
                  : "clamp(3rem, 7vw, 6.5rem)",
                fontWeight: 400,
                letterSpacing: "-0.04em",
                lineHeight: 1.05,
                color: line.accent ? T.accent : T.ink,
                fontStyle: line.accent ? "italic" : "normal",
              }}>
                {line.text}
              </span>
            </motion.div>
          ))}
        </div>

        {/* Subtitle + CTAs */}
        <motion.div
          variants={itemVariants}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "24px",
            marginTop: isMobile ? "28px" : "48px",
            maxWidth: isMobile ? "100%" : "520px",
          }}
        >
          <p style={{
            fontFamily: T.sans,
            fontSize: isMobile ? "0.95rem" : "1.05rem",
            color: T.muted,
            lineHeight: 1.7, margin: 0,
          }}>
            Automate screening, surface the best candidates instantly, and make decisions backed by AI — not instinct.
          </p>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            <motion.button
              onClick={onGetStarted}
              whileHover={{ scale: 1.03, boxShadow: "0 8px 30px rgba(98,101,244,0.35)" }}
              whileTap={{ scale: 0.96 }}
              style={{
                fontFamily: T.sans, fontWeight: 700,
                fontSize: isMobile ? "0.85rem" : "0.9rem",
                padding: isMobile ? "13px 22px" : "14px 28px",
                borderRadius: "6px", border: "none",
                background: T.ink, color: "#fff",
                cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "8px",
                letterSpacing: "-0.01em",
                boxShadow: "0 4px 20px rgba(22,21,26,0.25)",
              }}
            >
              Start for free
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </motion.button>
            <motion.button
              onClick={onExploreDashboard}
              whileHover={{ scale: 1.03, borderColor: T.accent, color: T.accent }}
              whileTap={{ scale: 0.96 }}
              style={{
                fontFamily: T.sans, fontWeight: 600,
                fontSize: isMobile ? "0.85rem" : "0.9rem",
                padding: isMobile ? "13px 22px" : "14px 28px",
                borderRadius: "6px",
                border: `1.5px solid ${T.border}`, background: "transparent",
                color: T.inkMid, cursor: "pointer",
                transition: "border-color 0.2s, color 0.2s",
              }}
            >
              See live demo
            </motion.button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {["Comprehensive Candidate Analysis", "Real-Time AI Interview", "Seamless Dashboard Integration"].map((t, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                <span style={{ fontFamily: T.mono, fontSize: "0.72rem", color: T.muted, letterSpacing: "0.02em" }}>{t}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Trusted By strip */}
        <motion.div
          variants={itemVariants}
          style={{
            marginTop: isMobile ? "48px" : "60px",
            paddingTop: "30px",
            borderTop: `1px solid ${T.border}`,
            width: "100%",
          }}
        >
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            style={{
              fontFamily: T.sans, fontWeight: 700,
              fontSize: isMobile ? "1.2rem" : "clamp(1.4rem, 3vw, 2rem)",
              color: T.ink, textAlign: "center",
              marginBottom: isMobile ? "28px" : "40px",
              letterSpacing: "-0.03em", lineHeight: 1.2,
            }}
          >
            Trusted By Teams At{" "}
           
          </motion.h2>

          <div style={{ overflow: "hidden", width: "100%", position: "relative" }}>
            <div style={{
              position: "absolute", left: 0, top: 0, bottom: 0,
              width: isMobile ? "40px" : "100px",
              background: `linear-gradient(to right, ${T.bg}, transparent)`,
              zIndex: 2, pointerEvents: "none",
            }} />
            <div style={{
              position: "absolute", right: 0, top: 0, bottom: 0,
              width: isMobile ? "40px" : "100px",
              background: `linear-gradient(to left, ${T.bg}, transparent)`,
              zIndex: 2, pointerEvents: "none",
            }} />
            <motion.div
              animate={{ x: ["0%", "-50%"] }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              style={{ display: "flex", width: "max-content" }}
            >
              {[...Array(2)].map((_, setIdx) => (
                <div key={setIdx} style={{
                  display: "flex", alignItems: "center",
                  gap: isMobile ? "40px" : "80px",
                  padding: isMobile ? "0 20px" : "0 48px",
                }}>
                  {["microsoft", "amazon", "openai", "spacex", "netflix", "google", "meta"].map(logo => (
                    <img
                      key={logo}
                      src={`/logos/${logo}.png`}
                      alt={logo}
                      style={{
                        height: isMobile ? "28px" : "40px",
                        objectFit: "contain",
                        opacity: 0.8,
                        transition: "opacity 0.3s",
                        flexShrink: 0,
                      }}
                      onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                      onMouseLeave={e => e.currentTarget.style.opacity = "0.8"}
                    />
                  ))}
                </div>
              ))}
            </motion.div>
          </div>
        </motion.div>
      </motion.div>

      <style>{`
        @keyframes heroPulse {
          0%, 100% { box-shadow: 0 0 0 3px rgba(34,197,94,0.25); }
          50% { box-shadow: 0 0 0 6px rgba(34,197,94,0.08); }
        }
      `}</style>
    </section>
  );
};

/* ═══════════════════════════════════════════════════
   FEATURES
   ═══════════════════════════════════════════════════ */
const FeatureRow = ({ f, i, isMobile }) => {
  const [hov, setHov] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay: i * 0.07, ease: [0.22, 1, 0.36, 1] }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "40px 1fr" : "56px 1fr auto",
        gap: isMobile ? "16px" : "24px",
        alignItems: "start",
        padding: isMobile ? "20px 12px" : "28px 16px",
        borderBottom: `1px solid ${T.border}`,
        background: hov ? `${T.accent}04` : "transparent",
        borderRadius: hov ? "8px" : "0",
        transition: "background 0.25s, border-radius 0.25s",
        cursor: "default",
        margin: isMobile ? "0 -12px" : "0 -16px",
      }}
    >
      <motion.span
        animate={{ color: hov ? T.accent : T.mutedLt }}
        transition={{ duration: 0.2 }}
        style={{ fontFamily: T.mono, fontSize: "0.7rem", fontWeight: 600, letterSpacing: "0.06em", paddingTop: "4px" }}
      >{f.num}</motion.span>

      <div>
        <h3 style={{
          fontFamily: T.sans, fontWeight: 700,
          fontSize: isMobile ? "0.95rem" : "1.05rem",
          color: T.ink, margin: "0 0 6px", letterSpacing: "-0.02em",
        }}>{f.title}</h3>
        <p style={{ fontFamily: T.sans, fontSize: "0.875rem", color: T.muted, lineHeight: 1.65, margin: 0 }}>
          {f.desc}
        </p>
      </div>

      {!isMobile && (
        <motion.div
          animate={{ x: hov ? 0 : 8, opacity: hov ? 1 : 0 }}
          transition={{ duration: 0.2 }}
          style={{ paddingTop: "4px" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
        </motion.div>
      )}
    </motion.div>
  );
};

const Features = ({ isMobile, isTablet }) => (
  <section id="platform" style={{
    background: T.bg,
    padding: isMobile ? "60px 20px" : isTablet ? "80px 32px" : "120px 40px",
    borderBottom: `1px solid ${T.border}`,
  }}>
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile || isTablet ? "1fr" : "280px 1fr",
        gap: isMobile ? "32px" : isTablet ? "48px" : "80px",
        alignItems: "start",
      }}>
        <div style={{ position: isMobile || isTablet ? "static" : "sticky", top: "120px" }}>
          <Tag>Platform</Tag>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            style={{
              fontFamily: T.serif,
              fontSize: isMobile ? "2rem" : isTablet ? "2.4rem" : "2.8rem",
              fontWeight: 400, color: T.ink,
              letterSpacing: "-0.04em", lineHeight: 1.15, margin: "0 0 20px",
            }}
          >
            Built for the whole hiring loop.
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            style={{ fontFamily: T.sans, fontSize: "0.95rem", color: T.muted, lineHeight: 1.65 }}
          >
            From first outreach to final decision — every step is covered, automated, and explainable.
          </motion.p>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {FEATURES.map((f, i) => <FeatureRow key={i} f={f} i={i} isMobile={isMobile} />)}
        </div>
      </div>
    </div>
  </section>
);

/* ═══════════════════════════════════════════════════
   BENTO STATS
   ═══════════════════════════════════════════════════ */
const BentoStats = ({ isMobile, isTablet }) => (
  <section style={{
    background: T.bgAlt,
    padding: isMobile ? "60px 20px" : isTablet ? "80px 32px" : "120px 40px",
    borderBottom: `1px solid ${T.border}`,
  }}>
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      <div style={{
        display: "flex", justifyContent: "space-between",
        alignItems: isMobile ? "flex-start" : "flex-end",
        marginBottom: isMobile ? "28px" : "56px",
        flexWrap: "wrap", gap: "24px",
        flexDirection: isMobile ? "column" : "row",
      }}>
        <div>
          <Tag>Impact</Tag>
          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            style={{
              fontFamily: T.serif,
              fontSize: isMobile ? "1.9rem" : "clamp(2rem, 4vw, 3rem)",
              fontWeight: 400, color: T.ink,
              letterSpacing: "-0.04em", lineHeight: 1.1, margin: 0,
            }}
          >
            Numbers that<br />
            <span style={{ fontStyle: "italic", color: T.accent }}>speak for themselves.</span>
          </motion.h2>
        </div>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.15 }}
          style={{
            fontFamily: T.sans, fontSize: "0.95rem", color: T.muted,
            maxWidth: isMobile ? "100%" : "320px", lineHeight: 1.65,
          }}
        >
          Live data from teams actively running campaigns on Interview.ai today.
        </motion.p>
      </div>

      <div style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr 1fr" : isTablet ? "repeat(2, 1fr)" : "repeat(4, 1fr)",
        gap: "12px",
      }}>
        {STATS.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 30, scale: 0.96 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -6, boxShadow: i === 0 ? "0 16px 40px rgba(98,101,244,0.35)" : "0 12px 32px rgba(0,0,0,0.08)" }}
            style={{
              background: i === 0 ? T.accent : T.bg,
              border: `1px solid ${i === 0 ? "transparent" : T.border}`,
              borderRadius: "16px",
              padding: isMobile ? "20px 16px" : "36px 28px",
              transition: "box-shadow 0.25s", cursor: "default",
            }}
          >
            <div style={{
              fontFamily: T.mono,
              fontSize: isMobile ? "1.6rem" : "clamp(2rem, 3vw, 2.8rem)",
              fontWeight: 600, letterSpacing: "-0.05em",
              color: i === 0 ? "#fff" : T.ink, lineHeight: 1, marginBottom: "10px",
            }}>
              <SlotCounter value={s.value} suffix={s.suffix} decimals={s.decimals} />
            </div>
            <div style={{
              fontFamily: T.sans, fontWeight: 700,
              fontSize: isMobile ? "0.75rem" : "0.85rem",
              color: i === 0 ? "rgba(255,255,255,0.85)" : T.ink, marginBottom: "4px",
            }}>
              {s.label}
            </div>
            <div style={{
              fontFamily: T.sans,
              fontSize: isMobile ? "0.68rem" : "0.75rem",
              color: i === 0 ? "rgba(255,255,255,0.55)" : T.muted,
            }}>
              {s.sub}
            </div>
          </motion.div>
        ))}

        {/* Quote card — full width */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.45, duration: 0.55 }}
          style={{
            gridColumn: "1 / -1",
            background: T.bgDark, borderRadius: "16px",
            padding: isMobile ? "28px 20px" : "40px 48px",
            display: "flex",
            flexDirection: isMobile ? "column" : "row",
            alignItems: isMobile ? "flex-start" : "center",
            justifyContent: "space-between",
            gap: isMobile ? "20px" : "32px",
          }}
        >
          <div>
            <div style={{
              fontFamily: T.mono, fontSize: "0.7rem",
              color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em",
              textTransform: "uppercase", marginBottom: "10px",
            }}>From our users</div>
            <p style={{
              fontFamily: T.serif,
              fontSize: isMobile ? "1.2rem" : "1.6rem",
              fontWeight: 400, color: "#fff",
              letterSpacing: "-0.03em", lineHeight: 1.3,
              margin: 0, maxWidth: "520px",
            }}>
              "We went from 3-week hiring cycles to{" "}
              <span style={{ color: T.accent, fontStyle: "italic" }}>6 days</span>.
              Our competitors can't keep up."
            </p>
          </div>
          <div style={{ flexShrink: 0 }}>
            <div style={{ fontFamily: T.sans, fontWeight: 700, fontSize: "0.9rem", color: "#fff" }}>James Okafor</div>
            <div style={{ fontFamily: T.sans, fontSize: "0.8rem", color: "rgba(255,255,255,0.45)" }}>Engineering Manager · NexaScale</div>
          </div>
        </motion.div>
      </div>
    </div>
  </section>
);

/* ═══════════════════════════════════════════════════
   HOW IT WORKS
   ═══════════════════════════════════════════════════ */
const STEP_THRESHOLDS = [0.05, 0.35, 0.65, 0.85];

const TimelineCard = ({ s, isVisible, isMobile }) => {
  const [hov, setHov] = useState(false);
  return (
    <motion.div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      whileHover={{ y: -4, boxShadow: "0 16px 40px rgba(0,0,0,0.09)" }}
      style={{
        background: hov ? T.bgAlt : T.bg,
        borderRadius: "14px",
        border: `1px solid ${hov ? T.borderAcc : T.border}`,
        padding: isMobile ? "20px" : "26px 30px",
        maxWidth: isMobile ? "100%" : "380px",
        width: isMobile ? "100%" : "auto",
        cursor: "default",
        transition: "background 0.2s, border-color 0.2s",
      }}
    >
      <div style={{
        display: "inline-flex", alignItems: "center", gap: "6px",
        marginBottom: "10px", background: `${T.accent}10`,
        borderRadius: "6px", padding: "4px 10px",
      }}>
        <span style={{ fontFamily: T.mono, fontSize: "0.6rem", color: T.accent, fontWeight: 700, letterSpacing: "0.06em" }}>
          STEP {s.num}
        </span>
      </div>
      <h3 style={{ fontFamily: T.sans, fontWeight: 700, fontSize: "1rem", color: T.ink, margin: "0 0 8px", letterSpacing: "-0.02em" }}>
        {s.title}
      </h3>
      <p style={{ fontFamily: T.sans, fontSize: "0.875rem", color: T.muted, lineHeight: 1.65, margin: 0 }}>
        {s.desc}
      </p>
    </motion.div>
  );
};

const HowItWorks = ({ isMobile, isTablet }) => {
  const sectionRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start 0.8", "end 0.4"],
  });
  const lineProgress = useSpring(scrollYProgress, { stiffness: 80, damping: 25 });
  const [visibleCards, setVisibleCards] = useState([false, false, false, false]);

  useEffect(() => {
    const unsub = lineProgress.on("change", (v) => {
      setVisibleCards(prev => {
        const next = STEP_THRESHOLDS.map(threshold => v >= threshold);
        if (next.some((val, idx) => val !== prev[idx])) return next;
        return prev;
      });
    });
    return unsub;
  }, [lineProgress]);

  const lineHeightPct = useTransform(lineProgress, [0, 1], ["0%", "100%"]);

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      style={{
        background: T.bg,
        padding: isMobile ? "60px 20px" : isTablet ? "80px 32px" : "120px 40px",
        borderBottom: `1px solid ${T.border}`,
        overflow: "hidden",
      }}
    >
      <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: isMobile ? "48px" : "80px" }}>
          <Tag>Workflow</Tag>
          <motion.h2
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
            style={{
              fontFamily: T.serif, fontWeight: 400,
              fontSize: isMobile ? "1.9rem" : "clamp(2.2rem, 4.5vw, 3.4rem)",
              color: T.ink, letterSpacing: "-0.04em", lineHeight: 1.12, margin: "0 0 16px",
            }}
          >
            From posting to hire —<br />
            <span style={{ fontStyle: "italic", color: T.accent }}>four steps, zero friction.</span>
          </motion.h2>
        </div>

        {/* Mobile: simple stacked cards */}
        {isMobile ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {HOW_STEPS.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
              >
                <TimelineCard s={s} isVisible={true} isMobile={true} />
              </motion.div>
            ))}
          </div>
        ) : (
          /* Tablet / Desktop: timeline layout */
          <div style={{ position: "relative" }}>
            <div style={{
              position: "absolute", left: "50%", top: "60px",
              transform: "translateX(-50%)", width: "2px",
              bottom: "60px", background: T.border, zIndex: 0,
            }} />
            <motion.div
              style={{
                position: "absolute", left: "50%", top: "60px",
                transform: "translateX(-50%)", width: "2px",
                height: lineHeightPct, bottom: "auto",
                background: `linear-gradient(to bottom, ${T.accent}, ${T.accentDk})`,
                transformOrigin: "top", zIndex: 1,
                boxShadow: `0 0 12px ${T.accent}60`,
              }}
            />
            <div style={{ display: "flex", flexDirection: "column" }}>
              {HOW_STEPS.map((s, i) => {
                const isLeft = i % 2 === 0;
                const isVisible = visibleCards[i];
                return (
                  <div
                    key={i}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 60px 1fr",
                      gap: "0", alignItems: "center",
                      minHeight: "160px",
                    }}
                  >
                    <div style={{ padding: "24px 40px 24px 0", display: "flex", justifyContent: "flex-end" }}>
                      {isLeft && (
                        <motion.div
                          initial={{ opacity: 0, x: -40, scale: 0.94 }}
                          animate={isVisible ? { opacity: 1, x: 0, scale: 1 } : { opacity: 0, x: -40, scale: 0.94 }}
                          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                        >
                          <TimelineCard s={s} isVisible={isVisible} isMobile={false} />
                        </motion.div>
                      )}
                    </div>
                    <div style={{ display: "flex", justifyContent: "center", zIndex: 2 }}>
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={isVisible ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
                        transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.1 }}
                        style={{
                          width: "44px", height: "44px", borderRadius: "50%",
                          background: isVisible ? T.accent : T.bg,
                          border: `2px solid ${isVisible ? T.accent : T.border}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontFamily: T.mono, fontSize: "0.65rem", fontWeight: 700,
                          color: isVisible ? "#fff" : T.muted, letterSpacing: "0.04em",
                          boxShadow: isVisible
                            ? `0 0 0 6px ${T.bg}, 0 0 0 8px ${T.accent}30, 0 0 20px ${T.accent}40`
                            : `0 0 0 6px ${T.bg}, 0 0 0 7px ${T.border}`,
                          transition: "all 0.4s ease",
                        }}
                      >{s.num}</motion.div>
                    </div>
                    <div style={{ padding: "24px 0 24px 40px" }}>
                      {!isLeft && (
                        <motion.div
                          initial={{ opacity: 0, x: 40, scale: 0.94 }}
                          animate={isVisible ? { opacity: 1, x: 0, scale: 1 } : { opacity: 0, x: 40, scale: 0.94 }}
                          transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                        >
                          <TimelineCard s={s} isVisible={isVisible} isMobile={false} />
                        </motion.div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

/* ═══════════════════════════════════════════════════
   TESTIMONIALS
   ═══════════════════════════════════════════════════ */
const TestimonialCard = ({ t }) => {
  const [hov, setHov] = useState(false);
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: T.bg, borderRadius: "16px",
        border: `1px solid ${hov ? T.borderAcc : T.border}`,
        padding: "24px", minWidth: "280px", maxWidth: "320px",
        flexShrink: 0,
        transform: hov ? "translateY(-4px)" : "translateY(0)",
        boxShadow: hov ? "0 12px 36px rgba(0,0,0,0.07)" : "none",
        transition: "transform 0.25s ease, box-shadow 0.25s ease, border-color 0.2s",
        cursor: "default",
      }}
    >
      <div style={{ display: "flex", gap: "3px", marginBottom: "14px" }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill={t.col}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
        ))}
      </div>
      <p style={{ fontFamily: T.sans, fontSize: "0.85rem", color: T.inkMid, lineHeight: 1.72, margin: "0 0 18px", fontStyle: "italic" }}>
        "{t.quote}"
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <div style={{
          width: "32px", height: "32px", borderRadius: "50%", flexShrink: 0,
          background: `${t.col}18`, border: `1.5px solid ${t.col}30`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: T.sans, fontWeight: 700, fontSize: "0.68rem", color: t.col,
        }}>{t.initials}</div>
        <div>
          <div style={{ fontFamily: T.sans, fontWeight: 700, fontSize: "0.8rem", color: T.ink }}>{t.author}</div>
          <div style={{ fontFamily: T.sans, fontSize: "0.7rem", color: T.muted }}>{t.role} · {t.co}</div>
        </div>
      </div>
    </div>
  );
};

const InfiniteRow = ({ items, direction = "left", speed = 35, bgColor }) => {
  const trackRef = useRef(null);
  const [paused, setPaused] = useState(false);
  const animRef = useRef(null);
  const posRef = useRef(0);
  const pausedRef = useRef(paused);

  useEffect(() => { pausedRef.current = paused; }, [paused]);

  const tripled = [...items, ...items, ...items];

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let singleWidth = 0;
    setTimeout(() => {
      const cards = track.children;
      singleWidth = 0;
      for (let i = 0; i < items.length; i++) {
        singleWidth += cards[i].getBoundingClientRect().width + 16;
      }
      posRef.current = direction === "left" ? 0 : -singleWidth;
      let lastTs = null;
      const step = (ts) => {
        if (!lastTs) lastTs = ts;
        const dt = ts - lastTs;
        lastTs = ts;
        if (!pausedRef.current) {
          const delta = (speed * dt) / 1000;
          posRef.current += direction === "left" ? -delta : delta;
          if (direction === "left" && posRef.current <= -singleWidth) posRef.current += singleWidth;
          if (direction === "right" && posRef.current >= 0) posRef.current -= singleWidth;
          if (track) track.style.transform = `translateX(${posRef.current}px)`;
        }
        animRef.current = requestAnimationFrame(step);
      };
      animRef.current = requestAnimationFrame(step);
    }, 100);
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [direction, speed, items.length]);

  return (
    <div
      style={{ overflow: "hidden", position: "relative" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0, width: "80px",
        background: `linear-gradient(to right, ${bgColor || T.bgAlt}, transparent)`,
        zIndex: 2, pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", right: 0, top: 0, bottom: 0, width: "80px",
        background: `linear-gradient(to left, ${bgColor || T.bgAlt}, transparent)`,
        zIndex: 2, pointerEvents: "none",
      }} />
      <div ref={trackRef} style={{ display: "flex", gap: "16px", width: "max-content", willChange: "transform" }}>
        {tripled.map((t, i) => (
          <TestimonialCard key={`${t.author}-${i}`} t={t} />
        ))}
      </div>
    </div>
  );
};

const Testimonials = ({ isMobile, isTablet }) => {
  const row1 = TESTIMONIALS.slice(0, 3);
  const row2 = TESTIMONIALS.slice(3, 6);

  return (
    <section id="customers" style={{
      background: T.bgAlt,
      padding: isMobile ? "60px 0" : isTablet ? "80px 0" : "120px 0",
      borderBottom: `1px solid ${T.border}`,
      overflow: "hidden",
    }}>
      <div style={{
        maxWidth: "1200px", margin: "0 auto",
        padding: isMobile ? "0 20px" : "0 40px",
      }}>
        <div style={{
          display: "flex",
          flexDirection: isMobile || isTablet ? "column" : "row",
          justifyContent: "space-between",
          alignItems: isMobile || isTablet ? "flex-start" : "flex-end",
          marginBottom: isMobile ? "28px" : "56px",
          gap: "24px",
        }}>
          <div>
            <Tag>Testimonials</Tag>
            <motion.h2
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              style={{
                fontFamily: T.serif, fontWeight: 400,
                fontSize: isMobile ? "1.9rem" : "clamp(2rem, 4vw, 3rem)",
                color: T.ink, letterSpacing: "-0.04em", lineHeight: 1.15, margin: 0,
              }}
            >
              What hiring teams<br />
              <span style={{ fontStyle: "italic", color: T.accent }}>actually say.</span>
            </motion.h2>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            {Array.from({ length: 5 }).map((_, i) => (
              <svg key={i} width="16" height="16" viewBox="0 0 24 24" fill={T.accent}><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            ))}
          </div>
        </div>
      </div>

      <div style={{
        display: "flex", flexDirection: "column",
        gap: "16px",
        paddingLeft: isMobile ? "20px" : "40px",
      }}>
        <InfiniteRow items={row1} direction="left" speed={32} bgColor={T.bgAlt} />
        <InfiniteRow items={row2} direction="right" speed={28} bgColor={T.bgAlt} />
      </div>
    </section>
  );
};

/* ═══════════════════════════════════════════════════
   CTA
   ═══════════════════════════════════════════════════ */
const CTA = ({ onGetStarted, onExploreDashboard, isMobile, isTablet }) => (
  <section id="pricing" style={{
    background: T.bg,
    padding: isMobile ? "60px 20px" : isTablet ? "80px 32px" : "120px 40px",
  }}>
    <div style={{ maxWidth: "900px", margin: "0 auto" }}>
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        style={{
          border: `1px solid ${T.border}`, borderRadius: "20px",
          padding: isMobile ? "40px 24px" : isTablet ? "60px 48px" : "80px 64px",
          position: "relative", overflow: "hidden",
          background: T.bgAlt,
        }}
      >
        <div style={{
          position: "absolute", right: "-20px", bottom: "-40px",
          fontFamily: T.serif, fontSize: isMobile ? "160px" : "260px",
          fontWeight: 400, color: `${T.accent}06`,
          lineHeight: 1, userSelect: "none", pointerEvents: "none",
          letterSpacing: "-0.06em",
        }}>→</div>

        <Tag>Get started</Tag>

        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          style={{
            fontFamily: T.serif, fontWeight: 400,
            fontSize: isMobile ? "2rem" : "clamp(2.2rem, 5vw, 4rem)",
            color: T.ink, letterSpacing: "-0.04em", lineHeight: 1.1,
            margin: "0 0 20px", maxWidth: "600px",
          }}
        >
          Ready to hire with<br />
          <span style={{ fontStyle: "italic", color: T.accent }}>actual intelligence?</span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          style={{
            fontFamily: T.sans,
            fontSize: isMobile ? "0.95rem" : "1.05rem",
            color: T.muted, marginBottom: "40px", lineHeight: 1.65,
            maxWidth: "480px",
          }}
        >
          Join 2,000+ companies using Interview.ai. Setup takes 5 minutes. Results are immediate.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}
        >
          <motion.button
            onClick={onGetStarted}
            whileHover={{ scale: 1.03, boxShadow: "0 8px 30px rgba(22,21,26,0.25)" }}
            whileTap={{ scale: 0.97 }}
            style={{
              fontFamily: T.sans, fontWeight: 700,
              fontSize: isMobile ? "0.875rem" : "0.95rem",
              padding: isMobile ? "13px 24px" : "15px 32px",
              borderRadius: "8px", border: "none",
              background: T.ink, color: "#fff",
              cursor: "pointer",
              boxShadow: "0 4px 20px rgba(22,21,26,0.2)",
              letterSpacing: "-0.01em",
            }}
          >
            Start free trial →
          </motion.button>
          <motion.button
            onClick={onExploreDashboard}
            whileHover={{ scale: 1.03, borderColor: T.accent, color: T.accent }}
            whileTap={{ scale: 0.97 }}
            style={{
              fontFamily: T.sans, fontWeight: 600,
              fontSize: isMobile ? "0.875rem" : "0.95rem",
              padding: isMobile ? "13px 24px" : "15px 32px",
              borderRadius: "8px",
              border: `1.5px solid ${T.border}`, background: "transparent",
              color: T.inkMid, cursor: "pointer",
              transition: "border-color 0.2s, color 0.2s",
            }}
          >
            See a demo
          </motion.button>
        </motion.div>
      </motion.div>
    </div>
  </section>
);

/* ═══════════════════════════════════════════════════
   ROOT
   ═══════════════════════════════════════════════════ */
const HomeContent = ({ onGetStarted, onExploreDashboard }) => {
  const [windowWidth, setWindowWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 1200
  );

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobile = windowWidth <= 768;
  const isTablet = windowWidth > 768 && windowWidth <= 1024;

  return (
    <div id="top-anchor" style={{ fontFamily: T.sans, background: T.bg, overflowX: "hidden" }}>
      <Hero
        onGetStarted={onGetStarted}
        onExploreDashboard={onExploreDashboard}
        isMobile={isMobile}
        isTablet={isTablet}
      />
      <Features isMobile={isMobile} isTablet={isTablet} />
      <BentoStats isMobile={isMobile} isTablet={isTablet} />
      <HowItWorks isMobile={isMobile} isTablet={isTablet} />
      <Testimonials isMobile={isMobile} isTablet={isTablet} />
      <CTA
        onGetStarted={onGetStarted}
        onExploreDashboard={onExploreDashboard}
        isMobile={isMobile}
        isTablet={isTablet}
      />

      <style>{`
        * { box-sizing: border-box; }
        
        /* Prevent horizontal overflow on all screens */
        body { overflow-x: hidden; }

        /* Smooth scrolling */
        html { scroll-behavior: smooth; }

        /* Touch-friendly tap targets */
        button { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }

        /* Prevent text size adjustment on iOS */
        body { -webkit-text-size-adjust: 100%; }

        /* iPhone SE and very small screens */
        @media (max-width: 380px) {
          /* Stack CTA buttons vertically */
          #pricing button {
            width: 100% !important;
            justify-content: center !important;
          }
        }

        /* All mobile phones */
        @media (max-width: 768px) {
          /* Hero BG image — very faint on mobile */
          .hero-bg-image {
            opacity: 0.06 !important;
          }

          /* Testimonial cards — slightly narrower on small screens */
          [data-testcard] {
            min-width: 260px !important;
            max-width: 290px !important;
          }
        }

        /* Tablets portrait */
        @media (min-width: 769px) and (max-width: 1024px) {
          /* Timeline uses stacked layout on tablets too for readability */
          .timeline-row {
            grid-template-columns: 1fr 52px 1fr !important;
          }
        }

        /* Reduced motion */
        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  );
};

export default HomeContent;