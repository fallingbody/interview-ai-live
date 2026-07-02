import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

import User from "../models/User.js";
import FinalReport from "../models/FinalReport.js";
import InterviewSchedule from "../models/InterviewSchedule.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const parseArgs = () => {
    const args = process.argv.slice(2);
    const out = {
        interviewerId: null,
        userEmail: null,
        sessionId: null,
        reset: false,
    };

    for (const arg of args) {
        if (arg.startsWith("--interviewerId=")) out.interviewerId = arg.split("=")[1];
        if (arg.startsWith("--userEmail=")) out.userEmail = arg.split("=")[1];
        if (arg.startsWith("--sessionId=")) out.sessionId = arg.split("=")[1];
        if (arg === "--reset") out.reset = true;
    }
    return out;
};

const loadSeedData = () => {
    const jsonPath = path.resolve(__dirname, "../seeds/finalReports.seed.json");
    return JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
};

const resolveInterviewer = async ({ interviewerId, userEmail }) => {
    if (interviewerId) {
        if (!mongoose.Types.ObjectId.isValid(interviewerId)) {
            throw new Error("Invalid --interviewerId. Must be a valid ObjectId.");
        }
        const user = await User.findById(interviewerId);
        if (!user) throw new Error("No user found for given --interviewerId.");
        return user;
    }

    if (userEmail) {
        const user = await User.findOne({ email: userEmail.toLowerCase() });
        if (!user) throw new Error("No user found for given --userEmail.");
        return user;
    }

    const fallbackUser = await User.findOne({ usertype: { $in: ["admin", "interviewer"] } }).sort({ createdAt: 1 });
    if (!fallbackUser) throw new Error("No eligible user found in User collection.");
    return fallbackUser;
};

const resolveSession = async ({ sessionId, interviewerId, candidateEmails }) => {
    if (sessionId) {
        if (!mongoose.Types.ObjectId.isValid(sessionId)) {
            throw new Error("Invalid --sessionId. Must be a valid ObjectId.");
        }
        const session = await InterviewSchedule.findById(sessionId);
        if (!session) throw new Error("No InterviewSchedule found for given --sessionId.");
        return session;
    }

    const existing = await InterviewSchedule.findOne({ interviewerId }).sort({ createdAt: -1 });
    if (existing) return existing;

    const now = new Date();
    const newSession = await InterviewSchedule.create({
        interviewerId,
        scheduledDate: now,
        startTime: `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`,
        candidateEmails,
        status: "Scheduled",
    });

    return newSession;
};

const main = async () => {
    const options = parseArgs();
    const seedRows = loadSeedData();

    if (!process.env.MONGO_URI) {
        throw new Error("MONGO_URI missing in backend/.env");
    }

    await mongoose.connect(process.env.MONGO_URI);

    const interviewer = await resolveInterviewer(options);
    const candidateEmails = seedRows
        .map((r) => String(r?.candidate_overview?.email || "").trim().toLowerCase())
        .filter(Boolean);

    const session = await resolveSession({
        sessionId: options.sessionId,
        interviewerId: interviewer._id,
        candidateEmails,
    });

    if (String(session.interviewerId) !== String(interviewer._id)) {
        throw new Error("Selected session belongs to a different interviewer.");
    }

    if (options.reset) {
        await FinalReport.deleteMany({ sessionId: session._id, interviewerId: interviewer._id });
    }

    const docs = seedRows.map((row) => ({
        ...row,
        sessionId: session._id,
        interviewerId: interviewer._id,
    }));

    const inserted = await FinalReport.insertMany(docs, { ordered: false });

    console.log("\nDummy report seeding complete.");
    console.log(`Interviewer: ${interviewer.username} (${interviewer.email})`);
    console.log(`InterviewerId: ${interviewer._id}`);
    console.log(`SessionId: ${session._id}`);
    console.log(`Inserted reports: ${inserted.length}`);
    console.log("Use these values in frontend localStorage if needed.");

    await mongoose.disconnect();
};

main().catch(async (err) => {
    console.error("Seeding failed:", err.message);
    if (mongoose.connection.readyState === 1) {
        await mongoose.disconnect();
    }
    process.exit(1);
});
