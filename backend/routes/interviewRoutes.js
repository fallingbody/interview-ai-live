import express from "express";
import { generateLink, checkSessionWithEmail, checkSession, markSessionAttempt } from "../controllers/interviewController.js";

const router = express.Router();

router.post("/generate", generateLink);
router.get("/check_session/:sessionId/:email", checkSessionWithEmail);
router.get("/check_session/:sessionId", checkSession);
router.post("/check_session/:sessionId/:email/mark-attempt", markSessionAttempt);

export default router;
