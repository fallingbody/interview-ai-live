# Interview.ai – AI-Powered Interview Platform

Interview.ai is a full-stack AI-driven interview platform that enables organizations to schedule, conduct, and evaluate interviews automatically. It uses speech recognition, AI-powered dynamic questioning (via Groq), facial analysis/verification, and structured reporting.

## 📁 Project Structure

This project consists of 4 main services, which must all be running simultaneously in development.

```
project-root/
│
├── backend/          # Node.js + Express backend (MongoDB) for core app management (users, campaigns, basic reports).
├── ai/               # Python + Flask AI engine (PostgreSQL + Redis) for real-time interview generation, STT, TTS, and Face Verification.
├── frontend/         # React application for the Admin / HR Dashboard.
└── user_frontend/    # React application for the Candidate Interview Experience.
```

---

## 🛠️ Prerequisites

Make sure you have the following installed on your machine:
* **Node.js** (v18 or later)
* **Python** (v3.10 or later)
* **Redis server** (Running locally on default port `6379`, or a remote Redis URL)
* **MongoDB Atlas** account (or local MongoDB)
* **PostgreSQL** database (Local or Cloud like NeonDB)
* Accounts for active APIs:
  * **Groq** (AI Inference)
  * **Resend** (Email dispatch)
  * **Google Firebase Service Account** (Auth)

---

## ⚙️ Environment Variables Setup

You will need to create `.env` files in four separate directories.

### 1. `backend/.env`
```env
PORT=8000
JWT_SECRET=your_secure_random_jwt_secret
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/<database>?retryWrites=true&w=majority
EMAIL_SENDER=your_email@resend.com
RESEND_API_KEY=your_resend_api_key

# Firebase settings
FIREBASE_SERVICE_ACCOUNT={ "type": "...", "project_id": "...", ... }
```

### 2. `ai/.env`
```env
ENV=development
API_KEY=production-dev-key
DATABASE_URL=postgresql://<user>:<pass>@<database-host>/<db>?sslmode=require
REDIS_URL=redis://localhost:6379/0
GROQ_API_KEY=your_groq_api_key
NUMBER_OF_QUESTIONS=8
```

### 3. `frontend/.env` (Admin / HR)
```env
REACT_APP_API_BASE_URL=http://localhost:8000
REACT_APP_USER_URL=http://localhost:3001
RESEND_API_KEY=your_resend_api_key_here
```

### 4. `user_frontend/.env` (Candidate / User)
```env
PORT=3001
REACT_APP_API_BASE_URL=http://localhost:8000
REACT_APP_FLASK_API_BASE_URL=http://127.0.0.1:5000
REACT_APP_FLASK_API_KEY=production-dev-key
```

---

## 🚀 Setup & Launch Guide

To run the full stack, open **4 separate terminal windows** and execute the commands below.

### 1. Start the Redis Server (Requirement for AI backend)
Ensure your Redis server is running locally (e.g., via `redis-server` on Linux/Mac or Memurai/WSL on Windows).

### 2. Launch the AI Engine (Terminal 1)
This service handles all AI interactions, TTS, and Face Analysis.
```bash
cd ai
# Create & activate a virtual environment
python -m venv .venv
# Windows:
.\.venv\Scripts\activate
# Linux/Mac:
# source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations to prepare your PostgreSQL DB
python -m alembic -c migrations/alembic.ini upgrade head

# Start the Flask AI server
python -m app.main
```
_Runs on `http://127.0.0.1:5000`_

### 3. Launch the Node Core Backend (Terminal 2)
This handles auth, campaigns, reporting logic, and candidate data.
```bash
cd backend
npm install
npm start
```
_Runs on `http://localhost:8000`_

### 4. Launch the Admin / HR Dashboard (Terminal 3)
```bash
cd frontend
npm install
npm start
```
_Runs on `http://localhost:3000`_

### 5. Launch the Candidate UI (Terminal 4)
```bash
cd user_frontend
npm install
npm start
```
_Runs on `http://localhost:3001`_

---

## 🌟 Core Features
* **Interview Session Scheduling:** Create timed campaigns and generate access via deep links.
* **Proctoring & Identity Check:** Deepface-based face verification pre- and mid-interview.
* **AI-Driven Question Flow:** Generates dynamic technical and non-technical questions in real-time based on the candidate's resume and initial responses.
* **Speech-to-Text & Text-to-Speech:** Deepgram / Whisper / PocketTTS implementations for a fluid conversational experience.
* **Comprehensive AI Reports:** Evaluates candidate competency (Scores for HR, Technical, General constraints) and generates final hire/reject recommendations.
* **Bulk Offer Management:** Send mass Selection vs Rejection outcome emails to participants.

---

## 🔒 Security Practices
* Strict API key validation using `REACT_APP_FLASK_API_KEY`.
* CORS restrictions implemented on Flask & Express.
* Database URLs and secrets segregated via `dotenv`.
* Firebase JWT tokens validate all HR protected endpoints.
