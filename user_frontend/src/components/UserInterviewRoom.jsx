import React, { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import InterviewCompleteModal from './InterviewCompleteModal';
import { loadFaceApi } from '../utils/faceApiHelper';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import './UserInterviewRoom.css';

const MAX_RESTARTS = 6;
const MAX_ANSWER_SECONDS = 120;
const INACTIVITY_MS = 3000;
const FACE_CAPTURE_INTERVAL_MS = 1000;
const AUDIO_FALLBACK_TIMEOUT_MS = 6000;
const SUBMIT_TIMEOUT_MS = 45000;
const FLASK_API_BASE_URL = process.env.REACT_APP_FLASK_API_BASE_URL;
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
const FLASK_API_HEADERS = {
  'X-API-KEY': process.env.REACT_APP_FLASK_API_KEY
};
const UserInterviewRoom = () => {
  const location = useLocation();

  const [isInterviewStarted, setIsInterviewStarted] = useState(false);
  const [timer, setTimer] = useState(0);
  const [statusMessage, setStatusMessage] = useState('Preparing your interview...');
  const [aiQuestion, setAiQuestion] = useState('');
  const [, setUserAnswer] = useState('');
  const [interviewId, setInterviewId] = useState(null);
  const [, setCandidateId] = useState(null);
  const [, setResumeId] = useState(null);
  const [reportId, setReportId] = useState(null);
  const [micError, setMicError] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [, setInterviewEnded] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [thinkTimeLeft, setThinkTimeLeft] = useState(0);
  const [, setAnswerTimeLeft] = useState(0);
  const [, setLiveTranscript] = useState('');
  const [, setManualAnswer] = useState('');
  const [, setIsSpeechUnavailable] = useState(false);
  const [isAiSpeaking, setIsAiSpeaking] = useState(false);
  const [questionNumber, setQuestionNumber] = useState(1);
  const [totalQuestions, setTotalQuestions] = useState(8);
  const [, setIsSubmittingAnswer] = useState(false);
  const [faceAnalysisStatus, setFaceAnalysisStatus] = useState({
    verificationStatus: 'pending',
    cheatingStatus: 'clean',
    severity: 'clean',
    primaryReason: null,
    cheatingCount: 0,
  });
  const [proctoringNotification, setProctoringNotification] = useState(null);
  const [, setEscapeCount] = useState(0);
  const escapeCountRef = useRef(0); // Use ref for immediate access in listeners

  const thinkIntervalRef = useRef(null);
  const answerIntervalRef = useRef(null);
  const userVideoRef = useRef(null);
  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef('');
  const cocoSsdModelRef = useRef(null);
  const totalAnswerElapsedRef = useRef(0);
  const restartAttemptsRef = useRef(0);
  const inactivityTimeoutRef = useRef(null);
  const demoTimeoutRef = useRef(null);
  const latestTranscriptRef = useRef('');
  const faceCaptureIntervalRef = useRef(null);
  const activeAudioRef = useRef(null);
  const audioFallbackTimeoutRef = useRef(null);
  const faceCaptureInFlightRef = useRef(false);
  const ttsAbortControllerRef = useRef(null); // 🔹 Audio Lock: Prevents overlapping audio
  const submitInFlightRef = useRef(false);
  const completionInFlightRef = useRef(false);
  const interviewCompletedRef = useRef(false);
  const faceAnalysisFinalizedRef = useRef(false);
  const interviewIdRef = useRef(null);
  const reportIdRef = useRef(null);
  const questionNumberRef = useRef(1);
  const totalQuestionsRef = useRef(8);
  const proctoringNotificationTimeoutRef = useRef(null);
  const lastProctoringNotificationRef = useRef('');
  const consecutiveLookAwayFramesRef = useRef(0);
  const proctoringWarningCountRef = useRef(0);
  const activeViolationsRef = useRef({
    no_face: false,
    multiple_faces: false,
    looking_away: false,
    face_mismatch: false,
    phone_detected: false
  });

  useEffect(() => {
    if (location?.state) {
      const { candidateId, interviewId, firstQuestion, resumeId, reportId, totalQuestions } = location.state;
      setInterviewId(interviewId || null);
      setCandidateId(candidateId || null);
      setResumeId(resumeId || null);
      setReportId(reportId || null);
      setTotalQuestions(totalQuestions || 8);
      if (firstQuestion) {
        setAiQuestion(firstQuestion);
      }
    }
  }, [location]);

  useEffect(() => {
    interviewIdRef.current = interviewId;
  }, [interviewId]);

  useEffect(() => {
    reportIdRef.current = reportId;
  }, [reportId]);

  useEffect(() => {
    questionNumberRef.current = questionNumber;
  }, [questionNumber]);

  useEffect(() => {
    totalQuestionsRef.current = totalQuestions;
  }, [totalQuestions]);

  useEffect(() => {
    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (userVideoRef.current) {
          userVideoRef.current.srcObject = stream;
        }
        setStatusMessage('Camera & Mic ON. Starting interview...');
        startInterview();
      } catch (err) {
        console.error('Camera/Mic error:', err);
        setStatusMessage('Please allow camera & mic access to continue.');
        if (err.name === 'NotAllowedError') setMicError(true);
        if (err.name === 'NotFoundError') setCameraError(true);
      }
    };

    initCamera();
  }, []);

  useEffect(() => {
    let interval;
    if (isInterviewStarted) {
      interval = setInterval(() => setTimer((current) => current + 1), 1000);
    }

    return () => clearInterval(interval);
  }, [isInterviewStarted]);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const clearThinkInterval = () => {
    if (thinkIntervalRef.current) {
      clearInterval(thinkIntervalRef.current);
      thinkIntervalRef.current = null;
    }
  };

  const clearTotalAnswerInterval = () => {
    if (answerIntervalRef.current) {
      clearInterval(answerIntervalRef.current);
      answerIntervalRef.current = null;
    }
  };

  const clearInactivityTimeout = () => {
    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
      inactivityTimeoutRef.current = null;
    }
  };

  const clearAudioFallbackTimeout = () => {
    if (audioFallbackTimeoutRef.current) {
      clearTimeout(audioFallbackTimeoutRef.current);
      audioFallbackTimeoutRef.current = null;
    }
  };

  const stopFaceCapture = () => {
    if (faceCaptureIntervalRef.current) {
      clearInterval(faceCaptureIntervalRef.current);
      faceCaptureIntervalRef.current = null;
    }
  };

  const clearProctoringNotification = () => {
    if (proctoringNotificationTimeoutRef.current) {
      clearTimeout(proctoringNotificationTimeoutRef.current);
      proctoringNotificationTimeoutRef.current = null;
    }
    setProctoringNotification(null);
  };

  // Violation types that count toward the 3-warning popup limit
  const PROCTORING_VIOLATION_TYPES = ['no_face', 'multiple_faces', 'looking_away', 'face_mismatch'];

  const showProctoringNotification = (message, severity = 'warning', type = 'general') => {
    if (!message) return;

    const isProctoringViolation = PROCTORING_VIOLATION_TYPES.includes(type);

    // 3-popup limit only applies to camera integrity warnings.
    // Security notifications (keyboard, right_click, fullscreen) always show
    if (isProctoringViolation && proctoringWarningCountRef.current >= 3) {
      console.log(`[Proctoring] Silently noted (${type}): ${message} [warning #${proctoringWarningCountRef.current + 1} — popup suppressed]`);
      return;
    }

    // Prevent duplicate popup for the exact same ongoing message
    if (lastProctoringNotificationRef.current === message) return;

    // Only increment the global counter for proctoring violations
    if (isProctoringViolation) {
      proctoringWarningCountRef.current += 1;
      console.log(`[Proctoring] Showing popup warning #${proctoringWarningCountRef.current}/3 (${type}): ${message}`);
    }

    lastProctoringNotificationRef.current = message;
    clearProctoringNotification();
    setProctoringNotification({ message, severity });
    proctoringNotificationTimeoutRef.current = setTimeout(() => {
      setProctoringNotification(null);
      lastProctoringNotificationRef.current = '';
    }, 4000);
  };

  const stopRecognition = () => {
    try {
      if (recognitionRef.current) {
        recognitionRef.current._autoRestart = false;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.stop();
      }
    } catch (e) {
      // no-op
    }
  };

  const stopActiveAudio = () => {
    clearAudioFallbackTimeout();
    setIsAiSpeaking(false);

    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
        activeAudioRef.current.src = '';
      } catch (e) {
        // no-op
      }
      activeAudioRef.current = null;
    }
  };

  const stopMediaTracks = () => {
    if (userVideoRef.current && userVideoRef.current.srcObject) {
      const stream = userVideoRef.current.srcObject;
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());
      userVideoRef.current.srcObject = null;
    }
  };

  const startInterview = () => {
    setIsInterviewStarted(true);
    setTimer(0);
    setStatusMessage('Interview started! Speak your answers clearly.');
  };

  const syncReportPayload = async (payload) => {
    if (!reportId || !payload) return { success: false, skipped: true };

    const token = localStorage.getItem('token') || localStorage.getItem('authToken');
    const syncResponse = await fetch(`${API_BASE_URL}/update-report/${reportId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload)
    });

    const syncData = await syncResponse.json().catch(() => ({}));
    return {
      success: syncResponse.ok && !!syncData?.success,
      message: syncData?.message || syncResponse.statusText || 'Report sync failed',
    };
  };

  const buildFaceAnalysisFallbackPayload = (faceFrameResult = null) => {
    if (!faceFrameResult) return null;

    return {
      terminated: false,
      dominant_emotion: faceFrameResult.dominant_emotion ?? faceFrameResult.emotion ?? 'unknown',
      confidence_score: faceFrameResult.confidence_score ?? faceFrameResult.score ?? null,
      verification_status: faceFrameResult.verification_status ?? 'unverified',
      verification_rate: faceFrameResult.verification_rate ?? null,
      verified_frames: faceFrameResult.verified_frames ?? 0,
      verification_checks: faceFrameResult.verification_checks ?? 0,
      total_frames: faceFrameResult.total_frames ?? 0,
      proctoring_severity: faceFrameResult.proctoring_severity ?? faceFrameResult.cheating_summary?.severity ?? 'clean',
      cheating_reason_counts: faceFrameResult.cheating_reason_counts ?? {},
      cheating_reason_seconds: faceFrameResult.cheating_reason_seconds ?? {},
      behavior_assessment: faceFrameResult.behavior_assessment ?? null,
      last_emotion: faceFrameResult.last_emotion ?? faceFrameResult.emotion ?? null,
      cheating_summary: {
        cheating_events: faceFrameResult.cheating_summary?.cheating_events ?? faceFrameResult.cheating_count ?? 0,
        status: faceFrameResult.cheating_summary?.status ?? (faceFrameResult.cheating_detected ? 'suspicious' : 'clean'),
        severity: faceFrameResult.proctoring_severity ?? faceFrameResult.cheating_summary?.severity ?? 'clean',
        primary_reason:
          faceFrameResult.cheating_summary?.primary_reason ??
          Object.entries(faceFrameResult.cheating_reason_counts ?? {})
            .sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0] ?? null,
        reason_counts: faceFrameResult.cheating_summary?.reason_counts ?? faceFrameResult.cheating_reason_counts ?? {},
        reason_seconds: faceFrameResult.cheating_summary?.reason_seconds ?? faceFrameResult.cheating_reason_seconds ?? {},
      }
    };
  };

  const endFaceAnalysisSession = async (faceFrameResult = null) => {
    if (faceAnalysisFinalizedRef.current) {
      return buildFaceAnalysisFallbackPayload(faceFrameResult);
    }

    const interview_id = interviewIdRef.current;
    if (!interview_id) {
      return buildFaceAnalysisFallbackPayload(faceFrameResult);
    }

    let faceAnalysisPayload = null;

    try {
      const response = await fetch(`${FLASK_API_BASE_URL}/api/face-analysis/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...FLASK_API_HEADERS
        },
        body: JSON.stringify({ interview_id })
      });

      if (response.ok) {
        faceAnalysisPayload = await response.json();
      }
    } catch (error) {
      console.warn('Failed to end face analysis session cleanly:', error);
    }

    faceAnalysisPayload = faceAnalysisPayload || buildFaceAnalysisFallbackPayload(faceFrameResult);
    if (faceAnalysisPayload) {
      faceAnalysisFinalizedRef.current = true;
    }

    return faceAnalysisPayload;
  };

  const flushFaceAnalysisOnExit = () => {
    if (interviewCompletedRef.current || faceAnalysisFinalizedRef.current) return;
    if (!interviewIdRef.current || !reportIdRef.current) return;

    const token = localStorage.getItem('token') || localStorage.getItem('authToken');

    fetch(`${FLASK_API_BASE_URL}/api/face-analysis/end`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...FLASK_API_HEADERS
      },
      body: JSON.stringify({ interview_id: interviewIdRef.current }),
      keepalive: true,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((faceAnalysisPayload) => {
        if (!faceAnalysisPayload) return null;
        faceAnalysisFinalizedRef.current = true;

        return fetch(`${API_BASE_URL}/update-report/${reportIdRef.current}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ face_analysis: faceAnalysisPayload }),
          keepalive: true,
        });
      })
      .catch((error) => {
        console.warn('Failed to persist face analysis during page exit:', error);
      });
  };

  const completeInterview = async ({ completionMessage, syncPayload = null }) => {
    if (completionInFlightRef.current) return;
    completionInFlightRef.current = true;
    interviewCompletedRef.current = true;
    if (syncPayload?.face_analysis || syncPayload?.final_report?.face_analysis) {
      faceAnalysisFinalizedRef.current = true;
    }

    clearThinkInterval();
    clearTotalAnswerInterval();
    clearInactivityTimeout();
    stopRecognition();
    stopFaceCapture();
    stopActiveAudio();
    stopMediaTracks();
    clearProctoringNotification();
    setInterviewEnded(true);
    setIsInterviewStarted(false);
    setIsListening(false);
    setAiQuestion('');
    setShowCompleteModal(true);

    try {
      const syncResult = await syncReportPayload(syncPayload);
      if (syncResult.success || syncResult.skipped) {
        setStatusMessage(completionMessage);
      } else {
        setStatusMessage(`${completionMessage} Report sync issue: ${syncResult.message}`);
      }
    } catch (error) {
      console.error('Interview completion sync failed:', error);
      setStatusMessage(`${completionMessage} Report sync failed.`);
    } finally {
      completionInFlightRef.current = false;
    }
  };

  const terminateInterviewFromFaceAnalysis = async (faceFrameResult = null) => {
    // 1. Instantly transition the UI to terminate mode
    clearThinkInterval();
    clearTotalAnswerInterval();
    clearInactivityTimeout();
    stopRecognition();
    stopFaceCapture();
    stopActiveAudio();
    stopMediaTracks();
    clearProctoringNotification();
    setInterviewEnded(true);
    setIsInterviewStarted(false);
    setIsListening(false);
    setAiQuestion('');
    setShowCompleteModal(true);
    setStatusMessage('Interview ended because phone usage was detected during proctoring. Please wait while your logs are securely submitted...');

    // 2. Perform the heavy sync payload fetching in the background asynchronously
    (async () => {
      try {
        const faceAnalysisPayload = await endFaceAnalysisSession(faceFrameResult);

        let syncPayload = {
          face_analysis: faceAnalysisPayload || {}
        };

        // Fetch partial AI report (generates on-the-fly inside Flask AI backend)
        try {
          const reportResponse = await fetch(`${FLASK_API_BASE_URL}/api/reports/${interviewIdRef.current}`, {
            method: 'GET'
          });
          if (reportResponse.ok) {
            const reportData = await reportResponse.json();
            syncPayload.final_report = reportData;
          }
        } catch (err) {
          console.warn("Failed to fetch partial AI report during face analysis termination:", err);
        }

        await syncReportPayload(syncPayload);
        setStatusMessage('Interview ended because phone usage was detected during proctoring.');
      } catch (err) {
        console.error('Background face analysis termination sync failed:', err);
        setStatusMessage('Interview ended because phone usage was detected during proctoring.');
      }
    })();
  };

  const captureFaceFrame = async () => {
    if (faceCaptureInFlightRef.current) return;
    if (!interviewIdRef.current || !userVideoRef.current || !isInterviewStarted) return;

    const video = userVideoRef.current;
    if (!video.videoWidth || !video.videoHeight || video.readyState < 2) return;

    faceCaptureInFlightRef.current = true;
    try {
      const faceapi = window.faceapi;
      if (!faceapi) {
        await loadFaceApi();
      }

      // Load COCO-SSD for phone detection if not already loaded
      if (!cocoSsdModelRef.current) {
        try {
          await tf.ready();
          cocoSsdModelRef.current = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
        } catch (e) {
          console.warn("Failed to load COCO-SSD model for phone detection:", e);
        }
      }

      // Detect all faces, landmarks, and descriptors in the video frame locally
      const detections = await window.faceapi.detectAllFaces(video)
        .withFaceLandmarks()
        .withFaceDescriptors();

      let noFace = false;
      let multipleFaces = false;
      let lookingAway = false;
      let lookingAwayForBackend = false;
      let liveVector = null;
      let phoneDetected = false;

      if (cocoSsdModelRef.current) {
        try {
          const predictions = await cocoSsdModelRef.current.detect(video);
          phoneDetected = predictions.some(p => p.class === 'cell phone');
        } catch (e) {
          console.warn("Phone detection failed:", e);
        }
      }

      if (detections.length === 0) {
        noFace = true;
      } else if (detections.length > 1) {
        multipleFaces = true;
        // Take the first face descriptor anyway
        liveVector = Array.from(detections[0].descriptor);
      } else {
        const detection = detections[0];
        liveVector = Array.from(detection.descriptor);

        const landmarks = detection.landmarks;
        const leftEdge = landmarks.positions[0];
        const rightEdge = landmarks.positions[16];
        const topOfNose = landmarks.positions[27];
        const chin = landmarks.positions[8];
        const noseTip = landmarks.positions[30];

        const width = rightEdge._x - leftEdge._x;
        const faceHeight = chin._y - topOfNose._y;

        if (width > 0 && faceHeight > 0) {
          const horizontalPoseRatio = (noseTip._x - leftEdge._x) / width;
          const verticalPoseRatio = (noseTip._y - topOfNose._y) / faceHeight;

          // Normal/standard head turn detection thresholds: triggers when head turns ~20-30 degrees
          const headTurnedSideways = horizontalPoseRatio < 0.22 || horizontalPoseRatio > 0.78;
          const headTiltedAway = verticalPoseRatio < 0.14 || verticalPoseRatio > 0.86;
          lookingAway = headTurnedSideways || headTiltedAway;

          // Eye Aspect Ratio (EAR) to detect downward gaze (lowered eyelids) or closed eyes.
          // Restored specifically for background face/report verification (not for triggering intrusive frontend popups).
          const leftEyeHeight1 = Math.abs(landmarks.positions[41]._y - landmarks.positions[37]._y);
          const leftEyeHeight2 = Math.abs(landmarks.positions[40]._y - landmarks.positions[38]._y);
          const leftEyeWidth = Math.abs(landmarks.positions[39]._x - landmarks.positions[36]._x);
          const leftEAR = (leftEyeHeight1 + leftEyeHeight2) / (2.0 * leftEyeWidth);

          const rightEyeHeight1 = Math.abs(landmarks.positions[47]._y - landmarks.positions[43]._y);
          const rightEyeHeight2 = Math.abs(landmarks.positions[46]._y - landmarks.positions[44]._y);
          const rightEyeWidth = Math.abs(landmarks.positions[45]._x - landmarks.positions[42]._x);
          const rightEAR = (rightEyeHeight1 + rightEyeHeight2) / (2.0 * rightEyeWidth);

          const averageEAR = (leftEAR + rightEAR) / 2.0;

          // Standard looking straight EAR is ~0.26 to 0.35. Lowered eyelids / downward look drops it under 0.21.
          const eyesLookingDown = averageEAR < 0.21;

          lookingAwayForBackend = headTurnedSideways || headTiltedAway || eyesLookingDown;
        }
      }

      // Build cheating details JSON payload
      const cheatingDetails = {
        no_face: noFace,
        multiple_faces: multipleFaces,
        looking_away: lookingAwayForBackend,
        fullscreen_exited: document.fullscreenElement === null,
        phone_detected: phoneDetected
      };

      // If no face is detected, we pass a dummy vector of 128 zeros
      const vectorToSend = liveVector || new Array(128).fill(0.0);

      const response = await fetch(`${FLASK_API_BASE_URL}/api/face-analysis/frame`, {
        method: 'POST',
        headers: {
          ...FLASK_API_HEADERS,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          interview_id: interviewIdRef.current,
          vector: vectorToSend,
          cheating_details: cheatingDetails
        })
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        console.warn('Face analysis vector upload failed:', errorText);
        return;
      }

      const result = await response.json();
      const sessionSeverity = result?.cheating_summary?.severity || result?.proctoring_severity || 'clean';
      const proctoringSeverity = result?.cheating_detected ? sessionSeverity : 'clean';
      const cheatingStatus = result?.cheating_detected ? 'suspicious' : 'clean';
      const newStatus = result?.verification_status || 'unverified';

      setFaceAnalysisStatus({
        verificationStatus: newStatus,
        cheatingStatus,
        severity: proctoringSeverity,
        primaryReason: result?.cheating_summary?.primary_reason || null,
        cheatingCount: result?.cheating_count ?? 0,
      });

      // Build local notifications for candidate if flagged
      if (!result?.terminated) {
        if (lookingAway) {
          consecutiveLookAwayFramesRef.current += 1;

          if (
            consecutiveLookAwayFramesRef.current >= 2 &&
            !activeViolationsRef.current.looking_away
          ) {
            showProctoringNotification(
              "⚠️ Please keep your face oriented toward the interview screen.",
              "warning",
              "looking_away"
            );

            activeViolationsRef.current.looking_away = true;
          }
        } else if (!noFace) {
          // Reset consecutive look-away frames only when a face is detected and looking straight.
          // This ensures complete head turns (which trigger noFace = true) don't reset lookingAway counters prematurely.
          consecutiveLookAwayFramesRef.current = 0;
          activeViolationsRef.current.looking_away = false;
        }

        if (!noFace) {
          activeViolationsRef.current.no_face = false;
        }
        if (!multipleFaces) {
          activeViolationsRef.current.multiple_faces = false;
        }
        if (!phoneDetected) {
          activeViolationsRef.current.phone_detected = false;
        }
        if (newStatus !== 'unverified') {
          activeViolationsRef.current.face_mismatch = false;
        }

        // Phone detection is always checked first and independently — it must
        // never be silenced by noFace/multipleFaces being higher in an else-if chain.
        if (phoneDetected) {
          if (!activeViolationsRef.current.phone_detected) {
            showProctoringNotification("⚠️ Cell phone detected! Use of devices is strictly prohibited.", "serious", "phone_detected");
            activeViolationsRef.current.phone_detected = true;
          }
        }

        if (noFace) {
          if (!activeViolationsRef.current.no_face) {
            showProctoringNotification("⚠️ No face detected. Please face the camera.", "warning", "no_face");
            activeViolationsRef.current.no_face = true;
          }
        } else if (multipleFaces) {
          if (!activeViolationsRef.current.multiple_faces) {
            showProctoringNotification("⚠️ Multiple faces detected. Ensure you are alone.", "serious", "multiple_faces");
            activeViolationsRef.current.multiple_faces = true;
          }
        } else if (!phoneDetected && newStatus === 'unverified') {
          if (!activeViolationsRef.current.face_mismatch) {
            showProctoringNotification("⚠️ Face mismatch detected. Please verify your identity.", "serious", "face_mismatch");
            activeViolationsRef.current.face_mismatch = true;
          }
        }
      }

      if (result?.terminated) {
        await terminateInterviewFromFaceAnalysis(result);
      }
    } catch (error) {
      console.warn('Face analysis local proctoring failed:', error);
    } finally {
      faceCaptureInFlightRef.current = false;
    }
  };

  useEffect(() => {
    stopFaceCapture();

    if (!isInterviewStarted || !interviewId) {
      return undefined;
    }

    captureFaceFrame();
    faceCaptureIntervalRef.current = setInterval(() => {
      captureFaceFrame();
    }, FACE_CAPTURE_INTERVAL_MS);

    return () => {
      stopFaceCapture();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interviewId, isInterviewStarted]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      flushFaceAnalysisOnExit();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  /* ── Fullscreen & Keyboard Locking ─────────── */
  useEffect(() => {
    if (!isInterviewStarted) return;

    // 1. Keyboard Lock (Chromium only)
    const lockKeyboard = async () => {
      if (navigator.keyboard && navigator.keyboard.lock) {
        try {
          // Lock everything possible
          await navigator.keyboard.lock();
          console.log("✅ Keyboard locked.");
        } catch (err) {
          console.warn("Keyboard lock failed:", err);
        }
      }
    };

    // 2. Fallback & Strict Blocking: Block ALL keys except Escape
    const handleKeyDown = async (e) => {
      if (e.key === "Escape") {
        // Increment count
        escapeCountRef.current += 1;
        setEscapeCount(escapeCountRef.current);

        if (escapeCountRef.current === 1) {
          // Strike 1: Warning + Force Back
          showProctoringNotification("⚠️ WARNING: Focus lost or fullscreen exited. You have 5 seconds to click back into the interview window, or the session will terminate.", "serious", "fullscreen");

          // Small delay to allow browser to finish exiting before we try to re-enter
          setTimeout(async () => {
            try {
              if (document.documentElement.requestFullscreen) {
                await document.documentElement.requestFullscreen();
              } else if (document.documentElement.webkitRequestFullscreen) {
                await document.documentElement.webkitRequestFullscreen();
              }
            } catch (err) {
              console.warn("Re-entry failed:", err);
            }
          }, 300);

          // ENFORCE FOCUS RETURN: 
          // If they try to "sit" on a mini-screen or another monitor after getting Strike 1, 
          // they won't trigger another 'blur' event. We give them 5 seconds to return focus.
          setTimeout(() => {
            if (!document.hasFocus() || document.hidden) {
              console.warn("Proctoring: Candidate failed to return focus within 5 seconds. Terminating.");
              handleKeyDown({ key: "Escape" }); // Triggers Strike 2
            }
          }, 5000);

        } else if (escapeCountRef.current >= 2) {
          // Strike 2: Termination

          // 1. Instantly transition the UI to terminate mode
          clearThinkInterval();
          clearTotalAnswerInterval();
          clearInactivityTimeout();
          stopRecognition();
          stopFaceCapture();
          stopActiveAudio();
          stopMediaTracks();
          clearProctoringNotification();
          setInterviewEnded(true);
          setIsInterviewStarted(false);
          setIsListening(false);
          setAiQuestion('');
          setShowCompleteModal(true);
          setStatusMessage("Interview terminated due to multiple fullscreen violations (Cheating Detected). Please wait while your proctoring logs are securely submitted...");

          // 2. Perform the heavy sync payload fetching in the background asynchronously
          (async () => {
            try {
              const faceAnalysisPayload = await endFaceAnalysisSession();

              let syncPayload = {
                face_analysis: {
                  ...faceAnalysisPayload,
                  proctoring_severity: "serious",
                  cheating_summary: {
                    ...(faceAnalysisPayload?.cheating_summary || {}),
                    status: "cheating",
                    severity: "serious",
                    primary_reason: "Multiple Fullscreen/Escape violations"
                  }
                },
                final_report: {
                  cheating_detected: true,
                  cheating_reason: "User repeatedly exited fullscreen mode using Escape key."
                }
              };

              // Fetch partial AI report (generates on-the-fly inside Flask AI backend)
              try {
                const reportResponse = await fetch(`${FLASK_API_BASE_URL}/api/reports/${interviewIdRef.current}`, {
                  method: 'GET'
                });
                if (reportResponse.ok) {
                  const reportData = await reportResponse.json();
                  syncPayload.final_report = {
                    ...reportData,
                    ...syncPayload.final_report
                  };
                }
              } catch (err) {
                console.warn("Failed to fetch partial AI report during cheating termination:", err);
              }

              await syncReportPayload(syncPayload);
              setStatusMessage("Interview terminated due to multiple fullscreen violations (Cheating Detected).");
            } catch (err) {
              console.error("Background early termination sync failed:", err);
              setStatusMessage("Interview terminated due to multiple fullscreen violations (Cheating Detected).");
            }
          })();
        }
        return;
      }

      // Block everything else
      e.preventDefault();
      showProctoringNotification("⚠️ Keyboard input is disabled during the interview.", "warning", "keyboard");
    };

    // 3. Disable Context Menu (Right Click)
    const handleContextMenu = (e) => {
      e.preventDefault();
      showProctoringNotification("⚠️ Right-click is disabled.", "warning", "right_click");
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        handleKeyDown({ key: "Escape" });
      }
    };

    // 5. Monitor Focus Loss (Integrated into the Two-Strike system)
    const handleFocusLoss = async () => {
      // Treat focus loss identically to an Escape key press (Strike 1 = Warning, Strike 2 = Termination)
      handleKeyDown({ key: "Escape" });
    };

    const handleWindowBlur = () => handleFocusLoss();
    const handleVisibilityChange = () => {
      if (document.hidden) handleFocusLoss();
    };

    lockKeyboard();
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (navigator.keyboard && navigator.keyboard.unlock) {
        navigator.keyboard.unlock();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isInterviewStarted]);

  const startRecognitionForAnswer = (answerSeconds = MAX_ANSWER_SECONDS) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatusMessage('Speech recognition not supported.');
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current._autoRestart = false;
        try {
          recognitionRef.current.onend = null;
          recognitionRef.current.onerror = null;
          recognitionRef.current.stop();
        } catch (e) {
          // no-op
        }
        recognitionRef.current = null;
      }
    } catch (e) {
      // no-op
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition._autoRestart = true;
    recognition._isAborted = false;
    recognition.lang = 'en-US';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 5;

    recognition.onstart = () => {
      setIsSpeechUnavailable(false);
      setIsListening(true);
      setStatusMessage('🎙️ Listening... Speak now.');

      if (!answerIntervalRef.current) {
        totalAnswerElapsedRef.current = totalAnswerElapsedRef.current || 0;
        answerIntervalRef.current = setInterval(() => {
          totalAnswerElapsedRef.current += 1;
          const remaining = Math.max(0, answerSeconds - totalAnswerElapsedRef.current);
          setAnswerTimeLeft(remaining);
          if (totalAnswerElapsedRef.current >= answerSeconds) {
            clearTotalAnswerInterval();
            finalizeAnswer();
          }
        }, 1000);
      }

      clearInactivityTimeout();
    };

    recognition.onresult = (event) => {
      setIsListening(true);
      setStatusMessage('🎙️ Listening... Speak now.');
      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += `${transcript} `;
          restartAttemptsRef.current = 0;
        } else {
          interim += transcript;
        }
      }

      const fullText = finalTranscriptRef.current + interim;
      setUserAnswer(fullText);
      setLiveTranscript(fullText);
      setManualAnswer(fullText);
      latestTranscriptRef.current = fullText;

      clearInactivityTimeout();
      inactivityTimeoutRef.current = setTimeout(() => {
        finalizeAnswer();
      }, INACTIVITY_MS);
    };

    recognition.onerror = (event) => {
      if (event.error === 'aborted') {
        recognition._isAborted = true;
        recognition._autoRestart = false;
        setStatusMessage('Recognition stopped. Please allow mic access and start again.');
        setIsListening(false);
        return;
      }

      if (event.error === 'network') {
        recognition._isAborted = true;
        recognition._autoRestart = false;
        clearInactivityTimeout();
        clearTotalAnswerInterval();
        setIsListening(false);
        setIsSpeechUnavailable(true);
        setStatusMessage('Speech recognition network issue. Automatically submitting current answer...');
        finalizeAnswer();
        return;
      }

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        recognition._isAborted = true;
        recognition._autoRestart = false;
        clearInactivityTimeout();
        clearTotalAnswerInterval();
        setIsListening(false);
        setIsSpeechUnavailable(true);
        setStatusMessage('Mic permission denied. Moving to next question without audio...');
        finalizeAnswer();
        return;
      }

      setStatusMessage(`Recognition error: ${event.error}`);
    };

    recognition.onend = () => {
      if (recognition._isAborted || recognition._autoRestart === false) {
        setIsListening(false);
        return;
      }

      if (inactivityTimeoutRef.current) return;

      if (totalAnswerElapsedRef.current < answerSeconds) {
        restartAttemptsRef.current = (restartAttemptsRef.current || 0) + 1;
        if (restartAttemptsRef.current <= MAX_RESTARTS) {
          setTimeout(() => {
            try {
              startRecognitionForAnswer(answerSeconds - totalAnswerElapsedRef.current);
            } catch (err) {
              // no-op
            }
          }, 500 + restartAttemptsRef.current * 150);
          return;
        }

        setStatusMessage('Speech recognition unstable. Automatically submitting current answer...');
        finalizeAnswer();
        return;
      }

      if (totalAnswerElapsedRef.current >= answerSeconds) {
        finalizeAnswer();
      }
    };

    setTimeout(() => {
      try {
        recognition.start();
      } catch (err) {
        setStatusMessage('Recognition start failed. Please retry.');
      }
    }, 300);
  };

  const speakThenListen = async (text, answerSeconds = MAX_ANSWER_SECONDS) => {
    setStatusMessage('🔊 Playing question...');

    // 🔹 AUDIO LOCK: Instantly kill any pending background audio fetches to prevent double-audio
    if (ttsAbortControllerRef.current) {
      ttsAbortControllerRef.current.abort();
    }
    const currentAudioLock = new AbortController();
    ttsAbortControllerRef.current = currentAudioLock;

    stopActiveAudio();
    setIsAiSpeaking(true);

      try {
        let pregenResponse = null;
        const pregenController = new AbortController();
        const pregenTimeout = setTimeout(() => pregenController.abort(), 45000); // 45-second timeout for pre-generated audio

        try {
          pregenResponse = await fetch(`${FLASK_API_BASE_URL}/api/tts/get-pregenerated`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...FLASK_API_HEADERS
            },
            body: JSON.stringify({
              interview_id: interviewIdRef.current,
              text,
              question_no: questionNumberRef.current,
              max_wait_ms: 30000
            }),
            signal: pregenController.signal
          });
        } catch (pregenErr) {
          console.warn("Pregenerated audio fetch timed out or failed, falling back to on-demand generation:", pregenErr);
        } finally {
          clearTimeout(pregenTimeout);
        }

        let audioBlob;
        if (pregenResponse && pregenResponse.ok) {
          audioBlob = await pregenResponse.blob();
          console.log(`✓ Using pre-generated audio for Q${questionNumberRef.current}`);
        } else {
          console.log(`⚠️ Pre-gen missed, generating on-demand for Q${questionNumberRef.current}`);

          const ondemandController = new AbortController();
          const ondemandTimeout = setTimeout(() => ondemandController.abort(), 45000); // 45-second timeout for on-demand generation

          try {
            const response = await fetch(`${FLASK_API_BASE_URL}/api/tts/interview`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...FLASK_API_HEADERS
            },
            body: JSON.stringify({ text }),
            signal: ondemandController.signal
          });

          if (!response.ok) {
            throw new Error('Local audio generation failed');
          }

          audioBlob = await response.blob();
        } finally {
          clearTimeout(ondemandTimeout);
        }
      }

      // 🔹 AUDIO LOCK CHECK: If a newer question was triggered while this one was downloading, 
      // we completely discard this audio before it has a chance to play!
      if (currentAudioLock.signal.aborted) {
        console.log("Audio lock triggered: Prevented overlapping audio from playing.");
        return;
      }

      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.playbackRate = 0.9;
      activeAudioRef.current = audio;
      let listeningStarted = false;

      const beginListening = () => {
        if (listeningStarted) return;
        listeningStarted = true;
        clearAudioFallbackTimeout();
        URL.revokeObjectURL(audioUrl);
        activeAudioRef.current = null;
        setIsAiSpeaking(false);
        setStatusMessage('🎤 Listening... Speak now.');
        startRecognitionForAnswer(answerSeconds);
      };

      audio.onended = beginListening;
      audio.onerror = () => {
        console.error('Audio playback error');
        beginListening();
      };
      audio.onplaying = () => {
        clearAudioFallbackTimeout();
        setStatusMessage('🔊 Question playing...');
      };

      audioFallbackTimeoutRef.current = setTimeout(() => {
        console.warn('Audio playback timed out; falling back to listening.');
        beginListening();
      }, AUDIO_FALLBACK_TIMEOUT_MS);

      await audio.play();
    } catch (error) {
      console.error('TTS Error:', error);
      stopActiveAudio();
      setStatusMessage('Starting to listen...');
      startRecognitionForAnswer(answerSeconds);
    }
  };

  useEffect(() => {
    if (!aiQuestion || !isInterviewStarted) return undefined;

    finalTranscriptRef.current = '';
    totalAnswerElapsedRef.current = 0;
    setAnswerTimeLeft(MAX_ANSWER_SECONDS);
    setLiveTranscript('');
    setManualAnswer('');
    speakThenListen(aiQuestion, MAX_ANSWER_SECONDS);

    return () => {
      clearThinkInterval();
      clearTotalAnswerInterval();
      clearInactivityTimeout();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiQuestion, isInterviewStarted]);

  const finalizeAnswer = () => {
    if (submitInFlightRef.current) return;

    clearInactivityTimeout();
    clearTotalAnswerInterval();
    setIsListening(false);
    stopRecognition();

    const cleaned = ((finalTranscriptRef.current || '').trim() || (latestTranscriptRef.current || '').trim());
    if (cleaned) {
      setUserAnswer(cleaned);
      setManualAnswer(cleaned);
      setStatusMessage('✅ Answer captured. Next question coming...');
      submitAnswer(cleaned);
    } else {
      setUserAnswer('No response provided.');
      setManualAnswer('No response provided.');
      setStatusMessage('No speech detected. Moving to the next question...');
      submitAnswer('No response provided.');
    }

    finalTranscriptRef.current = '';
    latestTranscriptRef.current = '';
    totalAnswerElapsedRef.current = 0;
    setLiveTranscript('');
    setManualAnswer('');
  };


  const startAnswerNow = () => {
    clearThinkInterval();
    setThinkTimeLeft(0);
    setStatusMessage('Skipping thinking. Speaking question now...');
    speakThenListen(aiQuestion, MAX_ANSWER_SECONDS);
  };





  const submitAnswer = async (answer) => {
    if (submitInFlightRef.current) return;

    submitInFlightRef.current = true;
    setIsSubmittingAnswer(true);

    try {
      const payload = { interview_id: interviewIdRef.current, answer };
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS);
      const response = await fetch(`${FLASK_API_BASE_URL}/api/interviews/handle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...FLASK_API_HEADERS
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        throw new Error(`Server returned ${response.status}: ${errorText}`);
      }

      const data = await response.json();

      if (data.stop === true || !data.next_question) {
        let syncPayload = { face_analysis: {} };

        try {
          const faceAnalysisPayload = await endFaceAnalysisSession();
          if (faceAnalysisPayload) {
            syncPayload.face_analysis = faceAnalysisPayload;
          }
        } catch (faceErr) {
          console.warn('Failed to end face analysis session:', faceErr);
        }

        const report = await fetch(`${FLASK_API_BASE_URL}/api/reports/${interviewIdRef.current}`, {
          method: 'GET'
        });

        if (report.ok) {
          const reportData = await report.json();
          syncPayload.final_report = reportData;
        } else {
          console.warn('AI report fetch failed after interview completion.');
        }

        await completeInterview({
          completionMessage: 'Interview finished and report generated successfully.',
          syncPayload,
        });
        return;
      }

      const backendQuestionNo = data.question_no || (questionNumberRef.current + 1);
      const backendTotalQuestions = data.total_questions || totalQuestionsRef.current;

      questionNumberRef.current = backendQuestionNo;
      totalQuestionsRef.current = backendTotalQuestions;
      setQuestionNumber(backendQuestionNo);
      setTotalQuestions(backendTotalQuestions);
      setAiQuestion(data.next_question);
      setUserAnswer('');
      setLiveTranscript('');
      setManualAnswer('');
      finalTranscriptRef.current = '';
      latestTranscriptRef.current = '';
      restartAttemptsRef.current = 0;
    } catch (err) {
      console.error('Submit error:', err);
      const message = err.name === 'AbortError'
        ? 'Server took too long to prepare the next question. Please retry submitting.'
        : `Error submitting your answer: ${err.message}`;
      setStatusMessage(message);
    } finally {
      submitInFlightRef.current = false;
      setIsSubmittingAnswer(false);
    }
  };


  useEffect(() => () => {
    clearThinkInterval();
    clearTotalAnswerInterval();
    clearInactivityTimeout();
    stopFaceCapture();
    stopActiveAudio();
    if (demoTimeoutRef.current) clearTimeout(demoTimeoutRef.current);
    stopRecognition();
    if (window.speechSynthesis) window.speechSynthesis.cancel();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="ir-container">
      <div className="ir-layout">
        {proctoringNotification && (
          <div className="ir-proctoring-overlay">
            <div className={`ir-proctoring-modal ir-proctoring-modal--${proctoringNotification.severity}`}>
              {proctoringNotification.severity === 'success' ? (
                <CheckCircle size={48} color="#27ae60" style={{ marginBottom: "12px" }} />
              ) : (
                <AlertTriangle size={48} color={proctoringNotification.severity === 'serious' ? '#e74c3c' : '#f39c12'} style={{ marginBottom: "12px" }} />
              )}
              <h2 style={{
                marginTop: 0,
                marginBottom: "8px",
                color: proctoringNotification.severity === 'success' ? '#27ae60' : (proctoringNotification.severity === 'serious' ? '#e74c3c' : '#f39c12')
              }}>
                {proctoringNotification.severity === 'success' ? 'Verification Success' : (proctoringNotification.severity === 'serious' ? 'Proctoring Alert' : 'Proctoring Warning')}
              </h2>
              <p className="ir-proctoring-message">
                {proctoringNotification.message}
              </p>
              <button
                type="button"
                className="ir-proctoring-btn"
                onClick={clearProctoringNotification}
              >
                OK
              </button>
            </div>
          </div>
        )}

        <div className="ir-sidebar">
          <div className="ir-header">
            <div>
              <h1 className="ir-logo">Interview.ai</h1>
              <p className="ir-tagline">AI-Powered Interview Platform</p>
            </div>
          </div>

          <div className="ir-progress">
            <div className="ir-progress-label">Question {questionNumber} of {totalQuestions}</div>
            <div className="ir-progress-track">
              <div
                className="ir-progress-fill"
                style={{ width: `${(questionNumber / Math.max(totalQuestions, 1)) * 100}%` }}
              />
            </div>
            <div className="ir-progress-dots">
              {Array.from({ length: totalQuestions }).map((_, i) => (
                <div
                  key={i}
                  className={`ir-dot ${i < questionNumber ? 'ir-dot--done' : i === questionNumber - 1 ? 'ir-dot--active' : ''}`}
                />
              ))}
            </div>
          </div>

          <div className="ir-badges">
            <div className="ir-badge"><Clock size={16} /> {formatTime(timer)}</div>
            <div className={`ir-badge ${isInterviewStarted ? 'ir-badge--active' : ''}`}>{isInterviewStarted ? 'Interview Active' : 'Ready'}</div>
            <div className={`ir-badge ${isListening ? 'ir-badge--active' : ''}`}>{isListening ? '🎤 Listening...' : '🔇 Idle'}</div>
            <div className={`ir-badge ${faceAnalysisStatus.verificationStatus === 'verified' ? 'ir-badge--verified' : faceAnalysisStatus.verificationStatus === 'pending' ? '' : 'ir-badge--warning'}`}>
              Verification: {faceAnalysisStatus.verificationStatus === 'verified' ? 'Verified' : faceAnalysisStatus.verificationStatus === 'pending' ? 'Pending...' : faceAnalysisStatus.verificationStatus === 'no_reference' ? 'No Photo' : 'Unverified'}
            </div>
            <div className={`ir-badge ${faceAnalysisStatus.severity === 'serious' ? 'ir-badge--warning' : faceAnalysisStatus.severity === 'warning' ? 'ir-badge--notice' : ''}`}>
              Proctoring: {faceAnalysisStatus.severity === 'serious' ? 'Serious Issue' : faceAnalysisStatus.severity === 'warning' ? 'Warning' : 'Clean'}
            </div>
          </div>

          <div className="ir-card">
            <div className="ir-card-header"><h2 className="ir-card-title">Status</h2></div>
            <div className="ir-card-body">
              <p className="ir-status">{statusMessage}</p>
              <p className="ir-status" style={{ fontSize: '0.9rem', color: '#5c6f82' }}>
                Identity verification and cheating detection are tracked separately.
              </p>
              <p className="ir-status" style={{ fontSize: '0.9rem' }}>
                <strong>Verification:</strong> {faceAnalysisStatus.verificationStatus === 'verified' ? 'Verified ✅' : faceAnalysisStatus.verificationStatus === 'pending' ? 'Pending...' : faceAnalysisStatus.verificationStatus === 'no_reference' ? 'No reference photo' : 'Unverified ❌'}
              </p>
              <p className="ir-status" style={{ fontSize: '0.9rem' }}>
                <strong>Proctoring status:</strong> {faceAnalysisStatus.severity === 'serious' ? 'Serious issue' : faceAnalysisStatus.severity === 'warning' ? 'Warning only' : 'Clean'}
                {faceAnalysisStatus.cheatingCount > 0 ? ` (${faceAnalysisStatus.cheatingCount} events)` : ''}
              </p>
              {micError && <p className="ir-error" style={{ marginTop: 8 }}>Microphone access denied.</p>}
              {cameraError && <p className="ir-error" style={{ marginTop: 8 }}>Camera access denied.</p>}
              {thinkTimeLeft > 0 && (
                <div className="ir-think-bar" style={{ marginTop: 8 }}>
                  <strong>Thinking time:</strong> {thinkTimeLeft}s
                  <button className="ir-skip-btn" onClick={startAnswerNow}>Start Answer Now</button>
                </div>
              )}
            </div>

            <div className="ir-question-section">
              <h3 className="ir-section-label">AI Question:</h3>
              <p className={`ir-question-text ${isAiSpeaking ? 'ir-question-text--speaking' : ''}`}>
                {aiQuestion || 'Waiting for question...'}
              </p>
            </div>

            <div className="ir-waveform">
              <p className="ir-waveform-label">{isAiSpeaking ? 'AI is speaking...' : isListening ? 'You are speaking...' : 'Waiting...'}</p>
              <div className="ir-waveform-bars">
                {[1, 2, 3, 4, 5, 6, 7].map((bar) => (
                  <div
                    key={bar}
                    className={`ir-bar ${isAiSpeaking ? 'ir-bar--ai' : isListening ? 'ir-bar--user' : ''}`}
                    style={{ animationDelay: `${bar * 0.1}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="ir-video-panel">
          <video ref={userVideoRef} autoPlay muted playsInline className="ir-video" />
        </div>
      </div>

      {showCompleteModal && <InterviewCompleteModal />}
    </div>
  );
};

export default UserInterviewRoom;
