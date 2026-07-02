import { useState, useEffect, useRef, useCallback } from 'react';

const FLASK_API_BASE_URL = process.env.REACT_APP_FLASK_API_BASE_URL || 'http://localhost:8000';
// Convert http/https to ws/wss
const WS_BASE_URL = FLASK_API_BASE_URL.replace(/^http/, 'ws');

export const useLiveAPI = ({ sessionId, resumeText, role, onAiSpeakingChange }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);
  
  // Audio Context and Node Refs
  const audioContextRef = useRef(null);
  const audioWorkletNodeRef = useRef(null);
  const mediaStreamSourceRef = useRef(null);
  
  // Playback state
  const nextPlayTimeRef = useRef(0);
  const audioQueueRef = useRef([]);
  const isPlayingRef = useRef(false);

  const initAudioContext = async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000,
      });
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
  };

  const connect = useCallback(async () => {
    try {
      await initAudioContext();
      
      const wsUrl = `${WS_BASE_URL}/api/ws/interview/${sessionId}`;
      console.log(`Connecting to WebSocket: ${wsUrl}`);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connected. Sending setup message.");
        ws.send(JSON.stringify({
          type: "setup",
          resume_text: resumeText,
          role: role
        }));
      };

      ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "ready") {
          setIsConnected(true);
        } else if (msg.type === "server_content") {
          // Process Gemini response
          const serverContent = msg.serverContent;
          if (serverContent.modelTurn) {
            const parts = serverContent.modelTurn.parts;
            for (const part of parts) {
              if (part.inlineData && part.inlineData.mimeType.startsWith("audio/pcm")) {
                const base64Audio = part.inlineData.data;
                playAudioChunk(base64Audio);
              }
            }
          }
        }
      };

      ws.onerror = (err) => {
        console.error("WebSocket error", err);
        setError("WebSocket connection failed.");
      };

      ws.onclose = () => {
        console.log("WebSocket closed");
        setIsConnected(false);
      };

    } catch (err) {
      console.error("Failed to connect live API:", err);
      setError(err.message);
    }
  }, [sessionId, resumeText, role]);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsConnected(false);
  }, []);

  const base64ToArrayBuffer = (base64) => {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  };

  const playAudioChunk = async (base64Audio) => {
    if (!audioContextRef.current) return;
    
    // Gemini returns 16kHz PCM. We decode it and play it.
    const arrayBuffer = base64ToArrayBuffer(base64Audio);
    
    // PCM 16-bit to Float32
    const int16View = new Int16Array(arrayBuffer);
    const float32Data = new Float32Array(int16View.length);
    for (let i = 0; i < int16View.length; i++) {
      float32Data[i] = int16View[i] / 32768.0;
    }
    
    const audioBuffer = audioContextRef.current.createBuffer(1, float32Data.length, 16000);
    audioBuffer.getChannelData(0).set(float32Data);
    
    audioQueueRef.current.push(audioBuffer);
    scheduleNextPlayback();
  };

  const scheduleNextPlayback = () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      if (onAiSpeakingChange) onAiSpeakingChange(false);
      return;
    }
    
    if (!isPlayingRef.current) {
      isPlayingRef.current = true;
      if (onAiSpeakingChange) onAiSpeakingChange(true);
    }
    
    const ctx = audioContextRef.current;
    if (!ctx) return;
    
    const currentTime = ctx.currentTime;
    if (nextPlayTimeRef.current < currentTime) {
      nextPlayTimeRef.current = currentTime;
    }
    
    const buffer = audioQueueRef.current.shift();
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(nextPlayTimeRef.current);
    
    nextPlayTimeRef.current += buffer.duration;
    
    // Schedule the next check after this buffer finishes
    setTimeout(scheduleNextPlayback, buffer.duration * 1000);
  };

  const interrupt = () => {
    // Clear playback queue
    audioQueueRef.current = [];
    nextPlayTimeRef.current = 0;
    isPlayingRef.current = false;
    if (onAiSpeakingChange) onAiSpeakingChange(false);
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "client_content" }));
    }
  };

  const sendAudioChunk = (base64Audio) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: "realtime_input",
        mediaChunks: [{
          mimeType: "audio/pcm;rate=16000",
          data: base64Audio
        }]
      }));
    }
  };

  return {
    connect,
    disconnect,
    isConnected,
    error,
    sendAudioChunk,
    interrupt,
    initAudioContext
  };
};
