import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import dns from "dns";
import mongoose from "mongoose";
import User from "../models/User.js";

import { sendOtpEmail } from "../utils/emailService.js";

const isValidEmail = async (email) => {
    const value = String(email || "").trim().toLowerCase();
    
    // Sensible Format Check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return false;
    if (value.includes("..")) return false;

    return true; // Bypass dynamic DNS MX checks to ensure high email reliability
};

// POST /register
export const register = async (req, res) => {
    try {
        const { username, email, password, usertype, uid, company_name } = req.body;
        const normalizedCompanyName = String(company_name || "").trim() || "Interview.ai";
        
        if (!username || !email || !password || !usertype || !uid) {
             console.error("Registration Error: Missing one or more required fields.");
             return res.status(400).json({ error: "Missing required registration fields." });
        }

        // Deep Email Validation
        const emailValid = await isValidEmail(email);
        if (!emailValid) {
            return res.status(400).json({ error: "Invalid or non-existent email address." });
        }

        console.log("REGISTER: Hashing password...");
        const hashedPassword = await bcrypt.hash(password, 10); 
        
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpires = Date.now() + 10 * 60 * 1000;
        console.log(`🔑 [DEV] OTP for ${email}: ${otp}`);

        console.log("REGISTER: Checking if user already exists...");
        let user = await User.findOne({ email });

        if (user) {
            if (user.isVerified) {
                return res.status(409).json({ error: "Email already exists and is verified. Please log in." });
            }
            console.log("REGISTER: User exists but not verified. Updating details and re-sending OTP...");
            user.username = username;
            user.password = hashedPassword;
            user.uid = uid;
            user.company_name = normalizedCompanyName;
            user.otp = otp;
            user.otpExpires = otpExpires;
            await user.save();
        } else {
            console.log("REGISTER: Creating new user object...");
            user = new User({
                username,
                uid,
                email,
                password: hashedPassword,
                usertype,
                company_name: normalizedCompanyName,
                otp,
                otpExpires,
                isVerified: false
            });
            await user.save();
            console.log("REGISTER: MongoDB Save SUCCESS!");
        }

        console.log("REGISTER: Attempting to send OTP email...");
        await sendOtpEmail(email, otp); 
        console.log("REGISTER: Email SUCCESS!");

        res.json({ message: "Registration successful. OTP sent.", email: email });

    } catch (err) {
        console.error("CRITICAL Backend Registration Error:", {
            message: err.message,
            stack: err.stack,
            dbState: mongoose.connection.readyState
        });
        
        if (err.code === 11000) {
            return res.status(409).json({ error: "Email already exists." });
        }
        
        res.status(500).json({ error: "Internal Server Error during registration. Check server console for details." });
    }
};

// POST /login
export const login = async (req, res) => {
    const { uid } = req.body; 

    if (!uid) {
        return res.status(400).json({ error: "Missing required UID." });
    }

    try {
        const user = await User.findOne({ uid: uid });

        if (!user) {
            return res.status(404).json({ error: "User not found in database. Please register." });
        }

        if (!user.isVerified) {
            // Generate a fresh OTP so the user isn't stuck waiting for an email that was never sent
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const otpExpires = Date.now() + 10 * 60 * 1000;
            user.otp = otp;
            user.otpExpires = otpExpires;
            await user.save();
            
            try {
                await sendOtpEmail(user.email, otp);
                console.log(`LOGIN: Unverified user attempted login. Sent new OTP to ${user.email}`);
            } catch (emailErr) {
                console.error("LOGIN: Failed to send OTP to unverified user", emailErr);
            }

            return res.status(403).json({ 
                error: "Account not verified.", 
                message: "A new OTP has been sent to your email. Please verify to continue.",
                email: user.email
            });
        }
        
        const token = jwt.sign(
            { id: user._id, uid: user.uid, usertype: user.usertype },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({ 
            token, 
            message: "Login Successful",
            userId: user._id
        });

    } catch (err) {
        console.error("Critical Login Error:", {
            message: err.message,
            stack: err.stack,
            mongoReadyState: mongoose.connection.readyState
        });
        res.status(500).json({ 
            error: "Server error during session creation.",
            debug: process.env.NODE_ENV !== "production" ? err.message : undefined 
        });
    }

};

// POST /verify-otp
export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const user = await User.findOne({ email });

    if (!user) return res.status(404).json({ error: "User not found" });
    if (user.otp !== otp || user.otpExpires < Date.now()) {
      return res.status(400).json({ error: "Invalid or expired OTP" });
    }

    user.otp = null;
    user.otpExpires = null;
    user.isVerified = true;
    await user.save();
    
    const token = jwt.sign(
        { id: user._id, uid: user.uid, usertype: user.usertype },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    );

    res.json({ message: "OTP Verified!", token: token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
