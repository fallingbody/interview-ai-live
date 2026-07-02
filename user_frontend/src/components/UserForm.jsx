// export default UserForm;
import React, { useCallback, useState ,useEffect} from 'react';
import {  useNavigate, useParams } from 'react-router-dom';
import { loadFaceApi, getFaceEmbedding } from '../utils/faceApiHelper';
import ResumeScanLoader from '../loaders/ResumeScanLoader';
import BiometricsLoader from '../loaders/BiometricsLoader';
import './userForm.css';





const UserForm = () => {
  const { id: sessionId } = useParams();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: '',
    email: '',
    resume: null,
    yearOfStudy: '',
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [interviewerId, setInterviewerId] = useState(null);
  const [sessionRole, setSessionRole] = useState("General Role");

  const [candidateImage, setCandidateImage] = useState(null);
  const [candidateImageVector, setCandidateImageVector] = useState(null);
  // eslint-disable-next-line no-unused-vars
  const [isProcessingFace, setIsProcessingFace] = useState(false);
  const [biometricStatus, setBiometricStatus] = useState('idle');
  const [isScanningResume, setIsScanningResume] = useState(false);
  const [needsCandidateImage, setNeedsCandidateImage] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const [agreedToProctoring, setAgreedToProctoring] = useState(false);

  useEffect(() => {
    // Warm up face-api models client-side in background as soon as the form loads!
    const initFaceApi = async () => {
      try {
        await loadFaceApi();
        console.log("Background face-api warm-up complete.");
      } catch (err) {
        console.error("Background face-api load failed:", err);
      }
    };
    initFaceApi();
    
    // Pre-request permissions so the browser prompt doesn't interrupt the full-screen click later
    navigator.mediaDevices.getUserMedia({ audio: true, video: true })
      .then(stream => stream.getTracks().forEach(track => track.stop()))
      .catch(err => console.warn("Pre-request permissions pending or denied:", err));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  useEffect(() => {
    console.log("Fetched session ID from URL:", sessionId);
    fetch(`${process.env.REACT_APP_API_BASE_URL}/check_session/${sessionId}`)
      .then(response => response.json())
      .then(data => {
        setInterviewerId(data.interviewerId);
        if (data.jobTitle) setSessionRole(data.jobTitle);
        console.log("Fetched interviewer ID:", data.interviewerId);
      })
      .catch(error => {
        console.error("Error fetching interviewer ID:", error);
      });
  }, [sessionId]);

  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];



  const yearOfStudyOptions = [
    '1st Year',
    '2nd Year',
    '3rd Year',
    'Final Year',
    'Graduated'
  ];

  const waitForLoaderPaint = () =>
    new Promise((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTimeout(resolve, 80);
        });
      });
    });

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!allowedTypes.includes(file.type)) {
      setError('Unsupported file type. Please upload a PDF or Word document.');
      setForm(prev => ({ ...prev, resume: null }));
      setScanMessage("");
      setNeedsCandidateImage(false);
    } else {
      setError(null);
      setForm(prev => ({ ...prev, resume: file }));
      setScanMessage("");
      // Don't reset needsCandidateImage here if we already have a candidateImage, 
      // but we do need to re-scan the NEW resume.
      scanResumeForCandidateImage(file);
    }
  };

  const handleImageChange = async (e) => {
    const selectedImage = e.target.files?.[0];
    if (!selectedImage) return;

    if (!selectedImage.type.startsWith("image/")) {
      setError("Please upload a valid image file.");
      setCandidateImage(null);
      setCandidateImageVector(null);
      setBiometricStatus('idle');
      return;
    }

    try {
      setIsProcessingFace(true);
      setBiometricStatus('processing');
      setError(null);
      setScanMessage("");
      await waitForLoaderPaint();

      // Create an offscreen image element to run face-api.js on
      const imgUrl = URL.createObjectURL(selectedImage);
      const img = new Image();
      img.src = imgUrl;
      
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
      });

      // Resize the image using a canvas to prevent face-api from hanging on 10MB+ images
      const MAX_DIMENSION = 600;
      let width = img.width;
      let height = img.height;

      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        if (width > height) {
          height = Math.round((height * MAX_DIMENSION) / width);
          width = MAX_DIMENSION;
        } else {
          width = Math.round((width * MAX_DIMENSION) / height);
          height = MAX_DIMENSION;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      const vector = await getFaceEmbedding(canvas);
      URL.revokeObjectURL(imgUrl);

      if (!vector) {
        setError("No clear front-facing face detected. Please ensure your face is well-lit, fully visible, and directly facing the camera.");
        setCandidateImage(null);
        setCandidateImageVector(null);
        setBiometricStatus('error');
        setScanMessage("");
        e.target.value = ""; // Reset file input
        return;
      }

      setCandidateImage(selectedImage);
      setCandidateImageVector(vector);
      setBiometricStatus('success');
      setScanMessage("✅ Biometric profile registered successfully (zero-image local client extraction).");
      setError(null);
    } catch (err) {
      console.error("Local biometric extraction failed:", err);
      setError("Failed to process photo biometric data locally. Please try a different photo.");
      setCandidateImage(null);
      setCandidateImageVector(null);
      setBiometricStatus('error');
    } finally {
      setIsProcessingFace(false);
    }
  };

  /**
   * 🔹 Ported from v2:
   * Scans the resume PDF to see if a profile picture can be extracted.
   */
  const scanResumeForCandidateImage = async (resumeFile) => {
    if (!resumeFile) return;

    // Allowed scanning for both PDF and DOCX
    const ext = resumeFile.name.split('.').pop().toLowerCase();
    if (ext !== "pdf" && ext !== "docx") {
      setNeedsCandidateImage(true);
      return;
    }

    try {
      setIsScanningResume(true);
      setError("");

      const formData = new FormData();
      formData.append("file", resumeFile);

      // Using the new AI proxy route
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/ai/resumes/scan-face`, {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (response.ok && result.has_face_image) {
        setNeedsCandidateImage(false);
        setScanMessage("Profile photo detected in resume.");
      } else {
        setNeedsCandidateImage(true);
        setScanMessage("No clear profile photo found in resume.");
      }
    } catch (err) {
      console.error("Resume scan error:", err);
      // Fallback: ask for image if scan fails
      setNeedsCandidateImage(true);
    } finally {
      setIsScanningResume(false);
    }
  };

  const createReport = async (sessionId, userId, email, username, resolvedInterviewerId) => {
    try {
      const response = await fetch(`${process.env.REACT_APP_API_BASE_URL}/create-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          interviewerId: resolvedInterviewerId ?? interviewerId,
          userId,
          email,
          name: username,
          yearOfStudy: form.yearOfStudy,
        }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => response.statusText);
        throw new Error(body || `Create report failed (${response.status})`);
      }

      const data = await response.json();
      console.log("✅ Report created with ID:", data.reportId);
      return { success: true, data };
    } catch (err) {
      console.error("❌ Report creation failed:", err);
      return { success: false, error: err.message || String(err) };
    }
  };

  const uploadResume = async (resolvedInterviewerId) => {
    if (needsCandidateImage && !candidateImageVector) {
      setError("A profile photo is required for identity verification during the interview.");
      return;
    }

    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', form.resume);
      formData.append('name', form.username);
      formData.append('email', form.email);

      if (candidateImageVector) {
        formData.append("candidate_image_vector", JSON.stringify(candidateImageVector));
      }

      // 🔹 Sanitize URL to prevent double-slash 404s
      const apiBase = (process.env.REACT_APP_API_BASE_URL || "").replace(/\/$/, "");
      const response = await fetch(`${apiBase}/ai/resumes/upload`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || result.message || `Upload failed (${response.status})`);
      }

      const userIdFromUpload = result.candidate_id;

      const reportResult = await createReport(
        sessionId,
        result.candidate_id,
        form.email,
        form.username,
        resolvedInterviewerId
      );

      if (reportResult.success) {


        navigate('/startinterview', {
          state: {
            candidateId: result.candidate_id,
            resumeId: result.resume_id,
            reportId: reportResult.data.reportId,
            campaignId: sessionId,
            role: sessionRole
          }
        });
        return;
      }

      console.log('reportResult', reportResult.error || 'Report creation failed');

      // If createReport failed, attempt recovery
      try {
        const checkRes = await fetch(`${process.env.REACT_APP_API_BASE_URL}/check_session/${sessionId}/${form.email}`);
        const checkData = await checkRes.json();
        if (checkRes.ok && checkData && (checkData.userId || checkData.user_id)) {
          const existingUserId = checkData.userId || checkData.user_id || userIdFromUpload;
          console.log('Using existing user id:', existingUserId);

          const retryReport = await createReport(
            sessionId,
            existingUserId,
            form.email,
            form.username,
            resolvedInterviewerId
          );
          if (retryReport.success) {


            navigate('/startinterview', {
              state: {
                candidateId: existingUserId,
                resumeId: result.resume_id || null,
                reportId: retryReport.data.reportId,
                campaignId: sessionId,
                role: sessionRole
              }
            });
            return;
          } else {
            throw new Error(`Report retry failed: ${retryReport.error}`);
          }
        } else {
          throw new Error(`Report creation failed: ${reportResult.error}`);
        }
      } catch (retryErr) {
        console.error('Report creation recovery failed:', retryErr);
        throw retryErr;
      }
    } catch (err) {
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const checkEmailExists = async (e) => {
    e.preventDefault();
    setError(null);

    if (!form.resume) return setError("Upload your resume!");
    if (!form.email.trim()) return setError("Enter your email!");

    if (needsCandidateImage && !candidateImage) {
      return setError("Please upload a profile photo for verification.");
    }

    setIsLoading(true);

    try {
      const res = await fetch(`${process.env.REACT_APP_API_BASE_URL}/check_session/${sessionId}/${form.email}`);
      const data = await res.json();

      if (!data.emailExists) return setError("Email not found. Register first.");

      if (data.jobTitle) {
        setSessionRole(data.jobTitle);
      }

      if (data.interviewerId !== null) {
        setInterviewerId(data.interviewerId);
        await uploadResume(data.interviewerId);
      } else {
        setError("Interviewer ID not found for this session.");
      }
    } catch (err) {
      setError(err.message || 'Server error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBiometricLoaderComplete = useCallback(() => {
    setBiometricStatus('idle');
  }, []);

  return (
    <div className="uf-page">
      <ResumeScanLoader visible={isScanningResume} />
      <BiometricsLoader
        visible={isProcessingFace || biometricStatus === 'success' || biometricStatus === 'error'}
        status={biometricStatus === 'idle' ? 'processing' : biometricStatus}
        onComplete={handleBiometricLoaderComplete}
      />

      <header className="uf-header">
        <h1 className="uf-logo">Interview.ai</h1>
      </header>

      <main>
        <div className="uf-card">
          <h2 className="uf-title">Ready for Your Interview?</h2>
          <p className="uf-desc">Upload your details and resume to start!</p>

          <form onSubmit={checkEmailExists}>
            <div className="uf-group">
              <label className="uf-label">Username</label>
              <input
                type="text"
                name="username"
                value={form.username}
                onChange={handleChange}
                required
                className="uf-input"
              />
            </div>

            <div className="uf-group">
              <label className="uf-label">Email</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                className="uf-input"
              />
            </div>



            <div className="uf-group">
              <label className="uf-label">Year of Study</label>
              <select
                name="yearOfStudy"
                value={form.yearOfStudy}
                onChange={handleChange}
                required
                className="uf-input"
              >
                <option value="">Select your year of study</option>
                {yearOfStudyOptions.map((option, index) => (
                  <option key={index} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <div className="uf-group">
              <label className="uf-label">Upload Resume (.pdf, .doc, .docx)</label>
              <input
                type="file"
                name="resume"
                accept=".pdf,.doc,.docx"
                onChange={handleFileChange}
                required
                className="uf-file"
              />
              {scanMessage && !candidateImage && (
                <p className={`uf-scan-status ${needsCandidateImage ? "uf-scan-warning" : "uf-scan-success"}`}>
                  {scanMessage}
                </p>
              )}
              {candidateImage && (
                 <p className="uf-scan-status uf-scan-success">
                    Identity verification photo attached.
                 </p>
              )}
            </div>

            {/* 🔹 Ported from v2: Candidate Image Handler */}
            {needsCandidateImage && (
              <div className="uf-image-box">
                <h4 className="uf-image-title">Identity Verification Photo</h4>
                <p className="uf-image-desc">
                  We couldn't find a photo in your resume. Please upload a clear profile picture for proctoring.
                </p>
                <div className="uf-group uf-group--tight">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="uf-file"
                  />
                </div>
                {candidateImage && (
                  <div className="uf-preview-container" style={{ marginTop: '10px', textAlign: 'center' }}>
                    <img
                      src={URL.createObjectURL(candidateImage)}
                      alt="Preview"
                      style={{ maxWidth: '100px', borderRadius: '8px', border: '2px solid var(--uf-blue)' }}
                    />
                  </div>
                )}
              </div>
            )}

            {error && <p className="uf-error">⚠ {error}</p>}

            <div className="uf-group uf-proctoring-checkbox">
              <label className="uf-checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', color: '#1f2937', cursor: 'pointer', background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <input
                  type="checkbox"
                  required
                  checked={agreedToProctoring}
                  onChange={(e) => setAgreedToProctoring(e.target.checked)}
                  style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#4f46e5' }}
                />
                <span>
                  <strong>Proctoring Agreement:</strong> I confirm that I have closed all other browser tabs and applications. I understand that navigating away from the interview screen will result in immediate termination.
                </span>
              </label>
            </div>

            <button
              type="submit"
              className="uf-submit"
              disabled={isLoading || isScanningResume}
            >
              {isLoading ? 'Checking…' : 'Submit'}
            </button>
          </form>
        </div>
      </main>

      <footer className="uf-footer">
        <p>&copy; {new Date().getFullYear()} <span className="uf-highlight">Interview.ai</span>. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default UserForm;
