from flask import Blueprint, request, send_file, Response
from typing import Tuple
import os
from io import BytesIO
import numpy as np
import scipy.io.wavfile
from pocket_tts import TTSModel
from functools import lru_cache
import hashlib
from concurrent.futures import ThreadPoolExecutor
import threading

tts_bp = Blueprint('tts_bp', __name__, url_prefix='/api/tts')

VOICE_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))), "audio.wav")

_model = None
_voice_state = None
_tts_lock = threading.Lock()
_generation_lock = threading.Lock()

def get_tts_model() -> Tuple[TTSModel, any]:
    """Lazy loads and returns the singleton TTSModel and voice prompt state."""
    global _model, _voice_state
    
    with _tts_lock:
        if _model is None:
            print("--- Environment Check ---")
            print(f"Available Keys: {list(os.environ.keys())}")
            print("-------------------------")
            print("Loading Pocket-TTS (100M parameters)...")
            
            hf_token = os.environ.get("HF_TOKEN")
            if hf_token:
                try:
                    from huggingface_hub import login
                    login(token=hf_token)
                    print("Successfully logged into Hugging Face Hub")
                except Exception as e:
                    print(f"Warning: HF login failed: {e}")
            else:
                print("Warning: No HF_TOKEN found in environment")
            
            _model = TTSModel.load_model()
            
            # Decode audio_base64.txt to VOICE_FILE dynamically if it is missing or a small LFS pointer
            BASE64_FILE = os.path.join(os.path.dirname(VOICE_FILE), "audio_base64.txt")
            is_lfs_pointer = os.path.exists(VOICE_FILE) and os.path.getsize(VOICE_FILE) < 1000
            if (not os.path.exists(VOICE_FILE) or is_lfs_pointer) and os.path.exists(BASE64_FILE):
                try:
                    import base64
                    with open(BASE64_FILE, "r") as b64_f:
                        b64_data = b64_f.read().strip()
                        if "," in b64_data:
                            b64_data = b64_data.split(",")[1]
                        wav_bytes = base64.b64decode(b64_data)
                        with open(VOICE_FILE, "wb") as wav_f:
                            wav_f.write(wav_bytes)
                    print(f"Decoded {BASE64_FILE} successfully to {VOICE_FILE}!")
                except Exception as e:
                    print(f"Warning: Failed to decode base64 audio: {e}")
            PT_FILE = VOICE_FILE + ".pt"
            
            # Try to load from .pt file first for speed
            if os.path.exists(PT_FILE):
                try:
                    import torch
                    _voice_state = torch.load(PT_FILE, weights_only=False)
                    print(f"Successfully loaded voice state from {PT_FILE} (instant load)")
                except Exception as e:
                    print(f"Warning: Failed to load from {PT_FILE} ({e}). Will re-clone.")
                    _voice_state = None

            if _voice_state is None:
                if os.path.exists(VOICE_FILE):
                    try:
                        _voice_state = _model.get_state_for_audio_prompt(VOICE_FILE)
                        print(f"Successfully cloned {VOICE_FILE}")
                        try:
                            import torch
                            torch.save(_voice_state, PT_FILE)
                            print(f"Successfully saved voice state to {PT_FILE} for faster future loads")
                        except Exception as e:
                            print(f"Warning: Failed to save to {PT_FILE} ({e})")
                    except ValueError as e:
                        print(f"Warning: Voice cloning failed ({e}). Falling back to default voice.")
                        _voice_state = _model.get_state_for_audio_prompt("alba")
                else:
                    print(f"Warning: {VOICE_FILE} not found. Falling back to default voice.")
                    _voice_state = _model.get_state_for_audio_prompt("alba")
            
            # Warm up
            try:
                print("[TTS] Warming up model with test generation...")
                test_text = "Hello, this is a test."
                _ = _model.generate_audio(_voice_state, test_text)
                print("[TTS] OK - Model warm-up complete")
            except Exception as e:
                print(f"[TTS] WARN - Model warm-up failed (non-critical): {e}")
                
    return _model, _voice_state


# Cache for generated audio
_audio_cache = {}
_pregeneration_cache = {}  # Store pre-generated audio with TTL
_pregeneration_threads = {}  # Track active pre-generation threads
_pregeneration_lock = threading.Lock()  # Ensure only one pregen thread starts per question

def _amplify_audio(audio_tensor, gain_db=3.0):
    """
    Gentle amplification without aggressive normalization.
    Prevents robotic sound artifacts.
    
    Args:
        audio_tensor: Audio tensor (float or numpy array)
        gain_db: Gain in decibels (default 3dB ≈ 1.4x amplitude)
    
    Returns:
        Amplified audio as numpy array
    """
    audio = np.array(audio_tensor, dtype=np.float32)
    
    # Apply gain linearly (less aggressive than normalization)
    gain_linear = 10 ** (gain_db / 20.0)
    audio = audio * gain_linear
    
    # Gentle limiter (no harsh clipping)
    # Threshold at 0.95 to leave headroom
    threshold = 0.95
    mask = np.abs(audio) > threshold
    audio[mask] = np.sign(audio[mask]) * threshold
    
    return audio

def _pregenerate_audio_background(interview_id: str, question_text: str, question_no: int):
    """
    Pre-generate audio in background thread without blocking.
    Stores result in _pregeneration_cache keyed by interview_id and question_no.
    """
    cache_key = f"{interview_id}:{question_no}"
    
    try:
        print(f"[PreGen] Starting background generation for Q{question_no}")
        
        # Use chunking if long
        if len(question_text) > 200:
            audio_chunks = _generate_audio_chunks(question_text)
            combined_audio = b""
            for i, chunk_data in enumerate(audio_chunks):
                if i == 0:
                    combined_audio = chunk_data
                else:
                    combined_audio += chunk_data[44:]
            audio_data = combined_audio
        else:
            audio_data = _generate_audio_cached(question_text)
        
        model, voice_state = get_tts_model()
        # Apply interview volume ducking
        audio_int16 = np.frombuffer(audio_data[44:], dtype=np.int16)
        audio_float = audio_int16.astype(np.float32) / 32768.0
        audio_float *= 0.7
        audio_int16_reduced = np.clip(audio_float * 32767, -32768, 32767).astype(np.int16)
        audio_buffer = BytesIO()
        scipy.io.wavfile.write(audio_buffer, model.sample_rate, audio_int16_reduced)
        audio_buffer.seek(0)
        
        _pregeneration_cache[cache_key] = audio_buffer.getvalue()
        print(f"[PreGen] OK - Pre-generated Q{question_no} ready for interview {interview_id}")
        
    except Exception as e:
        print(f"[PreGen] ERR - Error pre-generating Q{question_no}: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Clean up thread reference
        if cache_key in _pregeneration_threads:
            del _pregeneration_threads[cache_key]

@tts_bp.route('/pregenerate', methods=['POST'])
def pregenerate_audio():
    """
    Trigger background pre-generation of audio for a question.
    Called while user is answering current question.
    Returns immediately without waiting.
    """
    data = request.json
    interview_id = data.get('interview_id')
    question_text = data.get('text')
    question_no = data.get('question_no', 0)
    
    if not interview_id or not question_text:
        return {"error": "interview_id and text required"}, 400
    
    cache_key = f"{interview_id}:{question_no}"
    
    with _pregeneration_lock:
        if cache_key in _pregeneration_threads or cache_key in _pregeneration_cache:
            return {"status": "already_in_progress_or_cached"}, 200

        thread = threading.Thread(
            target=_pregenerate_audio_background,
            args=(interview_id, question_text, question_no),
            daemon=True
        )
        _pregeneration_threads[cache_key] = thread
        thread.start()

    return {"status": "pre-generation_started"}, 202

@tts_bp.route('/get-pregenerated', methods=['POST'])
def get_pregenerated_audio():
    """
    Retrieve pre-generated audio if available.
    Falls back to on-demand generation if not ready yet.
    """
    data = request.json
    interview_id = data.get('interview_id')
    question_text = data.get('text')
    question_no = data.get('question_no', 0)
    max_wait_ms = data.get('max_wait_ms', 3000)  # Wait up to 3000ms
    
    if not interview_id or not question_text:
        return {"error": "interview_id and text required"}, 400
    
    cache_key = f"{interview_id}:{question_no}"
    
    # Check if pre-generated audio is ready
    if cache_key in _pregeneration_cache:
        audio_data = _pregeneration_cache.pop(cache_key)
        print(f"[Cache] OK - Using pre-generated audio for Q{question_no}")
        audio_buffer = BytesIO(audio_data)
        return send_file(audio_buffer, mimetype="audio/wav", as_attachment=False)
    
    # Wait for pre-generation to complete if it is running
    wait_interval = 50  # ms
    elapsed = 0
    # Wait up to 30000ms (30s) if the thread is actively running
    while elapsed < 30000 and cache_key in _pregeneration_threads:
        threading.Event().wait(wait_interval / 1000.0)
        elapsed += wait_interval
        if cache_key in _pregeneration_cache:
            audio_data = _pregeneration_cache.pop(cache_key)
            print(f"[Cache] OK - Using pre-generated audio after {elapsed}ms wait for Q{question_no}")
            audio_buffer = BytesIO(audio_data)
            return send_file(audio_buffer, mimetype="audio/wav", as_attachment=False)
            
    # Check one last time in case the thread finished and the loop exited
    if cache_key in _pregeneration_cache:
        audio_data = _pregeneration_cache.pop(cache_key)
        print(f"[Cache] OK - Using pre-generated audio after {elapsed}ms wait for Q{question_no} (post-loop check)")
        audio_buffer = BytesIO(audio_data)
        return send_file(audio_buffer, mimetype="audio/wav", as_attachment=False)

    if cache_key in _pregeneration_threads:
        print(f"[Cache] ERR - Pre-generation took too long for Q{question_no}")
        return {"error": "Audio generation timeout"}, 504
    
    # Fall back to on-demand generation if pre-gen was never started or crashed
    print(f"[Cache] WARN - Pre-gen not found in cache or threads, generating on-demand for Q{question_no}")
    if len(question_text) > 200:
        audio_chunks = _generate_audio_chunks(question_text)
        combined_audio = b""
        for i, chunk_data in enumerate(audio_chunks):
            if i == 0:
                combined_audio = chunk_data
            else:
                combined_audio += chunk_data[44:]
        audio_data = combined_audio
    else:
        audio_data = _generate_audio_cached(question_text)
    
    model, voice_state = get_tts_model()
    audio_int16 = np.frombuffer(audio_data[44:], dtype=np.int16)
    audio_float = audio_int16.astype(np.float32) / 32768.0
    audio_float *= 0.7
    audio_int16_reduced = np.clip(audio_float * 32767, -32768, 32767).astype(np.int16)
    audio_buffer = BytesIO()
    scipy.io.wavfile.write(audio_buffer, model.sample_rate, audio_int16_reduced)
    audio_buffer.seek(0)
    return send_file(audio_buffer, mimetype="audio/wav", as_attachment=False)


def _split_text_for_streaming(text: str, max_chunk_length: int = 200) -> list:
    """Split text into chunks for faster parallel generation.
    Keeps sentences together for naturalness.
    """
    sentences = text.replace('?', '?.').replace('!', '!.').split('.')
    chunks = []
    current_chunk = ""
    
    for sentence in sentences:
        if not sentence.strip():
            continue
        sentence_with_period = sentence.strip() + "."
        if len(current_chunk) + len(sentence_with_period) <= max_chunk_length:
            current_chunk += sentence_with_period + " "
        else:
            if current_chunk:
                chunks.append(current_chunk.strip())
            current_chunk = sentence_with_period + " "
    
    if current_chunk:
        chunks.append(current_chunk.strip())
    
    return [c for c in chunks if c.strip()]

def _generate_audio_cached(text: str):
    """Generate audio with caching to avoid regenerating same text."""
    text_hash = hashlib.md5(text.encode()).hexdigest()
    
    if text_hash in _audio_cache:
        return _audio_cache[text_hash]
    
    model, voice_state = get_tts_model()
    
    with _generation_lock:
        if text_hash in _audio_cache:
            return _audio_cache[text_hash]
        audio_tensor = model.generate_audio(voice_state, text)
    
    # Gentle amplification for natural sound (reduced from 8dB)
    audio_amplified = _amplify_audio(audio_tensor, gain_db=3.0)
    
    # Convert to int16 for WAV (range: -32768 to 32767)
    audio_int16 = np.clip(audio_amplified * 32767, -32768, 32767).astype(np.int16)
    
    # Store in memory buffer
    audio_bytes = BytesIO()
    scipy.io.wavfile.write(audio_bytes, model.sample_rate, audio_int16)
    audio_bytes.seek(0)
    
    _audio_cache[text_hash] = audio_bytes.getvalue()
    return _audio_cache[text_hash]

def _generate_audio_chunks(text: str) -> list:
    """Generate audio chunks in parallel for long text - 2x faster for long questions."""
    chunks = _split_text_for_streaming(text)
    
    if len(chunks) <= 1:
        return [_generate_audio_cached(text)]
    
    audio_chunks = [None] * len(chunks)
    model, voice_state = get_tts_model()
    
    def generate_chunk(index, chunk_text):
        text_hash = hashlib.md5(chunk_text.encode()).hexdigest()
        if text_hash in _audio_cache:
            audio_chunks[index] = _audio_cache[text_hash]
        else:
            with _generation_lock:
                audio_tensor = model.generate_audio(voice_state, chunk_text)
            audio_amplified = _amplify_audio(audio_tensor, gain_db=3.0)
            audio_int16 = np.clip(audio_amplified * 32767, -32768, 32767).astype(np.int16)
            wav_bytes = BytesIO()
            scipy.io.wavfile.write(wav_bytes, model.sample_rate, audio_int16)
            wav_bytes.seek(0)
            audio_chunks[index] = wav_bytes.getvalue()
    
    # Generate chunks sequentially for pocket_tts (thread-safe issues possible)
    for i, chunk in enumerate(chunks):
        generate_chunk(i, chunk)
    
    return audio_chunks

@tts_bp.route('', methods=['POST'])
def generate_speech():
    data = request.json
    text = data.get('text')
    is_recording = data.get('is_recording', False)  # True when user is responding
    
    if not text:
        return {"error": "Text is required"}, 400

    try:
        audio_data = _generate_audio_cached(text)
        audio_array = np.frombuffer(audio_data, dtype=np.uint8)
        
        # If recording is active, reduce AI volume to avoid echo feedback
        if is_recording:
            model, voice_state = get_tts_model()
            # Convert from uint8 WAV to float for processing
            audio_int16 = np.frombuffer(audio_data[44:], dtype=np.int16)  # Skip WAV header
            audio_float = audio_int16.astype(np.float32) / 32768.0
            
            # Reduce volume to -6dB (50%) to prevent microphone pickup
            audio_float *= 0.5
            
            # Convert back
            audio_int16_reduced = np.clip(audio_float * 32767, -32768, 32767).astype(np.int16)
            audio_buffer = BytesIO()
            scipy.io.wavfile.write(audio_buffer, model.sample_rate, audio_int16_reduced)
            audio_buffer.seek(0)
            return send_file(audio_buffer, mimetype="audio/wav", as_attachment=False)
        
        audio_buffer = BytesIO(audio_data)
        return send_file(audio_buffer, mimetype="audio/wav", as_attachment=False)
        
    except Exception as e:
        print(f"TTS Error: {e}")
        return {"error": str(e)}, 500

@tts_bp.route('/interview', methods=['POST'])
def generate_interview_speech():
    """
    Generate TTS for interview questions.
    - Uses text chunking for 2x faster performance on long questions
    - Automatically ducks volume to prevent echo/feedback during recording
    - Natural sound without robotic artifacts
    """
    data = request.json
    text = data.get('text')
    
    if not text:
        return {"error": "Text is required"}, 400

    try:
        # For long text, use chunking for faster generation
        if len(text) > 200:
            audio_chunks = _generate_audio_chunks(text)
            # Combine chunks into single WAV
            combined_audio = b""
            for i, chunk_data in enumerate(audio_chunks):
                if i == 0:
                    combined_audio = chunk_data
                else:
                    # Skip WAV header for subsequent chunks
                    combined_audio += chunk_data[44:]
            audio_data = combined_audio
        else:
            audio_data = _generate_audio_cached(text)
        
        model, voice_state = get_tts_model()
        # Always duck volume for interview mode (user will be speaking right after)
        # Convert from uint8 WAV to float for processing
        audio_int16 = np.frombuffer(audio_data[44:], dtype=np.int16)  # Skip WAV header
        audio_float = audio_int16.astype(np.float32) / 32768.0
        
        # Reduce volume to -3dB (70%) for interview mode
        # Allows user to hear clearly but reduces echo feedback
        audio_float *= 0.7
        
        # Convert back
        audio_int16_reduced = np.clip(audio_float * 32767, -32768, 32767).astype(np.int16)
        audio_buffer = BytesIO()
        scipy.io.wavfile.write(audio_buffer, model.sample_rate, audio_int16_reduced)
        audio_buffer.seek(0)
        
        return send_file(audio_buffer, mimetype="audio/wav", as_attachment=False)
        
    except Exception as e:
        print(f"TTS Error: {e}")
        import traceback
        traceback.print_exc()
        return {"error": str(e)}, 500

