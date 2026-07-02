import sys
import re

def resolve_file(filepath):
    with open(filepath, 'r') as f:
        lines = f.readlines()
        
    out_lines = []
    state = "NORMAL" # NORMAL, IN_HEAD, IN_THEIRS
    
    for line in lines:
        if line.startswith("<<<<<<< HEAD"):
            state = "IN_HEAD"
            continue
        elif line.startswith("======="):
            if state == "IN_HEAD":
                state = "IN_THEIRS"
                continue
        elif line.startswith(">>>>>>>"):
            if state == "IN_THEIRS":
                state = "NORMAL"
                continue
                
        if state == "NORMAL" or state == "IN_HEAD":
            out_lines.append(line)
            
    with open(filepath, 'w') as f:
        f.writelines(out_lines)

files = [
    "/home/unicorn/Desktop/Interview-ai/backend/controllers/reportController.js",
    "/home/unicorn/Desktop/Interview-ai/frontend/src/Home/CandidateOverview.jsx",
    "/home/unicorn/Desktop/Interview-ai/frontend/src/Home/Home.css",
    "/home/unicorn/Desktop/Interview-ai/user_frontend/src/components/UserForm.jsx",
    "/home/unicorn/Desktop/Interview-ai/user_frontend/src/components/UserInterviewRoom.jsx",
    "/home/unicorn/Desktop/Interview-ai/user_frontend/src/components/InterviewCheck.jsx",
    "/home/unicorn/Desktop/Interview-ai/user_frontend/src/components/StartInterview.jsx"
]

for file in files:
    resolve_file(file)
    print(f"Resolved {file}")

