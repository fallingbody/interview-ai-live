import express from "express";
import User from "../models/User.js";
import FinalReport from "../models/FinalReport.js";
import InterviewSchedule from "../models/InterviewSchedule.js";
import jwt from "jsonwebtoken";

const router = express.Router();

// GET /api/public/stats
router.get("/stats", async (req, res) => {
  try {
    // 1. Users registered day by day
    // We group by the date part of the user's ObjectId.
    const usersDayByDay = await User.aggregate([
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: { $toDate: "$_id" } }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      { $limit: 30 } // last 30 days
    ]);

    // Format for Recharts
    const registrations = usersDayByDay.map(item => ({
      date: item._id,
      users: item.count
    }));

    // 2. Total candidates interviewed day by day
    // We group by createdAt in FinalReport
    const interviewsDayByDay = await FinalReport.aggregate([
      {
        $group: {
          _id: {
            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      { $limit: 30 }
    ]);

    const interviews = interviewsDayByDay.map(item => ({
      date: item._id,
      candidates: item.count
    }));

    // 3. Decision Status Distribution (Pie Chart)
    const decisionDistribution = await FinalReport.aggregate([
      {
        $group: {
          _id: "$decision_status",
          count: { $sum: 1 }
        }
      }
    ]);

    const decisions = decisionDistribution.map(item => ({
      name: item._id ? item._id.charAt(0).toUpperCase() + item._id.slice(1) : "Pending",
      value: item.count
    }));

    res.json({
      success: true,
      registrations,
      interviews,
      decisions
    });
  } catch (error) {
    console.error("Error fetching public stats:", error);
    res.status(500).json({ success: false, message: "Failed to fetch stats" });
  }
});

// GET /api/public/interview/join-check
router.get("/interview/join-check", async (req, res) => {
  try {
    const { token, mock_now } = req.query;

    if (!token) {
      return res.status(400).json({
        status: "error",
        theme: "invalid",
        message: "No access token was provided in the URL. Please use the exact link sent to your email."
      });
    }

    let currentTime = Math.floor(Date.now() / 1000);
    if (mock_now) {
      const mockParsed = Number(mock_now);
      if (!isNaN(mockParsed)) {
        currentTime = mockParsed;
      } else {
        const mockDate = new Date(mock_now.replace('Z', '+00:00'));
        if (!isNaN(mockDate.getTime())) {
          currentTime = Math.floor(mockDate.getTime() / 1000);
        }
      }
    }

    const secretKey = process.env.JWT_SECRET || 'shr-scale-jwt-super-secret-key-2026';

    let payload;
    try {
      payload = jwt.decode(token);
      jwt.verify(token, secretKey, { ignoreExpiration: true, ignoreNotBefore: true });
    } catch (error) {
      return res.status(401).json({
        status: "error",
        theme: "invalid",
        message: "The signature of your access token is invalid or has been tampered with. Access denied."
      });
    }

    if (!payload) {
      return res.status(400).json({
        status: "error",
        theme: "invalid",
        message: "The provided token format is corrupted or invalid. Please check your link."
      });
    }

    const { nbf, exp, group_id = 'Unknown', name = 'Candidate', email = 'N/A', interview_id } = payload;

    if (nbf && currentTime < nbf) {
      return res.status(403).json({
        status: "error",
        theme: "too_early",
        message: `Hello ${name}, your assigned window for Group ${group_id} has not started yet.`,
        waitSeconds: nbf - currentTime,
        windowStart: nbf,
        windowEnd: exp
      });
    }

    if (exp && currentTime > exp) {
      return res.status(403).json({
        status: "error",
        theme: "too_late",
        message: `We are sorry, ${name}. The slot assigned to Group ${group_id} has closed.`,
        windowStart: nbf,
        windowEnd: exp
      });
    }

    const session = await InterviewSchedule.findById(interview_id);
    if (!session) {
      return res.status(404).json({
        status: "error",
        theme: "invalid",
        message: "The security check passed, but the corresponding interview record does not exist in our database."
      });
    }

    return res.json({
      status: "success",
      candidate: { name, email, groupId: group_id },
      session: {
        id: session._id,
        scheduledDate: session.scheduledDate,
        startTime: session.startTime
      },
      windowEnd: exp
    });
  } catch (error) {
    console.error("Error in join-check:", error);
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
});

export default router;
