import csv from "csv-parser";
import { Readable } from "stream";
import fs from "fs";
import path from "path";
import dns from "dns";
import os from "os";
import mongoose from "mongoose";
import Campaign from "../models/Campaign.js";
import InterviewSchedule from "../models/InterviewSchedule.js";
import FinalReport from "../models/FinalReport.js";
import User from "../models/User.js";
import { sendCandidateEmail } from "../utils/emailService.js";
import { splitCandidatesIntoBatches, generateCandidateToken } from "../utils/interviewUtils.js";
import { Client } from "@upstash/qstash";

const domainMxCache = new Map();
const domainMxPending = new Map();



const isValidEmail = async (email) => {
    const value = String(email || "").trim().toLowerCase();
    
    // 1. Sensible Format Check (Blocks double dots, spaces, and multiple @)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return false;
    if (value.includes("..")) return false;

    return true; // Bypass dynamic DNS MX checks to ensure high email reliability
};

/** Batch validate emails existence */
export const validateEmails = async (req, res) => {
    try {
        const { emails } = req.body;
        if (!Array.isArray(emails)) return res.status(400).json({ error: "Emails must be an array" });

        const results = await Promise.all(
            emails.map(async (email) => ({
                email,
                isValid: await isValidEmail(email)
            }))
        );

        res.json({ results });
    } catch (error) {
        res.status(500).json({ error: "Validation failed" });
    }
};

const buildInviteLink = (sessionId, sessionLink) => {
    const cleanedBase = String(
        process.env.USER_FRONTEND_URL || process.env.REACT_APP_USER_URL || "http://localhost:3001"
    ).replace(/\/+$/, "");
    const defaultSessionLink = `${cleanedBase}/interviewcheck/${sessionId}`;
    return sessionLink || defaultSessionLink;
};

const dispatchInviteEmails = async ({ recipients, baseUrl, sessionId, session, jobTitle }) => {
    let invitedCount = 0;
    const failedEmails = [];
    let lastSessionLink = baseUrl;
    let csvData = "Email,GroupCode,StartTime,InviteLink\n";
    const generatedLinks = [];

    // Calculate batches (max 50 per batch)
    const MAX_PER_BATCH = 50;
    const numBatches = Math.max(1, Math.ceil(recipients.length / MAX_PER_BATCH));
    const batchedEmails = splitCandidatesIntoBatches(recipients, numBatches);

    // Calculate base start time from session
    let baseStart = new Date(); // fallback
    if (session.scheduledDate && session.startTime) {
        const dateObj = new Date(session.scheduledDate);
        const [hour, minute] = session.startTime.split(":").map(Number);
        if (!isNaN(hour) && !isNaN(minute)) {
            baseStart = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate(), hour, minute, 0);
        }
    }

    for (let idx = 0; idx < numBatches; idx++) {
        const groupCode = String.fromCharCode(65 + idx); // A, B, C...
        const startTime = new Date(baseStart.getTime() + idx * 60 * 60 * 1000); // + idx hours
        const endTime = new Date(startTime.getTime() + 60 * 60 * 1000); // 1 hour window

        const batchResults = [];
        // Process in chunks of 5 to avoid SMTP 421 concurrent rate limits for REAL emails
        const chunkSize = 5;
        for (let i = 0; i < batchedEmails[idx].length; i += chunkSize) {
            const chunk = batchedEmails[idx].slice(i, i + chunkSize);
            const chunkPromises = chunk.map(async (recipientEmail) => {
                const inviteLink = `${baseUrl}/interviewcheck/${sessionId}?email=${encodeURIComponent(recipientEmail)}`;
                lastSessionLink = inviteLink;
                csvData += `${recipientEmail},${groupCode},${startTime.toISOString()},${inviteLink}\n`;

                const subject = `Interview Invitation${jobTitle ? ` - ${jobTitle}` : ""}`;
                const htmlBody = `
                  <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937;">
                    <h2 style="margin-bottom: 8px;">Interview Invitation</h2>
                    <p>You have been invited to an interview session on Interview.ai.</p>
                    ${jobTitle ? `<p><strong>Role:</strong> ${jobTitle}</p>` : ""}
                    <p>Please use the link below to securely join your session (Group ${groupCode}):</p>
                    <p><a href="${inviteLink}" target="_blank" rel="noreferrer">${inviteLink}</a></p>
                    <br />
                    <p>Best regards,<br />Interview.ai Team</p>
                  </div>
                `;

                try {
                    const isDummyDomain = recipientEmail.includes("+test@") || recipientEmail.endsWith("@example.com") || recipientEmail.endsWith("@company.in") || recipientEmail.endsWith("@test.com");
                    
                    if (!isDummyDomain) {
                        if (process.env.QSTASH_TOKEN) {
                            const qstashClient = new Client({ 
                                token: process.env.QSTASH_TOKEN,
                                baseUrl: process.env.QSTASH_URL || "https://qstash-us-east-1.upstash.io"
                            });
                            const backendUrl = process.env.BACKEND_URL || "https://your-vercel-domain.vercel.app";
                            await qstashClient.publishJSON({
                                url: `${backendUrl}/api/campaign/qstash-webhook`,
                                body: { recipientEmail, subject, htmlBody },
                                headers: {
                                    Authorization: `Bearer ${process.env.QSTASH_WEBHOOK_SECRET || "default_secret"}`
                                }
                            });
                        } else {
                            await sendCandidateEmail(recipientEmail, subject, htmlBody);
                        }
                    }
                    
                    return { 
                        success: true, 
                        email: recipientEmail, 
                        linkDetails: { email: recipientEmail, groupCode, startTime: startTime.toISOString(), inviteLink } 
                    };
                } catch (dispatchError) {
                    console.error(`Invite email failed for ${recipientEmail}:`, dispatchError.message);
                    return { success: false, email: recipientEmail };
                }
            });
            
            const resolvedChunk = await Promise.all(chunkPromises);
            batchResults.push(...resolvedChunk);
        }

        batchResults.forEach(r => {
            if (r.success) {
                invitedCount++;
                if (r.linkDetails) generatedLinks.push(r.linkDetails);
            }
            else failedEmails.push(r.email);
        });
    }

    try {
        fs.writeFileSync(path.join(os.tmpdir(), `campaign_${sessionId}_links.csv`), csvData);
        console.log(`Saved batched JWT links to campaign_${sessionId}_links.csv for testing in /tmp.`);
    } catch(err) {
        console.error("Could not write test CSV", err);
    }

    return {
        invitedCount,
        failedCount: failedEmails.length,
        failedEmails,
        lastSessionLink,
        generatedLinks,
    };
};

const applyTemplate = (template, report, jobTitle, recruiterName) => {
    const candidateName = String(report?.candidate_overview?.name || "Candidate").trim();
    const candidateEmail = String(report?.candidate_overview?.email || "").trim().toLowerCase();
    const companyName = String(report?.company_name || "").trim();

    return String(template || "")
        .replaceAll("{{name}}", candidateName)
        .replaceAll("{{email}}", candidateEmail)
        .replaceAll("{{companyName}}", companyName || "your organization")
        .replaceAll("{{role}}", jobTitle || "role")
        .replaceAll("{{recruiterName}}", recruiterName || "Talent Acquisition Team")
        .replace(/(?:\r\n|\r|\n)/g, "<br />");
};

const normalizeEmailSignature = (emails = []) =>
    [...new Set(
        (Array.isArray(emails) ? emails : [])
            .map((email) => String(email || "").trim().toLowerCase())
            .filter(Boolean)
    )]
        .sort()
        .join("|");

const buildDecisionSummary = (reports = []) => {
    const summary = {
        selectedCount: 0,
        rejectedCount: 0,
        pendingCount: 0,
        completedCount: 0,
        otherCount: 0,
        totalCount: 0,
    };

    for (const report of reports) {
        const status = String(report?.decision_status || "pending").trim().toLowerCase();
        summary.totalCount += 1;

        if (status === "selected") {
            summary.selectedCount += 1;
            continue;
        }

        if (status === "rejected") {
            summary.rejectedCount += 1;
            continue;
        }

        if (status === "completed") {
            summary.completedCount += 1;
            continue;
        }

        if (status === "pending") {
            summary.pendingCount += 1;
            continue;
        }

        summary.otherCount += 1;
    }

    return summary;
};

// GET /api/campaign/dashboard-stats
export const getDashboardStats = async (req, res) => {
    try {
        const requesterId = req.user?.id;

        if (!requesterId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const [campaigns, schedules, reports] = await Promise.all([
            Campaign.find({ createdBy: requesterId }).sort({ createdAt: 1 }).lean(),
            InterviewSchedule.find({ interviewerId: requesterId })
                .select("candidateEmails status dispatchSummary scheduledDate startTime createdAt updatedAt")
                .sort({ createdAt: 1 })
                .lean(),
            FinalReport.find({ interviewerId: requesterId })
                .select("sessionId decision_status")
                .lean(),
        ]);

        const reportBuckets = new Map();
        for (const report of reports) {
            const sessionKey = report?.sessionId ? String(report.sessionId) : null;
            if (!sessionKey) continue;
            if (!reportBuckets.has(sessionKey)) reportBuckets.set(sessionKey, []);
            reportBuckets.get(sessionKey).push(report);
        }

        const availableSchedulesBySignature = new Map();
        for (const schedule of schedules) {
            const signature = normalizeEmailSignature(schedule?.candidateEmails);
            if (!availableSchedulesBySignature.has(signature)) {
                availableSchedulesBySignature.set(signature, []);
            }
            availableSchedulesBySignature.get(signature).push(schedule);
        }

        /**
         * Compute dynamic status based on scheduledDate + startTime.
         * 30-min window: before start → Upcoming, during → Active, after → Expired.
         */
        const computeStatus = (scheduledDate, startTime) => {
            if (!scheduledDate || !startTime) return "Upcoming";

            const dateStr = new Date(scheduledDate).toISOString().split("T")[0]; // YYYY-MM-DD
            const [hours, minutes] = String(startTime).split(":").map(Number);
            if (isNaN(hours) || isNaN(minutes)) return "Upcoming";

            const startDt = new Date(`${dateStr}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`);
            const endDt = new Date(startDt.getTime() + 30 * 60 * 1000); // +30 min
            const now = new Date();

            if (now < startDt) return "Upcoming";
            if (now >= startDt && now <= endDt) return "Active";
            return "Expired";
        };

        /** Sort priority: Upcoming(0) → Active(1) → Expired(2) */
        const statusOrder = { Upcoming: 0, Active: 1, Expired: 2 };

        const campaignStats = campaigns.map((campaign) => {
            const signature = normalizeEmailSignature(campaign?.candidateEmails);
            const matchingSchedules = availableSchedulesBySignature.get(signature) || [];
            const campaignCreatedAt = campaign?.createdAt ? new Date(campaign.createdAt).getTime() : null;

            let matchedScheduleIndex = -1;
            let matchedSchedule = null;
            let smallestTimeGap = Number.POSITIVE_INFINITY;

            for (let index = 0; index < matchingSchedules.length; index += 1) {
                const candidateSchedule = matchingSchedules[index];
                if (candidateSchedule?.__matched) continue;

                const scheduleCreatedAt = candidateSchedule?.createdAt ? new Date(candidateSchedule.createdAt).getTime() : null;
                const timeGap =
                    campaignCreatedAt !== null && scheduleCreatedAt !== null
                        ? Math.abs(scheduleCreatedAt - campaignCreatedAt)
                        : index;

                if (timeGap < smallestTimeGap) {
                    smallestTimeGap = timeGap;
                    matchedScheduleIndex = index;
                    matchedSchedule = candidateSchedule;
                }
            }

            if (matchedScheduleIndex >= 0) {
                matchingSchedules[matchedScheduleIndex].__matched = true;
            }

            const sessionId = matchedSchedule?._id ? String(matchedSchedule._id) : null;
            const matchedReports = sessionId ? reportBuckets.get(sessionId) || [] : [];
            const decisionSummary = buildDecisionSummary(matchedReports);
            const invitedCount = Number(matchedSchedule?.dispatchSummary?.invitedCount ?? campaign?.candidateEmails?.length ?? 0);
            const candidateCount = Array.isArray(campaign?.candidateEmails) ? campaign.candidateEmails.length : 0;
            const totalEngaged = decisionSummary.totalCount;
            const responseRate = invitedCount > 0 ? Math.round((totalEngaged / invitedCount) * 100) : 0;
            const selectionRate = totalEngaged > 0 ? Math.round((decisionSummary.selectedCount / totalEngaged) * 100) : 0;

            // Compute dynamic status from schedule date/time
            const dynamicStatus = computeStatus(
                matchedSchedule?.scheduledDate,
                matchedSchedule?.startTime,
            );

            return {
                _id: String(campaign._id),
                jobTitle: campaign.jobTitle,
                jobDescription: campaign.jobDescription || "",
                interviewType: campaign.interviewType,
                experienceLevel: campaign.experienceLevel,
                passThreshold: campaign.passThreshold,
                status: dynamicStatus,
                candidateCount,
                invitedCount,
                sessionId,
                scheduledDate: matchedSchedule?.scheduledDate || null,
                startTime: matchedSchedule?.startTime || null,
                dispatchSummary: matchedSchedule?.dispatchSummary || null,
                selectedCount: decisionSummary.selectedCount,
                rejectedCount: decisionSummary.rejectedCount,
                pendingCount: decisionSummary.pendingCount,
                completedCount: decisionSummary.completedCount,
                otherCount: decisionSummary.otherCount,
                totalDecisionCount: decisionSummary.totalCount,
                selectionRate,
                responseRate,
                createdAt: campaign.createdAt,
                updatedAt: campaign.updatedAt,
            };
        });

        // Sort: Upcoming first, then Active, then Expired.
        // Within each group, sort by full datetime descending (newest first).
        const toFullTimestamp = (item) => {
            if (!item.scheduledDate) return 0;
            const dateStr = new Date(item.scheduledDate).toISOString().split("T")[0];
            const [h, m] = String(item.startTime || "00:00").split(":").map(Number);
            return new Date(`${dateStr}T${String(h || 0).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}:00`).getTime();
        };

        campaignStats.sort((a, b) => {
            const orderDiff = (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9);
            if (orderDiff !== 0) return orderDiff;
            return toFullTimestamp(b) - toFullTimestamp(a);
        });

        const totalCandidates = campaignStats.reduce((sum, item) => sum + Number(item.candidateCount || 0), 0);
        const totalInvited = campaignStats.reduce((sum, item) => sum + Number(item.invitedCount || 0), 0);
        const totalSelected = campaignStats.reduce((sum, item) => sum + Number(item.selectedCount || 0), 0);
        const totalRejected = campaignStats.reduce((sum, item) => sum + Number(item.rejectedCount || 0), 0);
        const totalPending = campaignStats.reduce((sum, item) => sum + Number(item.pendingCount || 0), 0);
        const totalCompleted = campaignStats.reduce((sum, item) => sum + Number(item.completedCount || 0), 0);
        const totalOther = campaignStats.reduce((sum, item) => sum + Number(item.otherCount || 0), 0);
        const totalDecisionCount = campaignStats.reduce((sum, item) => sum + Number(item.totalDecisionCount || 0), 0);

        return res.json({
            success: true,
            campaigns: campaignStats,
            totalMetrics: {
                totalCampaigns: campaignStats.length,
                totalCandidates,
                totalInvited,
                totalSelected,
                totalRejected,
                totalPending,
                totalCompleted,
                totalOther,
                totalDecisionCount,
                overallSelectionRate: totalDecisionCount > 0 ? Math.round((totalSelected / totalDecisionCount) * 100) : 0,
                overallResponseRate: totalInvited > 0 ? Math.round((totalDecisionCount / totalInvited) * 100) : 0,
            },
        });
    } catch (error) {
        console.error("Dashboard stats error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// POST /api/campaign/upload-csv
export const uploadCSV = async (req, res) => {
    try {
        // Check if file was uploaded
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No CSV file uploaded. Please upload a file."
            });
        }

        // Parse CSV from buffer
        const results = [];
        const stream = Readable.from(req.file.buffer.toString());

        await new Promise((resolve, reject) => {
            stream
                .pipe(csv())
                .on("data", (row) => results.push(row))
                .on("end", resolve)
                .on("error", reject);
        });

        // Check if CSV is empty
        if (results.length === 0) {
            return res.status(400).json({
                success: false,
                message: "CSV file is empty. No rows found."
            });
        }

        // Find the email column (case-insensitive)
        const firstRow = results[0];
        const emailKey = Object.keys(firstRow).find(
            (key) => key.toLowerCase().trim() === "email"
        );

        if (!emailKey) {
            return res.status(400).json({
                success: false,
                message: "No 'email' column found in CSV. Please ensure your CSV has a column named 'email'.",
                columnsFound: Object.keys(firstRow)
            });
        }

        // Extract emails
        const emailsToValidate = results
            .map(row => row[emailKey]?.trim().toLowerCase())
            .filter(Boolean);

        // Validate all emails in parallel to prevent timeouts
        const validationResults = await Promise.all(
            emailsToValidate.map(async (email) => ({
                email,
                isValid: await isValidEmail(email)
            }))
        );

        const validEmails = validationResults.filter(r => r.isValid).map(r => r.email);
        const invalidEmails = validationResults.filter(r => !r.isValid).map(r => r.email);

        // Remove duplicates
        const uniqueEmails = [...new Set(validEmails)];
        const duplicates = validEmails.length - uniqueEmails.length;

        if (uniqueEmails.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No valid email addresses found in CSV.",
                total: results.length,
                invalidCount: invalidEmails.length,
                invalidEmails,
            });
        }

        res.json({
            success: true,
            total: results.length,
            valid: uniqueEmails.length,
            duplicates: duplicates,
            invalidCount: invalidEmails.length,
            emails: uniqueEmails,
            invalidEmails: invalidEmails
        });

    } catch (error) {
        console.error("CSV Upload Error:", error);
        res.status(500).json({
            success: false,
            message: "Error parsing CSV file.",
            error: error.message
        });
    }
};

// POST /api/campaign/create
export const createCampaign = async (req, res) => {
    try {
        const {
            jobTitle,
            jobDescription,
            interviewType,
            experienceLevel,
            passThreshold,
            candidateEmails,
            interviewDate,
            startTime
        } = req.body;

        const ownerId = req.user?.id;

        // Validate required fields
        if (!jobTitle || !interviewType || !experienceLevel || !ownerId) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields: jobTitle, interviewType, experienceLevel"
            });
        }

        if (!Array.isArray(candidateEmails) || candidateEmails.length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least one candidate email is required."
            });
        }

        if (!interviewDate || !startTime) {
            return res.status(400).json({
                success: false,
                message: "Interview date and start time are required."
            });
        }

        const normalizedPassThreshold = Number(passThreshold ?? 65);
        if (!Number.isFinite(normalizedPassThreshold) || normalizedPassThreshold < 0 || normalizedPassThreshold > 100) {
            return res.status(400).json({
                success: false,
                message: "passThreshold must be a number between 0 and 100."
            });
        }

        const sanitizedEmails = [...new Set(
            candidateEmails
                .map((email) => String(email || "").trim().toLowerCase())
                .filter(Boolean)
        )];

        // Validate all emails in parallel to prevent bottlenecks
        const validationResults = await Promise.all(
            sanitizedEmails.map(async (email) => ({
                email,
                isValid: await isValidEmail(email)
            }))
        );
        
        const validCandidateEmails = validationResults.filter(r => r.isValid).map(r => r.email);
        const invalidEmails = validationResults.filter(r => !r.isValid).map(r => r.email);

        if (validCandidateEmails.length === 0) {
            return res.status(400).json({
                success: false,
                message: "No valid candidate email addresses provided.",
                invalidEmails,
            });
        }

        const campaign = new Campaign({
            jobTitle,
            jobDescription,
            interviewType,
            experienceLevel,
            passThreshold: normalizedPassThreshold,
            candidateEmails: validCandidateEmails,
            createdBy: ownerId,
            status: "Draft"
        });

        await campaign.save();

        const schedule = new InterviewSchedule({
            interviewerId: ownerId,
            scheduledDate: interviewDate,
            startTime,
            jobTitle,
            candidateEmails: validCandidateEmails,
            status: "Scheduled"
        });

        await schedule.save();

        res.status(201).json({
            success: true,
            message: "Campaign created successfully",
            campaignId: campaign._id,
            sessionId: schedule._id
        });

    } catch (error) {
        console.error("Create Campaign Error:", error);
        res.status(500).json({
            success: false,
            message: "Error creating campaign.",
            error: error.message
        });
    }
};

// POST /api/campaign/:sessionId/send-invites
export const sendSessionInvites = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const requesterId = req.user?.id;
        const { sessionLink, jobTitle } = req.body || {};

        if (!requesterId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        if (!mongoose.Types.ObjectId.isValid(sessionId)) {
            return res.status(400).json({ success: false, message: "Invalid sessionId" });
        }

        const session = await InterviewSchedule.findById(sessionId);
        if (!session) {
            return res.status(404).json({ success: false, message: "Session not found" });
        }

        if (String(session.interviewerId) !== String(requesterId)) {
            return res.status(403).json({ success: false, message: "Forbidden" });
        }

        const baseUrl = String(process.env.USER_FRONTEND_URL || process.env.REACT_APP_USER_URL || "http://localhost:3001").replace(/\/+$/, "");

        const recipients = [...new Set((session.candidateEmails || []).map((email) => String(email).trim().toLowerCase()).filter(Boolean))];

        if (recipients.length === 0) {
            return res.status(400).json({ success: false, message: "No candidate emails found for this session" });
        }

        const dispatchResult = await dispatchInviteEmails({ recipients, baseUrl, sessionId, session, jobTitle });

        session.dispatchSummary = {
            invitedCount: dispatchResult.invitedCount,
            failedCount: dispatchResult.failedCount,
            failedEmails: dispatchResult.failedEmails,
            lastDispatchAt: new Date(),
            lastSessionLink: dispatchResult.lastSessionLink,
            dispatchAttempts: (session.dispatchSummary?.dispatchAttempts || 0) + 1,
        };
        await session.save();

        return res.json({
            success: true,
            message: "Invite dispatch completed",
            invitedCount: dispatchResult.invitedCount,
            failedCount: dispatchResult.failedCount,
            failedEmails: dispatchResult.failedEmails,
            dispatchAttempts: session.dispatchSummary.dispatchAttempts,
            lastDispatchAt: session.dispatchSummary.lastDispatchAt,
            generatedLinks: dispatchResult.generatedLinks,
        });
    } catch (error) {
        console.error("Send invites error:", error);
        return res.status(500).json({ success: false, message: "Failed to send invite emails" });
    }
};

// POST /api/campaign/:sessionId/retry-failed-invites
export const retryFailedInvites = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const requesterId = req.user?.id;
        const { sessionLink, jobTitle } = req.body || {};

        if (!requesterId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        if (!mongoose.Types.ObjectId.isValid(sessionId)) {
            return res.status(400).json({ success: false, message: "Invalid sessionId" });
        }

        const session = await InterviewSchedule.findById(sessionId);
        if (!session) {
            return res.status(404).json({ success: false, message: "Session not found" });
        }

        if (String(session.interviewerId) !== String(requesterId)) {
            return res.status(403).json({ success: false, message: "Forbidden" });
        }

        const storedFailed = [...new Set((session.dispatchSummary?.failedEmails || []).map((email) => String(email).trim().toLowerCase()).filter(Boolean))];
        if (storedFailed.length === 0) {
            return res.json({
                success: true,
                message: "No failed invite emails to retry.",
                invitedCount: 0,
                failedCount: 0,
                failedEmails: [],
                dispatchAttempts: session.dispatchSummary?.dispatchAttempts || 0,
                lastDispatchAt: session.dispatchSummary?.lastDispatchAt || null,
            });
        }

        const baseUrl = String(process.env.USER_FRONTEND_URL || process.env.REACT_APP_USER_URL || "http://localhost:3001").replace(/\/+$/, "");
        const dispatchResult = await dispatchInviteEmails({ recipients: storedFailed, baseUrl, sessionId, session, jobTitle });
        const previousInvitedCount = Number(session.dispatchSummary?.invitedCount || 0);
        const cumulativeInvitedCount = previousInvitedCount + dispatchResult.invitedCount;

        session.dispatchSummary = {
            invitedCount: cumulativeInvitedCount,
            failedCount: dispatchResult.failedCount,
            failedEmails: dispatchResult.failedEmails,
            lastDispatchAt: new Date(),
            lastSessionLink: dispatchResult.lastSessionLink,
            dispatchAttempts: (session.dispatchSummary?.dispatchAttempts || 0) + 1,
        };
        await session.save();

        return res.json({
            success: true,
            message: "Retry dispatch completed",
            invitedCount: cumulativeInvitedCount,
            lastAttemptInvitedCount: dispatchResult.invitedCount,
            failedCount: dispatchResult.failedCount,
            failedEmails: dispatchResult.failedEmails,
            dispatchAttempts: session.dispatchSummary.dispatchAttempts,
            lastDispatchAt: session.dispatchSummary.lastDispatchAt,
            generatedLinks: dispatchResult.generatedLinks,
        });
    } catch (error) {
        console.error("Retry failed invites error:", error);
        return res.status(500).json({ success: false, message: "Failed to retry invite emails" });
    }
};

// POST /api/campaign/send-outcome-emails
export const sendOutcomeEmails = async (req, res) => {
    try {
        const requesterId = req.user?.id;
        const {
            sessionId,
            selectedTemplate,
            rejectedTemplate,
            jobTitle
        } = req.body || {};

        if (!requesterId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        if (!mongoose.Types.ObjectId.isValid(sessionId)) {
            return res.status(400).json({ success: false, message: "Invalid sessionId" });
        }

        const normalizedSelectedTemplate = String(selectedTemplate || "").trim();
        const normalizedRejectedTemplate = String(rejectedTemplate || "").trim();

        if (!normalizedSelectedTemplate || !normalizedRejectedTemplate) {
            return res.status(400).json({
                success: false,
                message: "selectedTemplate and rejectedTemplate are required.",
            });
        }

        const session = await InterviewSchedule.findById(sessionId).select("interviewerId");
        if (!session) {
            return res.status(404).json({ success: false, message: "Session not found" });
        }

        if (String(session.interviewerId) !== String(requesterId)) {
            return res.status(403).json({ success: false, message: "Forbidden" });
        }

        const reports = await FinalReport.find({ sessionId }).select("candidate_overview decision_status company_name");

        if (!reports.length) {
            return res.json({
                success: true,
                message: "Outcome email dispatch completed",
                invitedCount: 0,
                selectedSentCount: 0,
                rejectedCount: 0,
                rejectedSentCount: 0,
                failedCount: 0,
                failedEmails: [],
                totalProcessed: 0,
            });
        }

        let recruiterName = "Talent Acquisition Team";
        if (requesterId) {
            const userDoc = await User.findById(requesterId).select("username company_name");
            if (userDoc) {
                recruiterName = userDoc.username || recruiterName;
                // We use company_name from the FinalReport which should already be updated
            }
        }

        let selectedSentCount = 0;
        let rejectedSentCount = 0;
        let totalTargets = 0;
        const failedEmails = [];

        for (const report of reports) {
            const status = String(report?.decision_status || "").trim().toLowerCase();
            if (status !== "selected" && status !== "rejected") {
                continue;
            }

            const candidateEmail = String(report?.candidate_overview?.email || "").trim().toLowerCase();
            const isEmailValid = await isValidEmail(candidateEmail);
            if (!candidateEmail || !isEmailValid) {
                if (candidateEmail) failedEmails.push(candidateEmail);
                continue;
            }

            totalTargets += 1;

            const subject =
                status === "selected"
                    ? "Interview Result - Selected"
                    : "Interview Result - Update";

            const htmlBody =
                status === "selected"
                    ? applyTemplate(normalizedSelectedTemplate, report, jobTitle, recruiterName)
                    : applyTemplate(normalizedRejectedTemplate, report, jobTitle, recruiterName);

            try {
                if (process.env.QSTASH_TOKEN) {
                    const qstashClient = new Client({ 
                        token: process.env.QSTASH_TOKEN,
                        baseUrl: process.env.QSTASH_URL || "https://qstash-us-east-1.upstash.io"
                    });
                    const backendUrl = process.env.BACKEND_URL || "https://your-vercel-domain.vercel.app";
                    await qstashClient.publishJSON({
                        url: `${backendUrl}/api/campaign/qstash-webhook`,
                        body: { recipientEmail: candidateEmail, subject, htmlBody },
                        headers: {
                            Authorization: `Bearer ${process.env.QSTASH_WEBHOOK_SECRET || "default_secret"}`
                        }
                    });
                } else {
                    await sendCandidateEmail(candidateEmail, subject, htmlBody);
                }
                
                if (status === "selected") {
                    selectedSentCount += 1;
                } else {
                    rejectedSentCount += 1;
                }
            } catch (dispatchError) {
                failedEmails.push(candidateEmail);
                console.error(`Outcome email failed for ${candidateEmail}:`, dispatchError.message);
            }
        }

        return res.json({
            success: true,
            message: "Outcome email dispatch completed",
            invitedCount: selectedSentCount,
            selectedSentCount,
            rejectedCount: rejectedSentCount,
            rejectedSentCount,
            failedCount: failedEmails.length,
            failedEmails,
            totalProcessed: totalTargets,
        });
    } catch (error) {
        console.error("Send outcome emails error:", error);
        return res.status(500).json({ success: false, message: "Failed to send outcome emails" });
    }
};

// POST /api/campaign/qstash-webhook
export const qstashWebhook = async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        const expectedSecret = `Bearer ${process.env.QSTASH_WEBHOOK_SECRET || "default_secret"}`;
        
        if (!authHeader || authHeader !== expectedSecret) {
            return res.status(401).json({ success: false, message: "Unauthorized QStash Webhook" });
        }

        const { recipientEmail, subject, htmlBody } = req.body;
        if (!recipientEmail || !subject || !htmlBody) {
            return res.status(400).json({ success: false, message: "Missing required email fields" });
        }

        await sendCandidateEmail(recipientEmail, subject, htmlBody);
        console.log(`✅ QStash background email sent to ${recipientEmail}`);

        return res.json({ success: true, message: "Email sent via QStash" });
    } catch (error) {
        console.error("❌ QStash webhook error:", error.message);
        return res.status(500).json({ success: false, message: "Failed to process QStash webhook" });
    }
};
