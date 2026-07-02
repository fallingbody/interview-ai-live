import mongoose from "mongoose";
const interviewScheduleSchema = new mongoose.Schema({
    interviewerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    scheduledDate: {
        type: Date,
        required: true
    },
    startTime: {
        type: String,
        required: true
    },
    jobTitle: {
        type: String,
        trim: true,
        default: "General Role"
    },

    candidateEmails: [{
        type: String,
        required: true,
        trim: true,
        lowercase: true
    }],
    candidateAttempts: [{
        type: String,
        trim: true,
        lowercase: true,
        default: [],
    }],
    status: {
        type: String,
        enum: ['Scheduled', 'Completed', 'Cancelled'],
        default: 'Scheduled'
    },
    dispatchSummary: {
        invitedCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        failedCount: {
            type: Number,
            default: 0,
            min: 0,
        },
        failedEmails: [{
            type: String,
            trim: true,
            lowercase: true,
        }],
        lastDispatchAt: {
            type: Date,
            default: null,
        },
        lastSessionLink: {
            type: String,
            default: null,
        },
        dispatchAttempts: {
            type: Number,
            default: 0,
            min: 0,
        },
    }
}, {
    timestamps: true
});

export default mongoose.model('InterviewSchedule', interviewScheduleSchema);