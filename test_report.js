import mongoose from 'mongoose';
import FinalReport from './backend/models/FinalReport.js';

const MONGODB_URI = "mongodb+srv://fallingbody:Hireme2026@cluster0.n9rkotq.mongodb.net/HireMe_db?retryWrites=true&w=majority&appName=Cluster0";

async function test() {
  await mongoose.connect(MONGODB_URI);
  console.log("Connected to MongoDB");
  
  // Find the most recently updated report
  const report = await FinalReport.findOne().sort({ updatedAt: -1 });
  console.log("Latest report ID:", report._id);
  console.log("Cheating Detected in DB:", report.cheating_detected);
  console.log("Cheating Reason in DB:", report.cheating_reason);
  
  await mongoose.disconnect();
}
test();
