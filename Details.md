# 🎓 INTERVIEW-AI: THE ULTIMATE MASTER TECHNICAL GUIDE (EXTENDED VERSION)
---

## 📑 TABLE OF CONTENTS
1.  [**PROJECT ABSTRACT & VISION**](#1-overview)
2.  [**SYSTEM ARCHITECTURE: THE TRI-SERVICE MODEL**](#2-architecture)
3.  [**THE TECH STACK: COMPREHENSIVE DEPENDENCY AUDIT**](#3-tech-stack)
4.  [**DATABASE ARCHITECTURE: ENTITY RELATIONSHIP & SCHEMAS**](#4-database)
5.  [**BACKEND ENGINE: DEEP-DIVE LOGIC & MIDDLEWARE**](#5-backend)
6.  [**FRONTEND ENGINE: REACT PATTERNS & STATE MACHINES**](#6-frontend)
7.  [**AI MICROSERVICE: COMPUTER VISION & EXTRACTION PIPELINE**](#7-ai)
8.  [**INTEGRATION ARCHITECTURE: PROXIES & PAYLOADS**](#8-integration)
9.  [**SECURITY PROTOCOLS: FIREBASE, JWT & OTP**](#9-security)
10. [**STABILITY ENGINEERING: RESOLVING SERVERLESS CONSTRAINTS**](#10-stability)
11. [**FULL INSTALLATION & DEPLOYMENT BLUEPRINT**](#11-setup)
12. [**VIVA PREP: 50+ TECHNICAL QUESTIONS & ANSWERS**](#12-viva)
13. [**PROJECT CONCLUSION & FUTURE SCALE**](#13-conclusion)

---

<a name="1-overview"></a>
## 📝 1. PROJECT ABSTRACT & VISION
The **Interview-ai** platform is an end-to-end recruitment ecosystem designed to automate candidate screening while maintaining high security. The primary innovation is the **"Identity-Lock"** feature, which ensures that the candidate taking the interview matches the profile photo extracted from their resume.

**Problem Solved:** 
In remote hiring, recruiters often face "Interview Impersonation." Our system solves this by using AI to parse resumes, detect faces, and then force a real-time photo match if the AI is not 100% certain.

---

<a name="2-architecture"></a>
## 🏗️ 2. SYSTEM ARCHITECTURE: THE TRI-SERVICE MODEL
We utilize a **Micro-Service inspired Monolith Architecture**, deployed as three separate Vercel services:

### 🔹 A. The Admin Dashboard (Admin UI)
*   **Role:** Campaign management.
*   **Key Logic:** CSV parsing, Invite dispatching, and Report analytics.
*   **Endpoint:** `interview-ai-admin-dashboard.vercel.app`

### 🔹 B. The Interview Room (Candidate UI)
*   **Role:** Real-time interview environment.
*   **Key Logic:** Video stream handling, Resume AI verification, and Proctoring logs.
*   **Endpoint:** `interview-ai-room.vercel.app`

### 🔹 C. The Core Backend (API Gateway)
*   **Role:** Central logic & persistence.
*   **Key Logic:** MongoDB connectivity, Firebase Auth bridge, and AI Proxying.
*   **Endpoint:** `interview-ai-admin-backend.vercel.app`

---

<a name="3-tech-stack"></a>
## 🧪 3. THE TECH STACK: COMPREHENSIVE DEPENDENCY AUDIT

### 🔹 Frontend Layer (React.js)
1.  **`react-router-dom`**: Used for Nested Routes and Protected Routes. 
    *   *Implementation:* We use `Navigate` and `Location` to redirect unauthenticated users back to `/login`.
2.  **`firebase/auth`**: Our primary identity provider.
    *   *Implementation:* We use `onAuthStateChanged` to sync the Firebase session with our custom MongoDB user state.
3.  **`lucide-react`**: Vector icons for low-weight, high-DPI visuals.
4.  **`axios`**: Configured with `baseURL` and `headers` to communicate with our Node.js API.

### 🔹 Backend Layer (Node.js/Express)
1.  **`mongoose`**: We use Mongoose for **Strict Schema Validation**.
    *   *Logic:* It prevents accidental data insertion of malformed campaign objects.
2.  **`jsonwebtoken` (JWT)**: Used for stateless authentication.
    *   *Payload:* `{ id, uid, usertype }`. Signed with a `secret` and expires in 7 days.
3.  **`nodemailer`**: Used for SMTP communication.
    *   *Logic:* Connects to Gmail's server via an **App Password** for secure delivery.
4.  **`csv-parser`**: A stream-based parser.
    *   *Performance:* It can process a 10,000-row CSV in less than 500ms without blocking the main event loop.

### 🔹 AI Layer (Python/FastAPI)
1.  **`PyMuPDF` (fitz)**: The fastest PDF engine for Python. 
    *   *Logic:* It scans the PDF binary for `Image` objects without rendering the full page, making it 5x faster than traditional OCR.
2.  **`face_recognition`**: Based on Dlib's state-of-the-art face recognition built with deep learning. 
    *   *Logic:* It returns a 128-dimension face encoding for every detected face.

---

<a name="4-database"></a>
## 🗄️ 4. DATABASE ARCHITECTURE: ENTITY RELATIONSHIP & SCHEMAS

### 🔹 User Model (`models/User.js`)
| Field | Type | Description |
| :--- | :--- | :--- |
| `username` | String | Unique index for login. |
| `email` | String | Unique index for communication. |
| `password` | String | Bcrypt hash (not plain text). |
| `uid` | String | The UUID from Firebase for cross-service syncing. |
| `otp` | String | Temporary 6-digit code for registration. |

### 🔹 Campaign Model (`models/Campaign.js`)
| Field | Type | Description |
| :--- | :--- | :--- |
| `jobTitle` | String | The name of the role. |
| `candidateEmails` | Array | List of invited candidates. |
| `createdBy` | ObjectId | Reference to the `User` model. |
| `status` | Enum | [Draft, Active, Completed, Expired]. |

---

<a name="5-backend"></a>
## ⚙️ 5. BACKEND ENGINE: DEEP-DIVE LOGIC & MIDDLEWARE

### 🔹 The Authentication Pipeline
The registration process is a **Synchronized Multi-Database Operation**:
1.  **Firebase Create:** First, the user is created in Firebase.
2.  **Mongo Save:** If Firebase succeeds, we save the `uid` and details into MongoDB.
3.  **OTP Trigger:** A random 6-digit code is generated: `Math.floor(100000 + Math.random() * 900000)`.
4.  **Email Dispatch:** The OTP is sent via `nodemailer`.

### 🔹 The Custom "Authenticate" Middleware
```javascript
async function authenticate(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ message: "Unauthorized" });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = { id: decoded.id, uid: decoded.uid }; // Injects user info into the request
        next(); // Continues to the controller
    } catch (err) {
        return res.status(401).json({ message: "Invalid Token" });
    }
}
```

---

<a name="6-frontend"></a>
## 💻 6. FRONTEND ENGINE: REACT PATTERNS & STATE MACHINES

### 🔹 Handling Asynchronous File Scans
In `UserForm.jsx`, we use a **State Machine** pattern for the Resume Scan:
*   **`idle`**: Waiting for user to pick a file.
*   **`scanning`**: `isScanningResume = true`. UI shows a searching animation.
*   **`success`**: `scanMessage` shows "Photo detected."
*   **`fallback`**: `needsCandidateImage = true`. UI shows the camera upload block.

### 🔹 Functional State Updates (Crucial Knowledge)
 examiners often ask about state bugs. We fixed this using:
```javascript
setForm(prev => ({ ...prev, [name]: value }));
```
**Why?** This ensures that even if two state updates happen at the exact same millisecond (e.g., name typed + file scanned), neither update is lost.

---

<a name="7-ai"></a>
## 🤖 7. AI MICROSERVICE: COMPUTER VISION & EXTRACTION PIPELINE

### 🔹 The Resume Scanning Algorithm (Step-by-Step)
1.  **PDF-to-Image:** The Python service takes the uploaded PDF.
2.  **Object Extraction:** It extracts all embedded images using `fitz.get_page_images()`.
3.  **Face Detection:** Each image is converted to an RGB array.
4.  **HOG Model:** We use a **Histogram of Oriented Gradients (HOG)** model to find face patterns.
5.  **Result:** If a face is found, it returns `has_face_image: true`.

---

<a name="8-integration"></a>
## 🔗 8. INTEGRATION ARCHITECTURE: PROXIES & PAYLOADS

### 🔹 The Backend Proxy (Security Layer)
The Frontend never talks to the Python AI service directly. 
**Why?** 
1.  **CORS Safety:** Python FastAPI and React often have CORS conflicts. Node.js acts as a trusted middleman.
2.  **API Hiding:** The Python service's URL is hidden in the Backend's `.env`, making it impossible for hackers to spam the AI service directly.

---

<a name="9-security"></a>
## 🔒 9. SECURITY PROTOCOLS: FIREBASE, JWT & OTP

### 🔹 2-Factor Authentication (2FA) Implementation
1.  **Level 1:** Firebase verify (Email/Password).
2.  **Level 2:** Email OTP (Verifies the user has access to the actual email inbox).
3.  **Level 3:** JWT Session (Stateless and signed, prevents session hijacking).

---

<a name="10-stability"></a>
## 🛡️ 10. STABILITY ENGINEERING: RESOLVING SERVERLESS CONSTRAINTS

### 🔹 The "Global Database Shield"
Vercel is **Stateless**. This means the database connection can die between clicks.
**The Solution:**
```javascript
app.use(async (req, res, next) => {
    await connectDB(); // Ensures DB is ready before ANY controller runs
    next();
});
```

### 🔹 Firebase Private Key Repair
Vercel's environment variable UI often turns `\n` into `\\n`. We fixed this in `firebaseAdmin.js`:
```javascript
const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
```