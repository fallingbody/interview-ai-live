import express from "express";
import multer from "multer";
import authenticate from "../middleware/authenticate.js";
import { uploadCSV, createCampaign, sendSessionInvites, retryFailedInvites, sendOutcomeEmails, getDashboardStats, validateEmails, qstashWebhook } from "../controllers/campaignController.js";

const router = express.Router();

// Multer config — memory storage, max 5MB
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
            cb(null, true);
        } else {
            cb(new Error("Only CSV files are allowed"), false);
        }
    }
});

// POST /api/campaign/upload-csv — Parse CSV and return preview
router.post("/upload-csv", authenticate, upload.single("csvFile"), uploadCSV);

// POST /api/campaign/validate-emails — Batch validate existence
router.post("/validate-emails", authenticate, validateEmails);

// POST /api/campaign/create — Save campaign to MongoDB
router.post("/create", authenticate, createCampaign);

// POST /api/campaign/:sessionId/send-invites — Send invite emails for one session
router.post("/:sessionId/send-invites", authenticate, sendSessionInvites);

// POST /api/campaign/:sessionId/retry-failed-invites — Retry only failed invite emails
router.post("/:sessionId/retry-failed-invites", authenticate, retryFailedInvites);

// POST /api/campaign/send-outcome-emails — Send selected/rejected outcome emails
router.post("/send-outcome-emails", authenticate, sendOutcomeEmails);

// GET /api/campaign/dashboard-stats — Campaign analytics for the authenticated HR
router.get("/dashboard-stats", authenticate, getDashboardStats);

// POST /api/campaign/qstash-webhook — Webhook for Upstash QStash to process emails
router.post("/qstash-webhook", qstashWebhook);

export default router;
