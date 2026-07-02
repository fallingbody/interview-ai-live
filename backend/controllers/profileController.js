import User from "../models/User.js";
import admin from "../config/firebaseAdmin.js";

// GET /profile
export const getProfile = async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.firebaseUser.uid }).select('-password -otp -otpExpires -__v');
    
    if (!user) {
      return res.status(404).json({ error: "User profile not found." });
    }

    res.json(user);
  } catch (err) {
    console.error("GET Profile Error:", err);
    res.status(500).json({ 
      error: "Failed to fetch user profile.",
      debug: err.message
    });
  }
};

// PUT /profile
export const updateProfile = async (req, res) => {
  const { username, email, newPassword, company_name } = req.body;
  const firebaseUid = req.firebaseUser.uid;

  try {
    const mongoUpdate = {};
    if (username) mongoUpdate.username = username;
    if (email) mongoUpdate.email = email; 
    if (company_name !== undefined) mongoUpdate.company_name = company_name;

    if (Object.keys(mongoUpdate).length > 0) {
      await User.updateOne({ uid: firebaseUid }, { $set: mongoUpdate });
    }

    if (newPassword) {
      await admin.auth().updateUser(firebaseUid, { password: newPassword });
    }

    res.json({ message: "Profile updated successfully." });

  } catch (err) {
    console.error("PUT Profile Error:", err);
    if (err.code === 11000) {
      return res.status(409).json({ error: "Email is already taken." });
    }
    res.status(500).json({ error: "Failed to update profile." });
  }
};
