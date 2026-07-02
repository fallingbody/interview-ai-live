import os
import json
import asyncio
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import websockets
from app.core.logger import get_logger
from app.core.config import settings

logger = get_logger(__name__)
router = APIRouter()

@router.websocket("/ws/interview/{session_id}")
async def interview_websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()
    
    api_key = (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or "").strip()
    if not api_key:
        logger.error("GEMINI_API_KEY not configured for WebSocket.")
        await websocket.close(code=1011, reason="Server API key missing")
        return

    gemini_ws_url = f"wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key={api_key}"
    
    try:
        async with websockets.connect(gemini_ws_url) as gemini_ws:
            logger.info(f"Connected to Gemini Live API for session {session_id}")
            
            # Wait for the initial setup message from the frontend
            setup_msg_raw = await websocket.receive_text()
            setup_msg_client = json.loads(setup_msg_raw)
            
            # Extract resume and role from the frontend setup message
            resume_text = setup_msg_client.get("resume_text", "No resume provided.")
            role = setup_msg_client.get("role", "Candidate")
            
            # Construct the Gemini setup payload
            gemini_setup = {
                "setup": {
                    "model": "models/gemini-3-flash-live",
                    "generationConfig": {
                        "responseModalities": ["AUDIO"],
                        "speechConfig": {
                            "voiceConfig": {
                                "prebuiltVoiceConfig": {
                                    "voiceName": "Puck" # E.g., Puck, Aoede, Charon, Kore, Fenrir
                                }
                            }
                        }
                    },
                    "systemInstruction": {
                        "parts": [
                            {
                                "text": f"""You are a senior technical and HR interviewer conducting a job interview for the {role} role.
You must speak conversationally, keep your responses concise, and ask relevant questions based on this resume:
{resume_text}

Rules:
- Be friendly but professional.
- Ask one question at a time.
- If the candidate pauses, give them time to think.
- Keep your questions under 25 words."""
                            }
                        ]
                    }
                }
            }
            
            await gemini_ws.send(json.dumps(gemini_setup))
            
            # Read setup confirmation from Gemini (first message is usually a setup response)
            setup_response = await gemini_ws.recv()
            logger.info("Received setup response from Gemini.")

            # Send a ready signal to the frontend
            await websocket.send_json({"type": "ready"})
            
            # Define proxy tasks
            async def frontend_to_gemini():
                try:
                    while True:
                        # Receive base64 audio chunks from React
                        data = await websocket.receive_text()
                        payload = json.loads(data)
                        
                        if payload.get("type") == "realtime_input":
                            b64_audio = payload.get("mediaChunks", [])[0].get("data")
                            if b64_audio:
                                gemini_msg = {
                                    "realtimeInput": {
                                        "mediaChunks": [
                                            {
                                                "mimeType": "audio/pcm;rate=16000",
                                                "data": b64_audio
                                            }
                                        ]
                                    }
                                }
                                await gemini_ws.send(json.dumps(gemini_msg))
                        elif payload.get("type") == "client_content":
                             # Used for interruption (sending text or clearing buffer)
                             # Gemini Live API supports sending clientContent with turnComplete
                             gemini_msg = {
                                 "clientContent": {
                                     "turns": [
                                         {
                                             "role": "user",
                                             "parts": [{"text": "Stop."}]
                                         }
                                     ],
                                     "turnComplete": True
                                 }
                             }
                             await gemini_ws.send(json.dumps(gemini_msg))
                             
                except WebSocketDisconnect:
                    logger.info("Frontend disconnected.")
                except Exception as e:
                    logger.error(f"Error in frontend_to_gemini: {e}")
            
            async def gemini_to_frontend():
                try:
                    while True:
                        # Receive response from Gemini
                        response_raw = await gemini_ws.recv()
                        response = json.loads(response_raw)
                        
                        # Forward serverContent (audio/text) to frontend
                        if "serverContent" in response:
                            await websocket.send_json({
                                "type": "server_content",
                                "serverContent": response["serverContent"]
                            })
                except websockets.exceptions.ConnectionClosed:
                    logger.info("Gemini WebSocket closed.")
                except Exception as e:
                    logger.error(f"Error in gemini_to_frontend: {e}")
                    
            # Run both proxy tasks concurrently
            await asyncio.gather(
                frontend_to_gemini(),
                gemini_to_frontend()
            )
            
    except Exception as e:
        logger.error(f"WebSocket Proxy Error: {e}")
    finally:
        try:
            await websocket.close()
        except:
            pass
