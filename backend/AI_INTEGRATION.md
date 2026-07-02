Integration notes: `face_ai.py` (Flask) and Node backend
---------------------------------------------------

What this does
- The Node backend proxies AI-related requests to a separate Python Flask service implemented in `ai/face_ai.py`.

How to run locally
1. Install Python dependencies for the AI service (from the `ai` folder):

```bash
cd ai
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Start the AI service (from `backend` or `ai`):

From `backend` (uses provided helper):

```bash
cd backend
sh start-with-ai.sh
```

Or directly from `ai`:

```bash
cd ai
python3 face_ai.py
```

3. Start the Node backend (if not using `start-with-ai.sh`):

```bash
cd backend
npm start
```

Environment variables
- `FLASK_API_KEY` -- set this to the same value the Node backend uses for `AI_BACKEND_API_KEY` so the proxy works. Example:

```bash
export FLASK_API_KEY=your-secret-key
export AI_BACKEND_API_KEY=your-secret-key
```

Notes
- The Node controller `aiProxyController.js` already proxies requests to `http://127.0.0.1:5000` by default. If you run the Flask app on a different host/port, set `AI_BACKEND_URL` in environment.
- The `start-with-ai.sh` script launches the Flask app in background and writes logs to `/tmp/ai_backend.log`.
- For production, consider running the Python service under a process manager (systemd, gunicorn, or container) and securing API keys.
- The Node controller `aiProxyController.js` now uses `node-fetch` + `form-data` for reliable server-side multipart proxying.

Quick test checklist
1. Install Node dependencies in `backend`:

```bash
cd backend
npm install
```

2. Make the helper script executable (optional):

```bash
cd backend
chmod +x start-with-ai.sh
```

3. Start services (helper):

```bash
sh start-with-ai.sh
```

4. Quick curl tests (replace `your-key` with `FLASK_API_KEY` used by Flask):

Upload a resume (multipart):

```bash
curl -v -X POST "http://127.0.0.1:8000/api/ai/resumes/upload" \
	-H "X-API-KEY: your-key" \
	-F "name=Test Candidate" \
	-F "email=test@example.com" \
	-F "file=@/path/to/sample_resume.pdf;type=application/pdf"
```

Start an interview (JSON):

```bash
curl -v -X POST "http://127.0.0.1:8000/api/ai/interviews/start" \
	-H "Content-Type: application/json" \
	-H "X-API-KEY: your-key" \
	-d '{"candidate_id":"<id>","resume_id":"<resume_id>","role":"General"}'
```

Analyze a frame (multipart):

```bash
curl -v -X POST "http://127.0.0.1:8000/api/ai/analyze-frame" \
	-H "X-API-KEY: your-key" \
	-F "session_id=testsession" \
	-F "image=@/path/to/photo.jpg;type=image/jpeg"
```

If any request returns a 502 with message "AI backend is unavailable", check `/tmp/ai_backend.log` and the Node console for specific errors.
