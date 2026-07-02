import express from "express";
import { createReport, updateReport, getCandidates, candidateAction, bulkCandidateAction } from "../controllers/reportController.js";
import authenticate from "../middleware/authenticate.js";

const router = express.Router();

router.post("/create-report", createReport);
router.put("/update-report/:reportId", updateReport);
router.get("/candidates/:userId", authenticate, getCandidates);
router.post("/candidate-action", authenticate, candidateAction);
router.post("/bulk-candidate-action", authenticate, bulkCandidateAction);

export default router;
