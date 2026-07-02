import express from "express";
import multer from "multer";
import {
  analyzeAudio,
  analyzeFrame,
  endLiveAnalysis,
  getAIReport,
  handleAIInterview,
  scanResumeFace,
  startAIInterview,
  startLiveAnalysis,
  uploadResumeReferenceImage,
  uploadResumeToAI,
  updateResumeFaceVector,
  verifyFace,
} from "../controllers/aiProxyController.js";

const router = express.Router();

// 🔍 DIAGNOSTIC: Log every request to the AI proxy
router.use((req, res, next) => {
  console.log(`[AI PROXY] Incoming request: ${req.method} ${req.path}`);
  next();
});

const upload = multer({ storage: multer.memoryStorage() });

router.post("/resumes/upload", uploadResumeToAI);
router.post("/resumes/scan-face", scanResumeFace);
router.post("/resumes/:resumeId/reference-image", upload.single("image"), uploadResumeReferenceImage);
router.post("/resumes/:resumeId/face-vector", updateResumeFaceVector);
router.post("/interviews/start", startAIInterview);
router.post("/interviews/handle", handleAIInterview);
router.get("/reports/:interviewId", getAIReport);

router.post("/start-interview", startLiveAnalysis);
router.post("/analyze-frame", analyzeFrame);
router.post("/verify-face", verifyFace);
router.post("/analyze-audio", upload.single("audio"), analyzeAudio);
router.post("/end-interview", endLiveAnalysis);

export default router;
