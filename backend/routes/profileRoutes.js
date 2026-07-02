import express from "express";
import { getProfile, updateProfile } from "../controllers/profileController.js";
import authenticate from "../middleware/authenticate.js";

const router = express.Router();

router.get("/profile", authenticate, getProfile);
router.put("/profile", authenticate, updateProfile);

export default router;
