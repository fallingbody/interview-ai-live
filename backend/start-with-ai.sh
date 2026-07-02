#!/usr/bin/env sh
# Start the Python AI backend and then the Node backend.
# Usage: sh start-with-ai.sh

set -e

AI_PY_PATH="../ai/app/main.py"

if [ ! -f "$AI_PY_PATH" ]; then
  echo "Cannot find $AI_PY_PATH" >&2
  exit 1
fi

# Clear any existing process listening on port 5000 before starting the AI backend.
if command -v lsof >/dev/null 2>&1; then
  EXISTING_PIDS=$(lsof -ti TCP:5000 2>/dev/null || true)
  if [ -n "$EXISTING_PIDS" ]; then
    echo "Killing existing process(es) on port 5000: $EXISTING_PIDS"
    echo "$EXISTING_PIDS" | xargs -r kill
    sleep 1
  fi
fi

echo "Starting Python AI backend (Flask) in background..."
nohup python3 "$AI_PY_PATH" >/tmp/ai_backend.log 2>&1 &
AI_PID=$!
echo "AI backend started (pid=$AI_PID), logs -> /tmp/ai_backend.log"

echo "Starting Node backend on port 8000..."
export PORT=8000
node server.js

echo "Node exited, stopping AI backend (pid=$AI_PID)"
kill "$AI_PID" >/dev/null 2>&1 || true
