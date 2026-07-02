import mongoose from "mongoose";
const FinalReportSchema = new mongoose.Schema({
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "InterviewSchedule",
    required: true
  },
  interviewerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  candidateId: {
    type: String,
    default: null
  },


  candidate_overview: {
    name: { type: String },
    email: { type: String },
    group: { type: String, default: null },
    resumeUrl: { type: String, default: null },
    summary: { type: String, default: null },

    yearOfStudy: { type: String, default: null }
  },

  overall_performance: {
    score: { type: Number, default: null },
    performance_level: { type: String, default: null },
    summary: { type: String, default: null }
  },

  strengths: { type: [String], default: [] },
  weaknesses: { type: [String], default: [] },

  section_wise_evaluation: {
    general: {
      score: { type: Number, default: null },
      feedback: { type: String, default: null }
    },
    hr: {
      score: { type: Number, default: null },
      feedback: { type: String, default: null }
    },
    technical: {
      score: { type: Number, default: null },
      feedback: { type: String, default: null }
    }
  },

  face_analysis: {
    confidence_score: { type: Number, default: null },
    dominant_emotion: { type: String, default: null },
    last_emotion: { type: String, default: null },
    verification_rate: { type: Number, default: null },
    verification_status: { type: String, default: null },
    behavior_assessment: { type: String, default: null },
    behavior: { type: String, default: null },
    proctoring_severity: { type: String, default: null },
    verified_frames: { type: Number, default: null },
    total_frames: { type: Number, default: null },
    frame_count: { type: Number, default: null },
    cheating_reason_counts: {
      phone_detected: { type: Number, default: 0 },
      multiple_faces: { type: Number, default: 0 },
      no_face: { type: Number, default: 0 },
      looking_away: { type: Number, default: 0 },
      face_mismatch: { type: Number, default: 0 }
    },
    cheating_reason_seconds: {
      phone_detected: { type: Number, default: 0 },
      multiple_faces: { type: Number, default: 0 },
      no_face: { type: Number, default: 0 },
      looking_away: { type: Number, default: 0 },
      face_mismatch: { type: Number, default: 0 }
    },
    cheating_summary: {
      cheating_events: { type: Number, default: 0 },
      status: { type: String, default: null },
      severity: { type: String, default: null },
      primary_reason: { type: String, default: null },
      reason_counts: {
        phone_detected: { type: Number, default: 0 },
        multiple_faces: { type: Number, default: 0 },
        no_face: { type: Number, default: 0 },
        looking_away: { type: Number, default: 0 },
        face_mismatch: { type: Number, default: 0 }
      },
      reason_seconds: {
        phone_detected: { type: Number, default: 0 },
        multiple_faces: { type: Number, default: 0 },
        no_face: { type: Number, default: 0 },
        looking_away: { type: Number, default: 0 },
        face_mismatch: { type: Number, default: 0 }
      }
    }
  },

  final_recommendation: {
    type: new mongoose.Schema({
      decision: { type: String, default: null },
      justification: { type: String, default: null }
    }, { _id: false }),
    default: { decision: null, justification: null }
  },


  decision_status: {
    type: String,
    enum: ['pending', 'selected', 'rejected', 'completed'],
    default: 'pending'
  },
  company_name: {
    type: String,
    default: null
  },
  decision_date: {
    type: Date,
    default: null
  },
  decided_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  cheating_detected: {
    type: Boolean,
    default: false
  },
  cheating_reason: {
    type: String,
    default: null
  }



}, { timestamps: true });

// Prevent Mongo errors when updating nested fields if final_recommendation is null in existing docs.
// Convert dotted updates like { $set: { "final_recommendation.decision": "yes" } }
// into a single $set of the whole final_recommendation object.
FinalReportSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate();
  if (!update) return next();

  // work with $set if present, otherwise top-level update
  const setContainer = update.$set ? update.$set : update;
  const dottedKeys = Object.keys(setContainer).filter(k => k.startsWith('final_recommendation.'));

  if (dottedKeys.length === 0) return next();

  const fr = {};
  dottedKeys.forEach(key => {
    const subKey = key.replace('final_recommendation.', '');
    fr[subKey] = setContainer[key];
    // remove the dotted key from the original update location
    if (update.$set) {
      delete update.$set[key];
    } else {
      delete update[key];
    }
  });

  // ensure $set exists and set the whole object
  update.$set = update.$set || {};
  update.$set.final_recommendation = fr;

  this.setUpdate(update);
  next();
});

export default mongoose.model("FinalReport", FinalReportSchema);
