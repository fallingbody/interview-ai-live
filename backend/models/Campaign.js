import mongoose from "mongoose";

const campaignSchema = new mongoose.Schema({
    jobTitle: {
        type: String,
        required: true,
        trim: true
    },
    jobDescription: {
        type: String,
        trim: true
    },
    interviewType: {
        type: String,
        enum: ["Technical", "HR", "Mixed"],
        required: true
    },
    experienceLevel: {
        type: String,
        enum: ["Fresher", "1-3yrs", "3-5yrs", "5+yrs"],
        required: true
    },
    passThreshold: {
        type: Number,
        min: 0,
        max: 100,
        default: 65
    },
    candidateEmails: [{
        type: String,
        trim: true,
        lowercase: true
    }],
    status: {
        type: String,
        enum: ["Draft", "Active", "Completed", "Upcoming", "Expired"],
        default: "Draft"
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    }
}, {
    timestamps: true
});

export default mongoose.model("Campaign", campaignSchema);
