import dotenv from "dotenv";
dotenv.config();

import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!admin.apps.length) {
  try {
    // ✅ PRODUCTION (Render / Cloud / Vercel)
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      let serviceAccountData = process.env.FIREBASE_SERVICE_ACCOUNT.trim();
      
      // Remove any surrounding single or double quotes if they exist
      if (serviceAccountData.startsWith("'") && serviceAccountData.endsWith("'")) {
        serviceAccountData = serviceAccountData.slice(1, -1);
      } else if (serviceAccountData.startsWith('"') && serviceAccountData.endsWith('"')) {
        serviceAccountData = serviceAccountData.slice(1, -1);
      }

      const serviceAccount = JSON.parse(serviceAccountData);
      
      // ✅ REPAIR: Fix the private_key if the newlines are broken
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("✅ Firebase initialized from ENV (with key repair)");
    }
    // ✅ LOCAL DEVELOPMENT
    else {
      const serviceAccountPath = path.join(
        __dirname,
        "/interviewai-237e4-firebase-adminsdk-fbsvc-1a041a83d9.json"
      );

      const serviceAccount = JSON.parse(
        fs.readFileSync(serviceAccountPath, "utf-8")
      );

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log("✅ Firebase initialized from local file");
    }
  } catch (error) {
    console.error("❌ Firebase Admin initialization failed:", error.message);
  }
}

export default admin;
