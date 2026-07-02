import fetch from "node-fetch";
import FormData from "form-data";

const AI_BACKEND_URL = (process.env.FLASK_API_BASE_URL || process.env.AI_BACKEND_URL || "http://127.0.0.1:5000").replace(/\/$/, "");
const AI_BACKEND_API_KEY = process.env.FLASK_API_KEY || process.env.AI_BACKEND_API_KEY || "production-dev-key";


const buildHeaders = (headers = {}) => ({
  ...headers,
  "X-API-KEY": AI_BACKEND_API_KEY,
});

const sendProxyResponse = async (aiResponse, res) => {
  const contentType = aiResponse.headers.get("content-type") || "";
  res.status(aiResponse.status);

  if (contentType.includes("application/json")) {
    const data = await aiResponse.json().catch(() => ({}));
    return res.json(data);
  }

  const text = await aiResponse.text().catch(() => "");
  return res.send(text);
};

const proxyJson = async (req, res, path) => {
  try {
    const aiResponse = await fetch(`${AI_BACKEND_URL}${path}`, {
      method: req.method,
      headers: buildHeaders({ "Content-Type": "application/json" }),
      body: ["GET", "HEAD"].includes(req.method) ? undefined : JSON.stringify(req.body || {}),
    });

    return sendProxyResponse(aiResponse, res);
  } catch (error) {
    console.error(`AI proxy JSON error for ${path}:`, error);
    return res.status(502).json({
      success: false,
      message: "AI backend is unavailable",
    });
  }
};

const proxyMultipart = async (req, res, path) => {
  try {
    const formData = new FormData();

    Object.entries(req.body || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, String(value));
      }
    });

    const files = Array.isArray(req.files)
      ? req.files
      : req.files && typeof req.files === "object"
        ? Object.values(req.files).flat()
        : req.file
          ? [req.file]
          : [];
    files.forEach((file) => {
      // `form-data` accepts Buffer directly with filename and contentType
      formData.append(file.fieldname, file.buffer, {
        filename: file.originalname || "upload.bin",
        contentType: file.mimetype || "application/octet-stream",
      });
    });

    const headers = buildHeaders(formData.getHeaders());

    const aiResponse = await fetch(`${AI_BACKEND_URL}${path}`, {
      method: req.method,
      headers,
      body: formData,
    });

    return sendProxyResponse(aiResponse, res);
  } catch (error) {
    console.error(`AI proxy multipart error for ${path}:`, error);
    return res.status(502).json({
      success: false,
      message: "AI backend is unavailable",
    });
  }
};

const proxyStream = async (req, res, path) => {
  try {
    const headers = buildHeaders();
    if (req.headers["content-type"]) {
      headers["content-type"] = req.headers["content-type"];
    }

    const aiResponse = await fetch(`${AI_BACKEND_URL}${path}`, {
      method: req.method,
      headers,
      body: req,
      duplex: 'half',
    });

    return sendProxyResponse(aiResponse, res);
  } catch (error) {
    console.error(`AI proxy stream error for ${path}:`, error);
    return res.status(502).json({
      success: false,
      message: "AI backend is unavailable",
    });
  }
};

export const uploadResumeToAI = (req, res) => proxyStream(req, res, "/api/resumes/upload");
export const scanResumeFace = (req, res) => proxyStream(req, res, "/api/resumes/scan-face");
export const uploadResumeReferenceImage = (req, res) =>
  proxyMultipart(req, res, `/api/resumes/${req.params.resumeId}/reference-image`);
export const updateResumeFaceVector = (req, res) => proxyJson(req, res, `/api/resumes/${req.params.resumeId}/face-vector`);
export const startAIInterview = (req, res) => proxyJson(req, res, "/api/interviews/start");
export const handleAIInterview = (req, res) => proxyJson(req, res, "/api/interviews/handle");
export const getAIReport = (req, res) => proxyJson(req, res, `/api/reports/${req.params.interviewId}`);

export const startLiveAnalysis = (req, res) => proxyJson(req, res, "/api/face-analysis/start");
export const analyzeFrame = (req, res) => proxyJson(req, res, "/api/face-analysis/frame");
export const verifyFace = (req, res) => proxyJson(req, res, "/api/face-analysis/frame");
export const analyzeAudio = (req, res) => proxyMultipart(req, res, "/analyze-audio");
export const endLiveAnalysis = (req, res) => proxyJson(req, res, "/api/face-analysis/end");
