import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import InterviewSchedule from "../models/InterviewSchedule.js";
import FinalReport from "../models/FinalReport.js";
import admin from "../config/firebaseAdmin.js";
import multer from "multer";
import mongoose from "mongoose";

import { Resend } from "resend";
const resend = new Resend(process.env.RESEND_API_KEY);
console.log("Resend key loaded:", !!process.env.RESEND_API_KEY);
const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });


// -------------------------------------------------------------------
// 1. FIREBASE ADMIN SDK SETUP
// CRITICAL: This allows the backend to interact with Firebase Auth (e.g., update password)
// -------------------------------------------------------------------

// !! IMPORTANT: Ensure the path to your service account JSON file is correct !!
// This file should be in the same directory as auth.js, or path adjusted (e.g., '../serviceAccount.json')


// -------------------------------------------------------------------
// 2. EMAIL UTILITY: Send OTP
// -------------------------------------------------------------------

// In your auth.js file, update the email transporter configuration

const sendOtpEmail = async (email, otp) => {
  const result = await resend.emails.send({
    from: "onboarding@resend.dev",
    to: email,
    subject: "Interview.ai :your one-time password (OTP)",
    text: `Your OTP is ${otp}. It is valid for 10 minutes.`,
    html: `
      <h2>Your OTP: ${otp}</h2>
      <p>This code expires in 10 minutes.</p>
      <p>If you did not request this, please ignore.</p>
      <br/>
      <strong>Interview.ai</strong>
    `,
  });
  console.log("Resend result:", result);

};
// -------------------------------------------------------------------
// 3. AUTHENTICATE MIDDLEWARE (VERIFIES CUSTOM JWT)
// Used for ALL protected routes EXCEPT /login
// -------------------------------------------------------------------
async function authenticate(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: "No session token provided." });
  }

  try {
    // Verify the custom JWT signed with your JWT_SECRET
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Pass the UID to the next route handler (e.g., /profile)
    req.firebaseUser = { uid: decoded.uid };
    next();
  } catch (err) {
    console.error("Custom JWT Verification Failed:", err.message);
    return res.status(401).json({ error: "Invalid or expired session token." });
  }
}


// -------------------------------------------------------------------
// 4. ROUTES
// -------------------------------------------------------------------

// POST /register
// Expects form data + Firebase-generated UID from the client.
router.post("/register", async (req, res) => {
  try {
    // Must contain all fields, including UID from Firebase.
    const { username, email, password, usertype, uid, company_name } = req.body;
    const normalizedCompanyName = String(company_name || "").trim() || "Interview.ai";

    // Basic Check for all required fields (uid is often forgotten)
    if (!username || !email || !password || !usertype || !uid) {
      console.error("Registration Error: Missing one or more required fields.");
      return res.status(400).json({ error: "Missing required registration fields (username, email, password, usertype, or uid)." });
    }

    // 1. Hashing password for MongoDB
    const hashedPassword = await bcrypt.hash(password, 10);

    // 2. Generate and store OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      if (existingUser.isVerified) {
        return res.status(409).json({ error: "Username or email already exists." });
      } else {
        // Update the pending user with the new registration details
        existingUser.username = username;
        existingUser.password = hashedPassword;
        existingUser.uid = uid;
        existingUser.company_name = normalizedCompanyName;
        existingUser.otp = otp;
        existingUser.otpExpires = otpExpires;
        await existingUser.save();

        await sendOtpEmail(email, otp);
        return res.json({ message: "Registration successful. OTP sent.", email: email });
      }
    }

    // 3. Create the user in MongoDB
    const user = new User({
      username,
      uid, // IMPORTANT: The unique Firebase User ID
      email,
      password: hashedPassword,
      usertype,
      company_name: normalizedCompanyName,
      otp,
      otpExpires,
    });

    await user.save();

    // 4. Send OTP (If this line fails, it's a 500 error due to environment or config)
    await sendOtpEmail(email, otp);

    // 5. Respond with success
    res.json({ message: "Registration successful. OTP sent.", email: email });

  } catch (err) {
    // Log the error for server-side debugging
    console.error("Backend Registration Error (500):", err);

    // Handle MongoDB duplication errors (username/email unique fields)
    if (err.code === 11000) {
      return res.status(409).json({ error: "Username or email already exists." });
    }

    // Return a generic 500 error for all other crashes (DB connection, Nodemailer crash, etc.)
    res.status(500).json({ error: "Internal Server Error during registration. Check server console for details." });
  }
});


// POST /check-pending
router.post("/check-pending", async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (user) {
      if (!user.isVerified) {
        // User exists but is not verified!
        // Generate new OTP and resend
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        user.otp = otp;
        user.otpExpires = Date.now() + 10 * 60 * 1000;
        await user.save();
        await sendOtpEmail(email, otp);
        return res.json({ pending: true, message: "Pending registration found. New OTP sent." });
      } else {
        return res.json({ pending: false, status: "verified" });
      }
    } else {
      // User not in MongoDB. Check if orphaned in Firebase to break deadlock.
      try {
        const firebaseUser = await admin.auth().getUserByEmail(email);
        if (firebaseUser) {
          await admin.auth().deleteUser(firebaseUser.uid);
          console.log(`Deleted orphaned Firebase user: ${email}`);
          return res.json({ pending: false, clearedOrphan: true, message: "Cleaned up orphaned session. Please try registering again." });
        }
      } catch (fbErr) {
        // User not found in Firebase either, ignore
      }
      return res.json({ pending: false, status: "not_found" });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// POST /login (NO AUTHENTICATE MIDDLEWARE)
// Expects UID from client after client-side Firebase Auth.
router.post("/login", async (req, res) => {
  // Client sends the UID obtained after a successful Firebase login.
  const { uid } = req.body;

  if (!uid) {
    return res.status(400).json({ error: "Missing required UID." });
  }

  try {
    // Find user in MongoDB using the UID
    const user = await User.findOne({ uid: uid });

    if (!user) {
      return res.status(404).json({ error: "User not found in database. Please register." });
    }

    if (!user.isVerified) {
      return res.status(403).json({ error: "Please verify your email using the OTP sent to your registered address.", email: user.email });
    }

    // Create your custom JWT (Session Token)
    const token = jwt.sign(
      { id: user._id, uid: user.uid, usertype: user.usertype },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Send the custom JWT back to the client
    // CORRECTED RESPONSE:
    res.json({
      token,
      message: "Login Successful",
      userId: user._id // <--- ADD THIS LINE (Sends the MongoDB ID)
    });

  } catch (err) {
    console.error("Server Login Error:", err);
    res.status(500).json({ error: "Server error during session creation." });
  }
});


// POST /verify-otp
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.otp !== otp || user.otpExpires < Date.now()) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    // Clear OTP fields and set isVerified to true
    user.otp = null;
    user.otpExpires = null;
    user.isVerified = true;
    await user.save();

    // ISSUE JWT AFTER SUCCESSFUL VERIFICATION (optional, but good practice)
    const token = jwt.sign(
      { id: user._id, uid: user.uid, usertype: user.usertype },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ message: "OTP Verified!", token: token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// GET /profile (Protected: requires custom JWT)
router.get('/profile', authenticate, async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.firebaseUser.uid }).select('-password -otp -otpExpires -__v');

    if (!user) {
      return res.status(404).json({ error: "User profile not found." });
    }

    res.json(user);
  } catch (err) {
    console.error("GET Profile Error:", err);
    res.status(500).json({ error: "Failed to fetch user profile." });
  }
});


// PUT /profile (Protected: requires custom JWT)
router.put('/profile', authenticate, async (req, res) => {
  const { username, email, newPassword } = req.body;
  const firebaseUid = req.firebaseUser.uid;

  try {
    // 1. Prepare updates for MongoDB
    const mongoUpdate = {};
    if (username) mongoUpdate.username = username;
    if (email) mongoUpdate.email = email;

    // 2. Update MongoDB (Username and Email)
    if (Object.keys(mongoUpdate).length > 0) {
      await User.updateOne({ uid: firebaseUid }, { $set: mongoUpdate });
    }

    // 3. Handle Password Update (Firebase Auth)
    if (newPassword) {
      // Use Firebase Admin SDK to update the password in Firebase Auth
      await admin.auth().updateUser(firebaseUid, { password: newPassword });
    }

    // 4. Send Success Response
    res.json({ message: "Profile updated successfully." });

  } catch (err) {
    console.error("PUT Profile Error:", err);
    if (err.code === 11000) {
      return res.status(409).json({ error: "Username or Email is already taken." });
    }
    res.status(500).json({ error: "Failed to update profile." });
  }
});


router.post('/generate', async (req, res) => {
  try {
    const { interviewerId, interviewDate, startTime, data } = req.body;

    // Extract emails from the uploaded CSV data
    const candidateEmails = data && data.length > 0
      ? data.map(row => row.email).filter(email => email) // Extract and filter out empty emails
      : [];

    // Validate that we have at least one email
    if (candidateEmails.length === 0) {
      return res.status(400).json({
        message: 'Please upload a CSV file with at least one valid email address.'
      });
    }

    // 1. Create a new schedule document
    const newSchedule = new InterviewSchedule({
      interviewerId, // This links the session back to the HR/Company
      scheduledDate: interviewDate,
      startTime,

      candidateEmails: candidateEmails, // Store emails as array
      status: 'Scheduled'
    });

    // 2. Save to MongoDB
    const savedSchedule = await newSchedule.save();

    // 3. Send the unique ID back to the frontend
    res.status(201).json({
      message: 'Link generated successfully',
      sessionId: savedSchedule._id,
      candidatesCount: candidateEmails.length // Optional: send back count for confirmation
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error generating interview link.' });
  }
});

router.get("/check_session/:sessionId/:email", async (req, res) => {
  try {
    const { sessionId, email } = req.params;

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({ emailExists: false, message: "Invalid sessionId" });
    }

    const session = await InterviewSchedule.findById(sessionId);
    if (!session) return res.json({ emailExists: false });

    const emailExists = session.candidateEmails.includes(email.toLowerCase());

    return res.json({ emailExists, interviewerId: session.interviewerId, startTime: session.startTime, scheduledDate: session.scheduledDate });

  } catch (error) {
    console.error("Check session error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});
router.get("/check_session/:sessionId", async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({ message: "Invalid sessionId" });
    }
    const session = await InterviewSchedule.findById(sessionId);
    if (!session) return res.status(404).json({ message: "Session not found" });
    return res.json({ interviewerId: session.interviewerId, startTime: session.startTime, scheduledDate: session.scheduledDate });
  } catch (error) {
    console.error("Check session error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.post("/create-report", async (req, res) => {
  try {
    const { sessionId, interviewerId, name, email, yearOfStudy } = req.body;

    // if (!sessionId || !interviewerId  || !email) {
    //   return res.status(400).json({ success: false, message: "Missing required fields" });
    // }

    const report = new FinalReport({
      sessionId,
      interviewerId,

      candidate_overview: {
        name,
        email,

        yearOfStudy

      }
    });

    await report.save();

    res.status(201).json({
      success: true,
      message: "Report created successfully",
      reportId: report._id
    });

  } catch (error) {
    console.error("Error creating report:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
router.put("/update-report/:reportId", async (req, res) => {
  const report = req.body;
  const { reportId } = req.params;
  try {
    console.log("Update report payload:", JSON.stringify(report, null, 2)); // DEBUG
    if (!mongoose.Types.ObjectId.isValid(reportId)) {
      return res.status(400).json({ message: "Invalid reportId" });
    }
    // Normalize payload: support both { final_report: {...} } and direct report object
    const payload = report.final_report || report;
    console.log("Normalized payload:", JSON.stringify(payload, null, 2)); // DEBUG

    // Build update map with safe optional chaining (handles missing fields)
    const updates = {
      "candidate_overview.summary": payload.candidate_overview?.summary,
      "overall_performance.score": payload.overall_performance?.average_score,
      "overall_performance.performance_level": payload.overall_performance?.performance_level,
      "overall_performance.summary": payload.overall_performance?.summary,
      strengths: payload.strengths,
      weaknesses: payload.weaknesses,
      // Support both capitalized and lowercase section keys from frontend
      "section_wise_evaluation.hr.score": payload.section_wise_evaluation?.HR?.average_score ?? payload.section_wise_evaluation?.HR?.average_score,
      "section_wise_evaluation.hr.feedback": payload.section_wise_evaluation?.HR?.feedback ?? payload.section_wise_evaluation?.HR?.feedback,
      "section_wise_evaluation.general.score": payload.section_wise_evaluation?.General?.average_score ?? payload.section_wise_evaluation?.General?.average_score,
      "section_wise_evaluation.general.feedback": payload.section_wise_evaluation?.General?.feedback ?? payload.section_wise_evaluation?.General?.feedback,
      "section_wise_evaluation.technical.score": payload.section_wise_evaluation?.Technical?.average_score ?? payload.section_wise_evaluation?.Technical?.average_score,
      "section_wise_evaluation.technical.feedback": payload.section_wise_evaluation?.Technical?.feedback ?? payload.section_wise_evaluation?.Technical?.feedback,
      "final_recommendation.decision": payload.final_recommendation?.decision,
      "final_recommendation.justification": payload.final_recommendation?.justification,

      // Proctoring and Face Analysis Updates
      "face_analysis.confidence_score": payload.face_analysis?.confidence_score ?? report.face_analysis?.confidence_score,
      "face_analysis.dominant_emotion": payload.face_analysis?.dominant_emotion ?? report.face_analysis?.dominant_emotion,
      "face_analysis.last_emotion": payload.face_analysis?.last_emotion ?? report.face_analysis?.last_emotion,
      "face_analysis.verification_rate": payload.face_analysis?.verification_rate ?? report.face_analysis?.verification_rate,
      "face_analysis.verification_status": payload.face_analysis?.verification_status ?? report.face_analysis?.verification_status,
      "face_analysis.behavior_assessment": payload.face_analysis?.behavior_assessment ?? report.face_analysis?.behavior_assessment,
      "face_analysis.proctoring_severity": payload.face_analysis?.proctoring_severity ?? report.face_analysis?.proctoring_severity,
      "face_analysis.verified_frames": payload.face_analysis?.verified_frames ?? report.face_analysis?.verified_frames,
      "face_analysis.total_frames": payload.face_analysis?.total_frames ?? report.face_analysis?.total_frames,
      "face_analysis.cheating_reason_counts": payload.face_analysis?.cheating_reason_counts ?? report.face_analysis?.cheating_reason_counts,
      "face_analysis.cheating_reason_seconds": payload.face_analysis?.cheating_reason_seconds ?? report.face_analysis?.cheating_reason_seconds,
      "face_analysis.cheating_summary": payload.face_analysis?.cheating_summary ?? report.face_analysis?.cheating_summary,

      // Candidate decision status
      decision_status: payload.decision_status ?? report.decision_status,
      cheating_detected: payload.cheating_detected ?? (payload.face_analysis?.proctoring_severity === "serious" ? true : undefined) ?? report.cheating_detected,
      cheating_reason: payload.cheating_reason ?? (payload.face_analysis?.cheating_summary?.primary_reason ?? undefined) ?? report.cheating_reason
    };

    // Remove undefined values so we don't overwrite with undefined in MongoDB
    Object.keys(updates).forEach(key => {
      if (updates[key] === undefined) delete updates[key];
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: "No valid report fields provided to update." });
    }

    const updatedReport = await FinalReport.findByIdAndUpdate(
      reportId,
      { $set: updates },
      { new: true, upsert: true }
    );

    if (!updatedReport) {
      return res.status(404).json({ success: false, message: "Report not found" });
    }

    // Return updated report
    return res.json({ success: true, message: "Report updated successfully", report: updatedReport });

  } catch (error) {
    console.error("Error updating report:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
})
router.get('/candidates/:userId', async (req, res) => {
  try {
    // Search by interviewerId (the HR/Interviewer ID) instead of userId
    const candidates = await FinalReport.find({ interviewerId: req.params.userId });
    res.json(candidates);
  } catch (error) {
    console.error('Error fetching candidates:', error);
    res.status(500).json({ message: 'Server error' });
  }
});
router.post("/candidate-action", async (req, res) => {
  try {
    const {
      candidateId,
      candidateEmail,
      candidateName,
      action,
      companyName,
      interviewerId,
    } = req.body;

    if (!candidateEmail || !action || !companyName || !candidateId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // 1️⃣ Update FinalReport with decision
    const updatedReport = await FinalReport.findByIdAndUpdate(
      candidateId,
      {
        decision_status: action, // selected / rejected
        company_name: companyName,
        decision_date: new Date(),
        decided_by: interviewerId,
      },
      { new: true, upsert: true }
    );

    // 2️⃣ Email content
    const emailSubject =
      action === "selected"
        ? `🎉 Congratulations! You have been Selected by ${companyName}`
        : `Interview Update: Your Status with ${companyName}`;

    const emailBody =
      action === "selected"
        ? `
          <h2>Congratulations ${candidateName}!</h2>
          <p>You have been <strong>SELECTED</strong> by <strong>${companyName}</strong>.</p>
          <p>We will contact you soon with further details.</p>
          <br/>
          <strong>Interview.ai Team</strong>
        `
        : `
          <h2>Interview Update</h2>
          <p>Dear ${candidateName},</p>
          <p>Thank you for interviewing with <strong>${companyName}</strong>.</p>
          <p>Unfortunately, we will not be moving forward at this time.</p>
          <p>We wish you all the best.</p>
          <br/>
          <strong>Interview.ai Team</strong>
        `;

    await resend.emails.send({
      from: "onboarding@resend.dev",
      to: candidateEmail,
      subject: emailSubject,
      html: emailBody,
    });

    // 4️⃣ Populate decided_by details
    const populatedReport = await FinalReport.findById(updatedReport._id).populate(
      "decided_by",
      "name email"
    );

    res.json({
      success: true,
      message: `Candidate ${action} successfully. Email sent.`,
      updatedReport: populatedReport,
    });
  } catch (error) {
    console.error("Error processing candidate action:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

export default router;
