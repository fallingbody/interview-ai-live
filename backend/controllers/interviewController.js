import mongoose from "mongoose";
import InterviewSchedule from "../models/InterviewSchedule.js";
import { splitCandidatesIntoBatches } from "../utils/interviewUtils.js";

// POST /generate
export const generateLink = async (req, res) => {
  try {
    const { interviewerId, interviewDate, startTime, data } = req.body;

    const candidateEmails = data && data.length > 0
      ? data.map(row => row.email).filter(email => email)
      : [];

    if (candidateEmails.length === 0) {
      return res.status(400).json({
        message: 'Please upload a CSV file with at least one valid email address.'
      });
    }

    const newSchedule = new InterviewSchedule({
      interviewerId,
      scheduledDate: interviewDate,
      startTime,
      candidateEmails: candidateEmails,
      status: 'Scheduled'
    });

    const savedSchedule = await newSchedule.save();

    res.status(201).json({
      message: 'Link generated successfully',
      sessionId: savedSchedule._id,
      candidatesCount: candidateEmails.length
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error generating interview link.' });
  }
};

// GET /check_session/:sessionId/:email
export const checkSessionWithEmail = async (req, res) => {
  try {
    const { sessionId, email } = req.params;

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({ emailExists: false, message: "Invalid sessionId" });
    }

    const session = await InterviewSchedule.findById(sessionId);
    if (!session) return res.json({ emailExists: false });

    const normalizedEmail = String(email).trim().toLowerCase();

    const recipients = [...new Set((session.candidateEmails || []).map((e) => String(e).trim().toLowerCase()).filter(Boolean))];
    const MAX_PER_BATCH = 50;
    const numBatches = Math.max(1, Math.ceil(recipients.length / MAX_PER_BATCH));
    const batchedEmails = splitCandidatesIntoBatches(recipients, numBatches);

    let batchIndex = -1;
    for (let i = 0; i < numBatches; i++) {
        if (batchedEmails[i].includes(normalizedEmail)) {
            batchIndex = i;
            break;
        }
    }

    if (batchIndex === -1) {
        return res.json({ emailExists: false });
    }

    const hasExistingAttempt = Array.isArray(session.candidateAttempts)
      ? session.candidateAttempts.includes(normalizedEmail)
      : false;

    // Calculate this candidate's specific start time based on their batch
    let baseStart = new Date();
    if (session.scheduledDate && session.startTime) {
        const dateObj = new Date(session.scheduledDate);
        const [hour, minute] = session.startTime.split(":").map(Number);
        if (!isNaN(hour) && !isNaN(minute)) {
            baseStart = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), hour, minute, 0);
        }
    }

    const candidateStartTime = new Date(baseStart.getTime() + batchIndex * 60 * 60 * 1000);
    const candidateStartTimeStr = candidateStartTime.toTimeString().slice(0, 5); // "HH:MM"
    const candidateScheduledDateStr = candidateStartTime.toISOString().split("T")[0]; // "YYYY-MM-DD"

    return res.json({
      emailExists: true,
      hasExistingAttempt,
      interviewerId: session.interviewerId,
      startTime: candidateStartTimeStr,
      scheduledDate: candidateScheduledDateStr,
      jobTitle: session.jobTitle || "General Role",
    });

  } catch (error) {
    console.error("Check session error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// GET /check_session/:sessionId
export const checkSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({ message: "Invalid sessionId" });
    }
    const session = await InterviewSchedule.findById(sessionId);
    if (!session) return res.status(404).json({ message: "Session not found" });
    return res.json({ 
      interviewerId: session.interviewerId, 
      startTime: session.startTime, 
      scheduledDate: session.scheduledDate,
      jobTitle: session.jobTitle || "General Role" 
    });
  } catch (error) {
    console.error("Check session error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// POST /mark-attempt/:sessionId/:email
export const markSessionAttempt = async (req, res) => {
  try {
    const { sessionId, email } = req.params;

    if (!mongoose.Types.ObjectId.isValid(sessionId)) {
      return res.status(400).json({ success: false, message: "Invalid sessionId" });
    }

    const session = await InterviewSchedule.findById(sessionId);
    if (!session) {
      return res.status(404).json({ success: false, message: "Session not found" });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const emailExists = (session.candidateEmails || []).includes(normalizedEmail);
    if (!emailExists) {
      return res.status(403).json({ success: false, message: "Email is not registered for this session" });
    }

    const updatedSession = await InterviewSchedule.findOneAndUpdate(
      { _id: sessionId, candidateAttempts: { $ne: normalizedEmail } },
      { $addToSet: { candidateAttempts: normalizedEmail } },
      { new: true }
    );

    if (!updatedSession) {
      return res.status(409).json({ success: false, message: "Interview already started for this session and email" });
    }

    return res.json({ success: true, message: "Interview attempt marked" });
  } catch (error) {
    console.error("Mark attempt error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};
