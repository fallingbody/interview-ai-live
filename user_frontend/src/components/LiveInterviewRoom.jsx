import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Clock } from 'lucide-react';
import { useLiveAPI } from '../hooks/useLiveAPI';
import './UserInterviewRoom.css';

const LiveInterviewRoom = () => {
  const location = useLocation();
  const navigate = useNavigate();
  
  const [interviewId, setInterviewId] = useState(null);
  const [timer, setTimer] = useState(0);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [micActive, setMicActive] = useState(false);
  
  const userVideoRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const processorRef = useRef(null);
  const inputRef = useRef(null);

  const { connect, disconnect, isConnected, sendAudioChunk, interrupt } = useLiveAPI({
    sessionId: interviewId,
    resumeText: "Candidate Resume Data", // In a real app, pass this from state or fetch it
    role: "Software Engineer", // Pass from state
    onAiSpeakingChange: setIsAiSpeaking
  });

  useEffect(() => {
    if (location?.state) {
      const { interviewId } = location.state;
      setInterviewId(interviewId || "live-session-123");
    } else {
      setInterviewId("live-session-123");
    }
  }, [location]);

  useEffect(() => {
    let interval;
    if (isConnected) {
      interval = setInterval(() => setTimer((current) => current + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [isConnected]);

  useEffect(() => {
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        streamRef.current = stream;
        if (userVideoRef.current) {
          userVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Camera/Mic error:', err);
      }
    };
    initCamera();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      stopAudioCapture();
      disconnect();
    };
  }, []);

  const startAudioCapture = async () => {
    if (!streamRef.current) return;
    
    setMicActive(true);
    
    // Connect to websocket
    await connect();

    // Start WebAudio capture
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 16000
    });
    
    inputRef.current = audioContextRef.current.createMediaStreamSource(streamRef.current);
    processorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
    
    inputRef.current.connect(processorRef.current);
    processorRef.current.connect(audioContextRef.current.destination);
    
    processorRef.current.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      
      // Convert Float32 to Int16 PCM
      const pcmData = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        let s = Math.max(-1, Math.min(1, inputData[i]));
        pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
      }
      
      // Convert Int16Array to Base64
      const buffer = new ArrayBuffer(pcmData.length * 2);
      const view = new DataView(buffer);
      for (let i = 0; i < pcmData.length; i++) {
        view.setInt16(i * 2, pcmData[i], true); // true for little-endian
      }
      
      let binary = '';
      const bytes = new Uint8Array(buffer);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = window.btoa(binary);
      
      sendAudioChunk(base64);
    };
  };

  const stopAudioCapture = () => {
    setMicActive(false);
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (inputRef.current) {
      inputRef.current.disconnect();
      inputRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    disconnect();
  };
  
  const handleInterrupt = () => {
    interrupt();
  };

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="interview-room-container">
      <div className="main-content">
        <div className="video-section">
          <div className="video-container">
            <video
              ref={userVideoRef}
              autoPlay
              playsInline
              muted
              className="user-video"
            />
          </div>
        </div>

        <div className="controls-panel">
          <div className="status-banner info">
            {isConnected ? "Live Interview Started" : "Click 'Start Interview' to connect to Gemini"}
          </div>

          <div className="timer-display">
            <Clock className="w-5 h-5 mr-2" />
            <span>{formatTime(timer)}</span>
          </div>

          <div className="ai-status">
            {isAiSpeaking ? (
              <span className="speaking-indicator">AI is speaking...</span>
            ) : (
              <span className="listening-indicator">AI is listening...</span>
            )}
          </div>

          <div className="action-buttons">
            {!isConnected ? (
              <button className="primary-btn" onClick={startAudioCapture}>
                Start Interview
              </button>
            ) : (
              <>
                <button className="danger-btn" onClick={stopAudioCapture}>
                  End Interview
                </button>
                {isAiSpeaking && (
                  <button className="secondary-btn" onClick={handleInterrupt}>
                    Interrupt AI
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveInterviewRoom;
