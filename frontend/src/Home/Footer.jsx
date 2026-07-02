import { motion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { Link } from 'react-router-dom';

const C = {
  indigo: "#6265F4",
  indigoDark: "#4B4EC8",
  ink: "#0D0D1A",
  muted: "#6B7280",
  mutedLight: "#9CA3AF",
  borderLight: "rgba(0,0,0,0.07)",
  surface: "#F7F7FC",
};

export default function Footer({ onProductNavigate }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });

  // ✅ Removed unused windowWidth, width, and isMobile declarations

  const cols = [
    {
      heading: "Product",
      links: [
        { label: "Features", target: "platform" },
        { label: "Pricing", target: "pricing" },
        { label: "How It Works", target: "how-it-works" },
      ],
    },
    {
      heading: "Company",
      links: [
        { label: "About", href: "#top-anchor" },
        { label: "Privacy Policy", href: "#privacy-policy" },
        { label: "Terms of Service", href: "#terms-of-service" },
        { label: "Contact", href: "#contact" },
      ],
    },
  ];

  const handleProductClick = (target) => {
    if (onProductNavigate) { onProductNavigate(target); return; }
    const el = document.getElementById(target);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <footer style={{ background: "#fff", borderTop: `1px solid ${C.borderLight}`, fontFamily: "'Sora', sans-serif" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "48px 20px 28px" }}>

        {/* Main grid */}
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 24 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: "32px",
            marginBottom: "40px",
          }}
          className="footer-grid"
        >
          {/* Brand column */}
          <div>
            <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: "10px", textDecoration: "none", marginBottom: "14px" }}>
              <motion.div
                whileHover={{ scale: 1.08 }}
                transition={{ type: "spring", stiffness: 400, damping: 15 }}
                style={{
                  width: "36px", height: "36px", borderRadius: "10px",
                  background: `linear-gradient(135deg, ${C.indigo}, ${C.indigoDark})`,
                  boxShadow: `0 4px 12px ${C.indigo}45`,
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <path d="M9.18083 2.345C9.21654 2.15384 9.31798 1.98118 9.46758 1.85693C9.61718 1.73268 9.80553 1.66467 10 1.66467C10.1945 1.66467 10.3828 1.73268 10.5324 1.85693C10.682 1.98118 10.7835 2.15384 10.8192 2.345L11.695 6.97667C11.7572 7.30596 11.9172 7.60885 12.1542 7.84581C12.3912 8.08277 12.694 8.2428 13.0233 8.305L17.655 9.18083C17.8462 9.21654 18.0188 9.31798 18.1431 9.46758C18.2673 9.61718 18.3353 9.80553 18.3353 10C18.3353 10.1945 18.2673 10.3828 18.1431 10.5324C18.0188 10.682 17.8462 10.7835 17.655 10.8192L13.0233 11.695C12.694 11.7572 12.3912 11.9172 12.1542 12.1542C11.9172 12.3912 11.7572 12.694 11.695 13.0233L10.8192 17.655C10.7835 17.8462 10.682 18.0188 10.5324 18.1431C10.3828 18.2673 10.1945 18.3353 10 18.3353C9.80553 18.3353 9.61718 18.2673 9.46758 18.1431C9.31798 18.0188 9.21654 17.8462 9.18083 17.655L8.305 13.0233C8.2428 12.694 8.08277 12.3912 7.84581 12.1542C7.60885 11.9172 7.30596 11.7572 6.97667 11.695L2.345 10.8192C2.15384 10.7835 1.98118 10.682 1.85693 10.5324C1.73268 10.3828 1.66467 10.1945 1.66467 10C1.66467 9.80553 1.73268 9.61718 1.85693 9.46758C1.98118 9.31798 2.15384 9.21654 2.345 9.18083L6.97667 8.305C7.30596 8.2428 7.60885 8.08277 7.84581 7.84581C8.08277 7.60885 8.2428 7.30596 8.305 6.97667L9.18083 2.345Z"
                    stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667"/>
                  <path d="M16.6667 1.66667V5" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667"/>
                  <path d="M18.3333 3.33333H15" stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667"/>
                  <path d="M3.33333 18.3333C4.25381 18.3333 5 17.5871 5 16.6667C5 15.7462 4.25381 15 3.33333 15C2.41286 15 1.66667 15.7462 1.66667 16.6667C1.66667 17.5871 2.41286 18.3333 3.33333 18.3333Z"
                    stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.66667"/>
                </svg>
              </motion.div>
              <span style={{ fontWeight: 700, fontSize: "1.05rem", color: C.ink, letterSpacing: "-0.03em" }}>
                Interview<span style={{ color: C.indigo }}>.ai</span>
              </span>
            </Link>

            <p style={{ fontSize: "0.875rem", color: C.muted, lineHeight: 1.7, maxWidth: "320px", margin: "0 0 20px" }}>
              AI-powered platform by SuPrazo Technologies. Automating HR workflows and candidate assessments at scale.
            </p>

            <div style={{ display: "flex", gap: "8px" }}>
              {[
                { label: "LinkedIn", href: "https://www.linkedin.com/company/suprazo-technologies/", path: "M16 8a6 6 0 016 6v7h-4v-7a2 2 0 00-2-2 2 2 0 00-2 2v7h-4v-7a6 6 0 016-6zM2 9h4v12H2z M4 6a2 2 0 100-4 2 2 0 000 4z" },
                { label: "Instagram", href: "https://www.instagram.com/suprazo.official?igsh=MTk3bWVtdzl5bTd2bA==", path: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.051C.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" },
              ].map((s) => (
                <motion.a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  whileHover={{ y: -2, background: `${C.indigo}12` }}
                  style={{
                    width: "40px", height: "40px", borderRadius: "8px",
                    border: `1px solid ${C.borderLight}`, background: C.surface,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    transition: "all 0.2s", color: C.muted,
                    touchAction: "manipulation",
                  }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                    <path d={s.path} />
                  </svg>
                </motion.a>
              ))}
            </div>
          </div>

          {/* Link columns — side by side on mobile */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
            {cols.map((col, ci) => (
              <motion.div
                key={col.heading}
                initial={{ opacity: 0, y: 16 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.1 + ci * 0.08, ease: [0.22, 1, 0.36, 1] }}
              >
                <p style={{
                  fontWeight: 700, fontSize: "0.8rem", color: C.ink,
                  letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: "14px",
                }}>
                  {col.heading}
                </p>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
                  {col.links.map((item) => (
                    <li key={item.label}>
                      {item.target ? (
                        <motion.button
                          type="button"
                          onClick={() => handleProductClick(item.target)}
                          whileHover={{ color: C.indigo }}
                          style={{
                            fontSize: "0.875rem", color: C.muted, background: "transparent",
                            border: 0, padding: 0, fontFamily: "'Sora', sans-serif",
                            textAlign: "left", display: "inline-block",
                            transition: "color 0.15s", cursor: "pointer",
                            touchAction: "manipulation",
                          }}
                        >
                          {item.label}
                        </motion.button>
                      ) : (
                        <motion.a
                          href={item.href}
                          whileHover={{ color: C.indigo }}
                          style={{
                            fontSize: "0.875rem", color: C.muted, textDecoration: "none",
                            display: "inline-block", transition: "color 0.15s",
                          }}
                        >
                          {item.label}
                        </motion.a>
                      )}
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Bottom bar */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.5, delay: 0.35 }}
          style={{
            borderTop: `1px solid ${C.borderLight}`,
            paddingTop: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <p style={{ fontSize: "0.78rem", color: C.mutedLight, margin: 0, textAlign: "center" }}>
            © {new Date().getFullYear()} Interview.ai · SuPrazo Technologies. All rights reserved.
          </p>
        </motion.div>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .footer-grid {
            grid-template-columns: 2fr 1fr 1fr !important;
            gap: 48px !important;
          }
          .footer-grid > div:last-child {
            display: contents;
          }
        }
        @media (max-width: 374px) {
          .footer-grid > div:last-child {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </footer>
  );
}