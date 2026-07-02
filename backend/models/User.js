import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email:    { type: String, required: true, unique: true },
  password: { type: String, required: true },
  usertype: { type: String, enum: ["admin", "interviewer", "candidate"], default: "admin" },

  otp:      { type: String },
  otpExpires: { type: Date },
  uid:{type:String,required:true},
  
  // Flag to check if the user has completed OTP verification
  isVerified: { type: Boolean, default: false },

  // NEW FIELD: Temporarily holds the hash of the new password during OTP verification
  tempPasswordHash: { type: String }, 

  company_name: { type: String, default: "Interview.ai" }
});

export default mongoose.model("User", userSchema);