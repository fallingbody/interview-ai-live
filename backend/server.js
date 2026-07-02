import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import connectDB from "./config/db.js";

// Route imports
import authRoutes from "./routes/authRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import interviewRoutes from "./routes/interviewRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import campaignRoutes from "./routes/campaignRoutes.js";
import aiProxyRoutes from "./routes/aiProxyRoutes.js";
import publicRoutes from "./routes/publicRoutes.js";

connectDB();

const app = express();

app.use(cors());
app.use(express.json());

// Global Database Middleware: Ensure DB is connected for EVERY request
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    res.status(503).json({ error: "Database connection failed. Please try again in a moment." });
  }
});

// Register routes - Specific routes first to avoid shadowing
app.use("/api/ai", aiProxyRoutes);
app.use("/api/campaign", campaignRoutes);
app.use("/api/public", publicRoutes);

// General API routes
app.use("/api", authRoutes);
app.use("/api", profileRoutes);
app.use("/api", interviewRoutes);
app.use("/api", reportRoutes);

const PORT = process.env.PORT || 8000;
if (process.env.NODE_ENV !== "production") {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

export default app;
