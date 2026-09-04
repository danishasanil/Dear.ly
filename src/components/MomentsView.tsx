import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Moment } from '../types';
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db, sanitizePayload } from '../lib/firebase';
import {
  Camera,
  Video,
  Upload,
  X,
  Sparkles,
  AlertCircle,
  RefreshCw,
  Trash2,
  CheckCircle2,
  StopCircle,
} from 'lucide-react';

type CameraMode = 'idle' | 'photo' | 'video';

export const MomentsView: React.FC = () => {
  const { user } = useAuth();
  const [moments, setMoments] = useState<Moment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Form State
  const [text, setText] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'photo' | 'video' | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Camera State
  const [cameraMode, setCameraMode] = useState<CameraMode>('idle');
  const [isRecordingVideo, setIsRecordingVideo] = useState<boolean>(false);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraPermissionNotice, setCameraPermissionNotice] = useState<{
    mode: 'photo' | 'video';
    isBlocked: boolean;
    title: string;
    description: string;
  } | null>(null);

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<NodeJS.Timeout | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  // Real-time listener for user's moments
  useEffect(() => {
    // Immediately reset previous state
    setMoments([]);
    setText('');
    setImageUrl(null);
    setVideoUrl(null);
    setMediaType(null);
    setIsSaving(false);
    setErrorMessage(null);
    setSuccessMessage(null);
    stopCameraStream();
    setCameraMode('idle');

    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const momentsRef = collection(db, 'users', user.uid, 'moments');
    const q = query(momentsRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: Moment[] = snapshot.docs.map((docSnap) => {
          const data = docSnap.data();
          const item: Moment = {
            id: docSnap.id,
            userId: data.userId || user.uid,
            createdAt: data.createdAt || new Date().toISOString(),
          };
          if (data.text) item.text = data.text;
          if (data.imageUrl) item.imageUrl = data.imageUrl;
          if (data.videoUrl) item.videoUrl = data.videoUrl;
          if (data.mediaType) item.mediaType = data.mediaType;
          return item;
        });
        setMoments(list);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching moments:', err);
        setErrorMessage('Could not load your moments. Please refresh.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Clean up media streams and timers on unmount
  useEffect(() => {
    return () => {
      stopCameraStream();
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
      }
    };
  }, []);

  // Stop camera media tracks cleanly
  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setIsRecordingVideo(false);
    setRecordingSeconds(0);
  };

  // Close camera viewfinder
  const handleCancelCamera = () => {
    stopCameraStream();
    setCameraMode('idle');
    setCameraError(null);
    setCameraPermissionNotice(null);
  };

  // Explicit user interaction: start camera for Photo capture
  const handleStartCameraPhoto = async () => {
    setCameraError(null);
    setErrorMessage(null);
    setCameraPermissionNotice(null);
    stopCameraStream();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraPermissionNotice({
        mode: 'photo',
        isBlocked: false,
        title: 'Camera not supported',
        description: 'Your current browser does not support in-app camera capture. You can upload photos directly from your device.',
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraMode('photo');
      setCameraPermissionNotice(null);

      // Bind stream to video element
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 50);
    } catch (err: any) {
      console.warn('Camera access denied or unavailable:', err);
      setCameraMode('idle');

      let isBlocked = false;
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        // Query permission API if available to distinguish between blocked site setting vs dismissed prompt
        if (navigator.permissions && navigator.permissions.query) {
          try {
            const status = await navigator.permissions.query({ name: 'camera' as any });
            if (status.state === 'denied') {
              isBlocked = true;
            }
          } catch {
            // Some browsers throw on querying camera; treat as denied prompt
          }
        }

        setCameraPermissionNotice({
          mode: 'photo',
          isBlocked,
          title: isBlocked ? 'Camera access is blocked' : 'Camera permission needed',
          description: isBlocked
            ? 'Camera access is currently turned off in your browser settings for Dear.ly. To take a photo, tap the lock or camera icon in your address bar, allow Camera access, and click "Allow Camera & Try Again".'
            : 'Dear.ly needs permission to use your camera so you can snap moments directly into your journal. Please click "Allow Camera" and select Allow when prompted.',
        });
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraPermissionNotice({
          mode: 'photo',
          isBlocked: false,
          title: 'No camera found',
          description: 'No camera hardware was detected on your device. You can easily upload photos from your device gallery.',
        });
      } else {
        setCameraPermissionNotice({
          mode: 'photo',
          isBlocked: false,
          title: 'Could not access camera',
          description: 'Another application might be using the camera, or access was interrupted. You can retry or upload a photo.',
        });
      }
    }
  };

  // Explicit user interaction: start camera for Video recording
  const handleStartCameraVideo = async () => {
    setCameraError(null);
    setErrorMessage(null);
    setCameraPermissionNotice(null);
    stopCameraStream();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraPermissionNotice({
        mode: 'video',
        isBlocked: false,
        title: 'Video capture not supported',
        description: 'Your current browser does not support in-app video recording. You can upload video clips from your device.',
      });
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true,
      });
      streamRef.current = stream;
      setCameraMode('video');
      setCameraPermissionNotice(null);

      // Bind stream to video element
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 50);
    } catch (err: any) {
      console.warn('Video camera access error:', err);
      setCameraMode('idle');

      let isBlocked = false;
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraPermissionNotice({
          mode: 'video',
          isBlocked,
          title: 'Camera & microphone needed',
          description: 'Dear.ly needs permission to access your camera and microphone to record a short video moment. Please click "Allow Camera & Mic" and select Allow.',
        });
      } else {
        setCameraPermissionNotice({
          mode: 'video',
          isBlocked: false,
          title: 'Could not access camera or microphone',
          description: 'Please check your device permissions or upload a video from your device.',
        });
      }
    }
  };

  // Take photo from active video frame
  const handleCapturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);

    setImageUrl(dataUrl);
    setVideoUrl(null);
    setMediaType('photo');

    stopCameraStream();
    setCameraMode('idle');
  };

  // Start recording video clip (max 15s to keep size compact)
  const handleStartRecording = () => {
    if (!streamRef.current) return;
    recordedChunksRef.current = [];

    const options: MediaRecorderOptions = {};
    if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
      options.mimeType = 'video/webm;codecs=vp8,opus';
    } else if (MediaRecorder.isTypeSupported('video/webm')) {
      options.mimeType = 'video/webm';
    } else if (MediaRecorder.isTypeSupported('video/mp4')) {
      options.mimeType = 'video/mp4';
    }

    try {
      const recorder = new MediaRecorder(streamRef.current, options);
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'video/webm';
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });

        // Validate size (max 750KB for base64 Firestore storage)
        if (blob.size > 750 * 1024) {
          setCameraError('Recorded video exceeded 750KB. Please record a shorter clip (under 10 seconds).');
          stopCameraStream();
          setCameraMode('idle');
          return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            setVideoUrl(e.target.result as string);
            setImageUrl(null);
            setMediaType('video');
          }
        };
        reader.readAsDataURL(blob);

        stopCameraStream();
        setCameraMode('idle');
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setIsRecordingVideo(true);
      setRecordingSeconds(0);

      // Auto-stop after 15 seconds
      let seconds = 0;
      recordTimerRef.current = setInterval(() => {
        seconds += 1;
        setRecordingSeconds(seconds);
        if (seconds >= 15) {
          handleStopRecording();
        }
      }, 1000);
    } catch (recErr) {
      console.error('MediaRecorder error:', recErr);
      setCameraError('Failed to start video recording on this browser.');
    }
  };

  // Stop recording video clip
  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setIsRecordingVideo(false);
  };

  // Helper to compress uploaded image client-side to ensure lightweight base64
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          const maxDim = 1200;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(e.target?.result as string);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error('Invalid image file.'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file.'));
      reader.readAsDataURL(file);
    });
  };

  // Handle manual photo file upload
  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);

    // Validate media type
    if (!file.type.startsWith('image/')) {
      setErrorMessage('Please select a valid image file (JPEG, PNG, WebP).');
      if (photoInputRef.current) photoInputRef.current.value = '';
      return;
    }

    try {
      const compressedDataUrl = await compressImage(file);
      setImageUrl(compressedDataUrl);
      setVideoUrl(null);
      setMediaType('photo');
    } catch (err) {
      setErrorMessage('Could not process image. Please try another photo.');
    } finally {
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  // Handle manual video file upload
  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMessage(null);

    // Validate media type
    if (!file.type.startsWith('video/')) {
      setErrorMessage('Please select a valid video file (MP4, WebM).');
      if (videoInputRef.current) videoInputRef.current.value = '';
      return;
    }

    // Validate media size (max 750KB)
    if (file.size > 750 * 1024) {
      setErrorMessage('Video file exceeds 750KB limit. Please choose or record a shorter video clip.');
      if (videoInputRef.current) videoInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setVideoUrl(event.target.result as string);
        setImageUrl(null);
        setMediaType('video');
      }
    };
    reader.onerror = () => {
      setErrorMessage('Could not read video file. Please try again.');
    };
    reader.readAsDataURL(file);

    if (videoInputRef.current) videoInputRef.current.value = '';
  };

  // Clear selected media
  const handleRemoveMedia = () => {
    setImageUrl(null);
    setVideoUrl(null);
    setMediaType(null);
  };

  // Save Moment to Firestore
  const handleSaveMoment = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    // 1. Validate authenticated user
    if (!user || !user.uid) {
      setErrorMessage('You must be signed in to save a moment.');
      return;
    }

    const trimmedText = text.trim();

    // 2. Validate required fields (must have text OR photo OR video)
    if (!trimmedText && !imageUrl && !videoUrl) {
      setErrorMessage('Please share what\'s happening or add a photo or video to capture a moment.');
      return;
    }

    setIsSaving(true);

    try {
      const momentId = `moment_${Date.now()}`;
      const now = new Date().toISOString();

      // 3. Construct Firestore payload strictly omitting undefined fields
      const rawPayload: Record<string, any> = {
        id: momentId,
        userId: user.uid,
        createdAt: now,
      };

      if (trimmedText) {
        rawPayload.text = trimmedText;
      }
      if (imageUrl) {
        rawPayload.imageUrl = imageUrl;
      }
      if (videoUrl) {
        rawPayload.videoUrl = videoUrl;
      }
      if (mediaType) {
        rawPayload.mediaType = mediaType;
      }

      // 4. Sanitize payload via reusable helper to guarantee no undefined values
      const cleanPayload = sanitizePayload(rawPayload);

      // 5. Write to Firestore path: users/{uid}/moments/{momentId}
      const momentDocRef = doc(db, 'users', user.uid, 'moments', momentId);
      await setDoc(momentDocRef, cleanPayload);

      // 6. Success: reset form fields
      setText('');
      setImageUrl(null);
      setVideoUrl(null);
      setMediaType(null);
      setSuccessMessage('Moment captured!');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (saveErr: any) {
      console.error('Failed to save moment:', saveErr);
      // PRESERVE user text and media on failure
      setErrorMessage(
        saveErr?.message || 'Failed to save moment. Your text and media are preserved. Please click Retry.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  // Delete moment
  const handleDeleteMoment = async (momentId: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'moments', momentId));
    } catch (err) {
      console.error('Failed to delete moment:', err);
      setErrorMessage('Could not delete moment. Please try again.');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 pb-24 md:pb-12">
      {/* Header */}
      <div className="border-b border-[#EAE3DA] pb-4">
        <h1 className="text-xl sm:text-2xl font-display font-medium text-[#2D2A26] flex items-center gap-2">
          <Camera size={20} className="text-[#6B8E7D]" />
          <span>Capture a Moment</span>
        </h1>
        <p className="text-xs sm:text-sm text-[#736E65] mt-0.5">
          A quick snapshot of your day — a photo, short video, or a simple thought.
        </p>
      </div>

      {/* Creation Card */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-[#EAE3DA] shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#2D2A26] uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles size={13} className="text-[#6B8E7D]" />
            <span>New Moment</span>
          </span>
          {mediaType && (
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#EFF4F2] text-[#2C5240] font-medium border border-[#CDE0D7]">
              {mediaType === 'photo' ? 'Photo attached' : 'Video attached'}
            </span>
          )}
        </div>

        {/* Optional Text: "What's happening?" */}
        <div>
          <textarea
            id="moment-text-input"
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What's happening? (Optional)"
            className="w-full bg-[#FAF7F2] border border-[#EAE3DA] rounded-2xl p-3 sm:p-4 text-xs sm:text-sm text-[#2D2A26] placeholder-[#8C867D] focus:outline-none focus:border-[#6B8E7D] transition-colors resize-none"
          />
        </div>

        {/* Camera Viewfinder (Direct from UI) */}
        {cameraMode !== 'idle' && (
          <div className="space-y-3 p-4 rounded-2xl bg-[#1A1816] text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#E5534B] animate-pulse" />
                <span className="text-xs font-medium">
                  {cameraMode === 'photo'
                    ? 'Camera Active (Take Photo)'
                    : isRecordingVideo
                    ? `Recording Video (${recordingSeconds}s / 15s)`
                    : 'Camera Active (Video Mode)'}
                </span>
              </div>
              <button
                id="moment-cancel-camera-btn"
                onClick={handleCancelCamera}
                className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 text-xs text-white transition-colors cursor-pointer"
              >
                Cancel Camera
              </button>
            </div>

            <div className="relative rounded-xl overflow-hidden bg-black aspect-video max-h-72 flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>

            {/* Camera Control Buttons */}
            <div className="flex items-center justify-center gap-3 pt-1">
              {cameraMode === 'photo' && (
                <button
                  id="moment-capture-photo-trigger-btn"
                  onClick={handleCapturePhoto}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#FAF7F2] hover:bg-white text-[#2D2A26] text-xs font-medium transition-colors cursor-pointer shadow-sm"
                >
                  <Camera size={14} />
                  <span>Snap Photo</span>
                </button>
              )}

              {cameraMode === 'video' && (
                <>
                  {!isRecordingVideo ? (
                    <button
                      id="moment-start-recording-btn"
                      onClick={handleStartRecording}
                      className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-[#E5534B] hover:bg-[#D4423A] text-white text-xs font-medium transition-colors cursor-pointer shadow-sm"
                    >
                      <Video size={14} />
                      <span>Start Recording</span>
                    </button>
                  ) : (
                    <button
                      id="moment-stop-recording-btn"
                      onClick={handleStopRecording}
                      className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white hover:bg-[#FAF7F2] text-[#E5534B] text-xs font-semibold transition-colors cursor-pointer shadow-sm"
                    >
                      <StopCircle size={14} />
                      <span>Stop Recording ({recordingSeconds}s)</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Media Preview (Photo or Video) */}
        {imageUrl && (
          <div className="relative rounded-2xl overflow-hidden border border-[#EAE3DA] bg-[#FAF7F2] group max-w-sm">
            <img
              src={imageUrl}
              alt="Moment preview"
              className="w-full max-h-64 object-cover"
            />
            <button
              id="moment-remove-photo-btn"
              onClick={handleRemoveMedia}
              title="Remove photo"
              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 hover:bg-black/80 text-white transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
            <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-medium">
              Photo
            </div>
          </div>
        )}

        {videoUrl && (
          <div className="relative rounded-2xl overflow-hidden border border-[#EAE3DA] bg-black max-w-sm">
            <video
              src={videoUrl}
              controls
              playsInline
              className="w-full max-h-64 object-cover"
            />
            <button
              id="moment-remove-video-btn"
              onClick={handleRemoveMedia}
              title="Remove video"
              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/70 hover:bg-black text-white transition-colors cursor-pointer z-10"
            >
              <X size={14} />
            </button>
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-medium z-10">
              Video
            </div>
          </div>
        )}

        {/* Camera / Upload Action Bar (Available directly from UI) */}
        {cameraMode === 'idle' && !imageUrl && !videoUrl && (
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#F4EFEA]">
            {/* Device Camera Photo */}
            <button
              id="moment-camera-photo-btn"
              onClick={handleStartCameraPhoto}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#FAF7F2] hover:bg-[#F4EFEA] text-[#2D2A26] text-xs font-medium border border-[#EAE3DA] transition-colors cursor-pointer"
            >
              <Camera size={14} className="text-[#6B8E7D]" />
              <span>Camera Photo</span>
            </button>

            {/* Device Camera Video */}
            <button
              id="moment-camera-video-btn"
              onClick={handleStartCameraVideo}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#FAF7F2] hover:bg-[#F4EFEA] text-[#2D2A26] text-xs font-medium border border-[#EAE3DA] transition-colors cursor-pointer"
            >
              <Video size={14} className="text-[#C07D53]" />
              <span>Camera Video</span>
            </button>

            {/* Photo Upload */}
            <label
              id="moment-upload-photo-btn"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#FAF7F2] hover:bg-[#F4EFEA] text-[#2D2A26] text-xs font-medium border border-[#EAE3DA] transition-colors cursor-pointer"
            >
              <Upload size={13} className="text-[#736E65]" />
              <span>Upload Photo</span>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoFileChange}
                className="hidden"
              />
            </label>

            {/* Video Upload */}
            <label
              id="moment-upload-video-btn"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#FAF7F2] hover:bg-[#F4EFEA] text-[#2D2A26] text-xs font-medium border border-[#EAE3DA] transition-colors cursor-pointer"
            >
              <Upload size={13} className="text-[#736E65]" />
              <span>Upload Video</span>
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                onChange={handleVideoFileChange}
                className="hidden"
              />
            </label>
          </div>
        )}

        {/* Friendly In-App Camera / Media Permission Card (Calm & Non-Error) */}
        {cameraPermissionNotice && (
          <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF7F2] border border-[#EAE3DA] space-y-3.5 animate-in fade-in transition-all">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#EBF1ED] border border-[#CDE0D7] flex items-center justify-center text-[#4D6D5C] shrink-0 shadow-2xs">
                <Camera size={18} />
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-[#2D2A26] flex items-center gap-1.5">
                  <span>{cameraPermissionNotice.title}</span>
                </h3>
                <p className="text-xs text-[#736E65] leading-relaxed">
                  {cameraPermissionNotice.description}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#EAE3DA]/70">
              <button
                id="moment-allow-camera-btn"
                type="button"
                onClick={
                  cameraPermissionNotice.mode === 'photo'
                    ? handleStartCameraPhoto
                    : handleStartCameraVideo
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#6B8E7D] hover:bg-[#5A7A6A] text-white text-xs font-medium transition-colors cursor-pointer shadow-2xs"
              >
                <Camera size={13} />
                <span>
                  {cameraPermissionNotice.isBlocked
                    ? 'Allow Camera & Try Again'
                    : 'Allow Camera'}
                </span>
              </button>

              <label
                onClick={() => setCameraPermissionNotice(null)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white hover:bg-[#F4EFEA] text-[#2D2A26] text-xs font-medium border border-[#EAE3DA] transition-colors cursor-pointer shadow-2xs"
              >
                <Upload size={13} className="text-[#736E65]" />
                <span>Upload from Device</span>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoFileChange}
                  className="hidden"
                />
              </label>

              <button
                id="moment-dismiss-permission-btn"
                type="button"
                onClick={() => setCameraPermissionNotice(null)}
                className="px-3 py-1.5 rounded-full text-xs text-[#8C867D] hover:text-[#2D2A26] hover:bg-white/60 transition-colors cursor-pointer ml-auto"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Camera Error Message */}
        {cameraError && (
          <div className="p-3 rounded-2xl bg-[#FAF7F2] border border-[#EAE3DA] text-[#736E65] text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0 text-[#C07D53]" />
              <span>{cameraError}</span>
            </div>
            <button
              onClick={() => setCameraError(null)}
              className="text-xs font-semibold text-[#6B8E7D] hover:underline ml-2 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Save Error Alert with Retry */}
        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-[#FDF0ED] border border-[#F5C7C1] text-[#A64438] text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              id="moment-retry-btn"
              onClick={handleSaveMoment}
              className="px-3 py-1 rounded-full bg-[#A64438] text-white font-medium hover:bg-[#8E3A30] transition-colors cursor-pointer ml-3 shrink-0"
            >
              Retry
            </button>
          </div>
        )}

        {/* Success Alert */}
        {successMessage && (
          <div className="p-3 rounded-2xl bg-[#EFF4F2] border border-[#CDE0D7] text-[#2C5240] text-xs flex items-center gap-2">
            <CheckCircle2 size={14} className="text-[#6B8E7D]" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Action Row */}
        <div className="flex items-center justify-end pt-2 border-t border-[#F4EFEA]">
          <button
            id="moment-save-btn"
            disabled={isSaving || (!text.trim() && !imageUrl && !videoUrl)}
            onClick={handleSaveMoment}
            aria-label="Save captured moment"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#2D2A26] hover:bg-[#1A1816] text-[#FAF7F2] text-xs sm:text-sm font-medium transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6B8E7D] active:scale-[0.98]"
          >
            {isSaving ? (
              <>
                <RefreshCw size={13} className="animate-spin" />
                <span>Saving Moment...</span>
              </>
            ) : (
              <span>Capture Moment</span>
            )}
          </button>
        </div>
      </div>

      {/* Captured Moments Timeline / Gallery */}
      <div className="space-y-4">
        <h2 className="font-display font-medium text-lg text-[#2D2A26]">
          Your Moments
        </h2>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-xs text-[#8C867D]">
            <RefreshCw size={14} className="animate-spin mr-2" />
            <span>Loading moments...</span>
          </div>
        ) : moments.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 text-center border border-[#EAE3DA] shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#EFF4F2] text-[#4D6D5C] flex items-center justify-center mx-auto">
              <Camera size={22} />
            </div>
            <h3 className="font-display font-medium text-base text-[#2D2A26]">
              No moments captured yet
            </h3>
            <p className="text-xs text-[#736E65] max-w-xs mx-auto leading-relaxed">
              Take a photo, record a clip, or jot down what's happening to build your visual timeline.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {moments.map((moment) => (
              <div
                key={moment.id}
                id={`moment-card-${moment.id}`}
                className="bg-white rounded-3xl overflow-hidden border border-[#EAE3DA] shadow-xs hover:shadow-sm transition-shadow flex flex-col justify-between"
              >
                <div>
                  {/* Photo Display */}
                  {moment.imageUrl && (
                    <div className="w-full bg-[#FAF7F2] aspect-video max-h-56 overflow-hidden">
                      <img
                        src={moment.imageUrl}
                        alt="Captured moment"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {/* Video Display */}
                  {moment.videoUrl && (
                    <div className="w-full bg-black aspect-video max-h-56 overflow-hidden flex items-center justify-center">
                      <video
                        src={moment.videoUrl}
                        controls
                        playsInline
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  {/* Moment Text */}
                  {moment.text && (
                    <div className="p-4 sm:p-5">
                      <p className="text-xs sm:text-sm text-[#2D2A26] leading-relaxed whitespace-pre-wrap">
                        {moment.text}
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer with Timestamp and Delete Button */}
                <div className="px-4 py-3 bg-[#FAF7F2]/60 border-t border-[#EAE3DA] flex items-center justify-between text-[11px] text-[#8C867D]">
                  <span>
                    {new Date(moment.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}{' '}
                    •{' '}
                    {new Date(moment.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>

                  <button
                    onClick={() => handleDeleteMoment(moment.id)}
                    title="Delete moment"
                    className="p-1 rounded-full text-[#A69F94] hover:text-[#A64438] hover:bg-[#FDF0ED] transition-colors cursor-pointer"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
