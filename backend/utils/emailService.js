import nodemailer from "nodemailer";

// ─────────────────────────────────────────────────────────────────────────────
// TRANSPORTER — Singleton with connection pooling + rate limiting
// ─────────────────────────────────────────────────────────────────────────────
// To switch from Gmail to a custom SMTP provider, replace the block below with:
//
//   host:    "smtp.your-provider.com",   // e.g. smtp.sendgrid.net
//   port:    465,
//   secure:  true,                       // true for port 465, false for 587
//   auth: {
//     user:  process.env.SMTP_USER,
//     pass:  process.env.SMTP_PASS,
//   },
//
// and remove the `service: "gmail"` line.
// ─────────────────────────────────────────────────────────────────────────────

let transporter = null;

const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      // ── SMTP placeholders (swap `service` for host/port/secure in production) ──
      service: "gmail",               // Remove when using custom SMTP host
      // host:   "smtp.your-provider.com",
      // port:   465,
      // secure: true,

      // ── Connection pool ──────────────────────────────────────────────────────
      pool:           true,           // Reuse connections instead of opening new ones
      maxConnections: 3,              // Max simultaneous SMTP connections
      maxMessages:    100,            // Max emails per connection before recycling

      // ── Rate limiter ─────────────────────────────────────────────────────────
      rateDelta:      1000,           // Time window in ms (1 second)
      rateLimit:      5,              // Max messages sent per rateDelta window

      // ── Auth ─────────────────────────────────────────────────────────────────
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },

      // ── Timeouts ─────────────────────────────────────────────────────────────
      connectionTimeout: 15000,       // 15 s to establish connection
      greetingTimeout:   15000,       // 15 s to receive SMTP greeting
      socketTimeout:     30000,       // 30 s of inactivity before timeout
    });

    // Verify connection on first initialisation (non-blocking, only logs)
    transporter.verify((err) => {
      if (err) {
        console.error("⚠️  Email transporter connection error:", err.message);
      } else {
        console.log("✅ Email transporter ready (pool active)");
      }
    });
  }

  return transporter;
};

// ─────────────────────────────────────────────────────────────────────────────
// SEND OTP EMAIL
// ─────────────────────────────────────────────────────────────────────────────
export const sendOtpEmail = async (email, otp) => {
  const mailOptions = {
    from:    `"Interview.ai" <${process.env.EMAIL_SENDER || process.env.GMAIL_USER}>`,
    to:      email,
    subject: "Interview.ai: Your One-Time Password (OTP)",
    text:    `Your OTP is ${otp}. It is valid for 10 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Your OTP: ${otp}</h2>
        <p>This code expires in 10 minutes.</p>
        <p>If you did not request this, please ignore.</p>
        <p style="font-size: 12px; color: #666;">Interview.ai</p>
      </div>
    `,
  };

  try {
    const info = await getTransporter().sendMail(mailOptions);
    console.log("✅ OTP email sent:", info.messageId);
    return info;
  } catch (error) {
    console.error("❌ Error sending OTP email:", error.message);
    throw new Error("Failed to send OTP email");
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SEND CANDIDATE EMAIL  (single, on-demand)
// ─────────────────────────────────────────────────────────────────────────────
export const sendCandidateEmail = async (email, subject, htmlBody) => {
  const mailOptions = {
    from:    `"Interview.ai" <${process.env.EMAIL_SENDER || process.env.GMAIL_USER}>`,
    to:      email,
    subject,
    html:    htmlBody,
  };

  try {
    const info = await getTransporter().sendMail(mailOptions);
    return info;
  } catch (error) {
    console.error(`❌ Error sending candidate email to ${email}:`, error.message);
    throw new Error(`Failed to send email to ${email}`);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SEND BATCH EMAILS  (daily dispatch — sequential, memory-safe)
//
// @param {Array}  users        — Array of user objects
// @param {string} users[].email     — Recipient email address
// @param {string} users[].name      — Recipient display name
// @param {string} [subject]   — Override default subject (optional)
// @param {Function} [buildHtml] — (user) => htmlString builder (optional)
//
// Uses a for...of loop (NOT Promise.all) so:
//   • The connection pool is leveraged without creating N parallel promises
//   • Memory buffer is never flooded by thousands of simultaneous sends
//   • A single bad address never crashes the whole batch
// ─────────────────────────────────────────────────────────────────────────────
export const sendBatchEmails = async (
  users,
  subject  = "A message from Interview.ai",
  buildHtml = (user) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #2563eb;">Hello, ${user.name || "there"}!</h2>
      <p>This is your daily update from <strong>Interview.ai</strong>.</p>
      <hr/>
      <p style="font-size: 12px; color: #666;">© Interview.ai — You are receiving this because you are registered on our platform.</p>
    </div>
  `
) => {
  if (!Array.isArray(users) || users.length === 0) {
    console.warn("⚠️  sendBatchEmails: No users provided. Skipping batch.");
    return { sent: 0, failed: 0, errors: [] };
  }

  const results = { sent: 0, failed: 0, errors: [] };
  const total   = users.length;

  console.log(`📧 Starting batch email dispatch — ${total} recipient(s)`);

  // Sequential loop: waits for each send to complete before the next one.
  // The pool (maxConnections: 3) naturally handles concurrency internally.
  for (const user of users) {
    if (!user?.email) {
      console.warn("⚠️  Skipping entry with no email address:", user);
      results.failed++;
      results.errors.push({ user, reason: "Missing email address" });
      continue;
    }

    try {
      const info = await getTransporter().sendMail({
        from:    `"Interview.ai" <${process.env.EMAIL_SENDER || process.env.GMAIL_USER}>`,
        to:      user.email,
        subject,
        html:    buildHtml(user),
      });

      results.sent++;
      console.log(`  ✅ [${results.sent + results.failed}/${total}] Sent → ${user.email} (${info.messageId})`);
    } catch (error) {
      // One failure must never stop the rest of the batch
      results.failed++;
      results.errors.push({ email: user.email, reason: error.message });
      console.error(`  ❌ [${results.sent + results.failed}/${total}] Failed → ${user.email}: ${error.message}`);
    }
  }

  console.log(
    `📊 Batch complete — ✅ ${results.sent} sent, ❌ ${results.failed} failed out of ${total} total`
  );

  return results;
};

// ─────────────────────────────────────────────────────────────────────────────
// Export the raw transporter for advanced/custom use cases
// ─────────────────────────────────────────────────────────────────────────────
export { getTransporter };
