from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import tempfile
import shutil
from pathlib import Path
from uuid import uuid4

import fitz  # PDF
from deepface import DeepFace

app = Flask(__name__)
CORS(app)

UPLOADS_DIR = Path("uploads")
UPLOADS_DIR.mkdir(exist_ok=True)

session_store = {}
resume_store = {}

# ========================
# SESSION
# ========================
def create_session():
    return {
        "reference_image": None,
        "verified_frames": 0,
        "total_frames": 0,
        "terminated": False
    }

def get_session(session_id):
    if session_id not in session_store:
        session_store[session_id] = create_session()
    return session_store[session_id]

# ========================
# EXTRACT IMAGE FROM PDF
# ========================
def extract_image_from_pdf(file_path, resume_id):
    doc = fitz.open(file_path)

    for page_index in range(len(doc)):
        page = doc[page_index]
        images = page.get_images(full=True)

        for img in images:
            xref = img[0]
            base = doc.extract_image(xref)
            image_bytes = base["image"]

            img_path = UPLOADS_DIR / f"{resume_id}.jpg"
            with open(img_path, "wb") as f:
                f.write(image_bytes)

            return str(img_path)

    return None

# ========================
# UPLOAD RESUME
# ========================
@app.route("/api/resumes/upload", methods=["POST"])
def upload_resume():
    file = request.files.get("file")
    name = request.form.get("name")
    email = request.form.get("email")

    if not file:
        return jsonify({"error": "No file"}), 400

    resume_id = str(uuid4())
    file_path = UPLOADS_DIR / f"{resume_id}.pdf"
    file.save(file_path)

    # Extract image
    image_path = extract_image_from_pdf(file_path, resume_id)

    if not image_path:
        return jsonify({
            "error": "Resume must contain a clear photo"
        }), 400

    resume_store[resume_id] = {
        "image_path": image_path
    }

    return jsonify({
        "message": "Resume uploaded",
        "resume_id": resume_id
    })

# ========================
# START SESSION
# ========================
@app.route("/start", methods=["POST"])
def start():
    data = request.json
    session_id = data.get("session_id")
    resume_id = data.get("resume_id")

    if resume_id not in resume_store:
        return jsonify({"error": "Invalid resume"}), 400

    session = create_session()
    session["reference_image"] = resume_store[resume_id]["image_path"]

    session_store[session_id] = session

    return jsonify({"message": "Session started"})

# ========================
# VERIFY FACE
# ========================
@app.route("/verify-face", methods=["POST"])
def verify_face():
    session_id = request.form.get("session_id")
    image = request.files.get("image")

    session = get_session(session_id)

    if session.get("terminated"):
        return jsonify({
            "terminated": True,
            "reason": "Already terminated"
        }), 403

    if not image:
        return jsonify({"error": "No image"}), 400

    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as temp:
        path = temp.name
        image.save(path)

    try:
        result = DeepFace.verify(
            img1_path=session["reference_image"],
            img2_path=path,
            enforce_detection=False
        )

        verified = result["verified"]
        distance = result["distance"]

        session["total_frames"] += 1

        if verified:
            session["verified_frames"] += 1

        # 🚨 CHEATING DETECTION
        if not verified:
            session["terminated"] = True

            return jsonify({
                "terminated": True,
                "reason": "CHEATING DETECTED",
                "verified": False
            }), 403

        return jsonify({
            "verified": True,
            "distance": distance
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        os.remove(path)

# ========================
# END SESSION
# ========================
@app.route("/end", methods=["POST"])
def end():
    data = request.json
    session_id = data.get("session_id")

    session = get_session(session_id)

    total_frames = session.get("total_frames", 0)
    verified_frames = session.get("verified_frames", 0)

    verification_rate = (
        (verified_frames / total_frames) * 100
        if total_frames else 0
    )

    return jsonify({
        "verification_rate": round(verification_rate, 2),
        "status": "verified" if verification_rate > 60 else "suspicious",
        "terminated": session.get("terminated", False),
        "total_frames": total_frames,
        "verified_frames": verified_frames,
    })

# ========================
# RUN
# ========================
if __name__ == "__main__":
    app.run(port=5000, debug=True)