---
title: Interview AI Engine
emoji: 🤖
colorFrom: indigo
colorTo: purple
sdk: docker
app_port: 7860
pinned: false
---

# Interview AI Engine

This is the backend AI engine for the Interview.ai platform, handling video analysis, proctoring, and candidate evaluation.

## Local Setup

```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or
source venv/Scripts/activate  # Windows

pip install "numpy==1.26.4" "setuptools<82" "protobuf==4.25.3"
pip install -r requirements.txt

alembic -c migrations/alembic.ini upgrade head
python -m app.main
```
