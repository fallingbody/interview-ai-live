import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import InterviewSchedule from '../models/InterviewSchedule.js';
import User from '../models/User.js';
import { splitCandidatesIntoBatches, generateCandidateToken } from '../utils/interviewUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const mockSendEmail = (email, name, url, startStr, endStr, groupId) => {
    console.log(`============================================================`);
    console.log(`[EMAIL DISPATCH SYSTEM (MOCK)]`);
    console.log(`============================================================`);
    console.log(`To: ${name} <${email}>`);
    console.log(`Subject: Action Required: Your shr_scale Batch Interview Link`);
    console.log(`Batch: Group ${groupId}`);
    console.log(`Active Window: ${startStr} to ${endStr}`);
    console.log(`Access Link:\n${url}`);
    console.log(`============================================================\n`);
};

const main = async () => {
    console.log("[INIT] Initializing Seeding Script (shr_scale)...");

    try {
        await connectDB();
        
        // Find or create a dummy user to act as interviewer
        let user = await User.findOne({ email: "admin@shrscale.com" });
        if (!user) {
            user = await User.create({
                name: "Admin",
                email: "admin@shrscale.com",
                password: "password123", // Assuming validation allows this
                role: "admin"
            });
        }
        
        // 2. Create One Database Record representing the overall event
        const interviewEvent = new InterviewSchedule({
            interviewerId: user._id,
            scheduledDate: new Date(),
            startTime: "09:00",
            candidateEmails: [], // Will populate below
            status: 'Scheduled'
        });

        // 3. Generate 150 unique candidates
        const candidates = [];
        const emailsList = [];
        const candidateMap = {};

        for (let i = 1; i <= 150; i++) {
            const name = `Candidate Number ${String(i).padStart(3, '0')}`;
            const email = `candidate${String(i).padStart(3, '0')}@shrscale.com`;
            candidates.push({ name, email });
            emailsList.push(email);
            candidateMap[email] = name;
        }

        interviewEvent.candidateEmails = emailsList;
        await interviewEvent.save();
        
        const interviewId = interviewEvent._id.toString();
        console.log(`[SUCCESS] Committed single InterviewSchedule record to database (ID: ${interviewId}).`);
        console.log(`[SUCCESS] Generated 150 unique candidate records.`);

        // 4. Batch Group Logic: Split into N equal batches
        const numBatches = 3;
        const batchedEmails = splitCandidatesIntoBatches(emailsList, numBatches);
        
        console.log(`[STATUS] Candidates successfully split into ${numBatches} equal batches:`);
        batchedEmails.forEach((batch, idx) => {
            const groupCode = String.fromCharCode(65 + idx); // A, B, C...
            console.log(`   - Group ${groupCode}: ${batch.length} candidates`);
        });

        // 5. Define time-bound windows for each batch
        const now = new Date();
        const windows = [];
        for (let idx = 0; idx < numBatches; idx++) {
            const start = new Date(now.getTime() + idx * 60 * 60 * 1000); // + idx hours
            const end = new Date(start.getTime() + 60 * 60 * 1000); // + 1 hour
            windows.push({ start, end });
        }

        // 6. Generate Tokens and dispatch mock emails
        const outputData = [];
        console.log("\n[PROCESS] Executing JWT Token Generation & Mock Email Dispatch...");
        
        // Base URL of the React frontend typically
        const baseUrl = process.env.USER_FRONTEND_URL || "http://localhost:3001";
        
        batchedEmails.forEach((batch, idx) => {
            const groupCode = String.fromCharCode(65 + idx);
            const { start: startTime, end: endTime } = windows[idx];
            
            const startStr = startTime.toISOString();
            const endStr = endTime.toISOString();
            
            batch.forEach(email => {
                const name = candidateMap[email];
                
                const token = generateCandidateToken(
                    interviewId,
                    email,
                    name,
                    groupCode,
                    startTime,
                    endTime
                );
                
                // Construct final URL
                const deepLinkUrl = `${baseUrl}/interviewcheck/${interviewId}?token=${token}`;
                
                outputData.push({
                    email,
                    name,
                    group: groupCode,
                    start_time: Math.floor(startTime.getTime() / 1000),
                    end_time: Math.floor(endTime.getTime() / 1000),
                    token,
                    url: deepLinkUrl
                });
                
                mockSendEmail(email, name, deepLinkUrl, startStr, endStr, groupCode);
            });
        });

        // 7. Write all links to generated_tokens.json
        const outputFilePath = path.join(__dirname, 'generated_tokens.json');
        fs.writeFileSync(outputFilePath, JSON.stringify(outputData, null, 4));
            
        console.log("============================================================");
        console.log("[SUCCESS] SEEDING PROCESS COMPLETED SUCCESSFULLY");
        console.log("============================================================");
        console.log(`   Database Records: 1 InterviewSchedule (ID: ${interviewId})`);
        console.log(`   Candidates Seeded: 150 split into ${numBatches} batches`);
        console.log(`   Output JSON Path: scripts/generated_tokens.json`);
        console.log("============================================================\n");

    } catch (err) {
        console.error("Seeding failed:", err);
    } finally {
        mongoose.connection.close();
        process.exit(0);
    }
};

main();
