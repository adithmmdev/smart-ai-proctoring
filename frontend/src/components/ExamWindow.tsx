import React, { useState, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { Badge } from "./ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import { Switch } from "./ui/switch";
import {
  Clock,
  Camera,
  AlertTriangle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
  WifiOff,
  Video,
  VideoOff,
  UserX,
  Users,
  Eye,
  Pause,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import * as blazeface from "@tensorflow-models/blazeface";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-core";
import "@tensorflow/tfjs-backend-webgl";
import axios from "axios";
import KalmanFilter from "kalmanjs";
import { FaceMesh } from "@mediapipe/face_mesh";
import { Camera as MediaPipeCamera } from "@mediapipe/camera_utils";
import { useFullscreenProctoring } from "../hooks/useFullscreenProctoring";
import { useFullscreenGuard } from "../hooks/useFullscreenGuard";
import { FullscreenBlockerOverlay } from "./FullscreenBlockerOverlay";

interface ExamWindowProps {
  examData: {
    id?: string | number;
    examId?: string;
    subject: string;
    totalQuestions?: number;
    durationInSeconds: number;
  };
  onExitExam: () => void;
}

export function ExamWindow({ examData, onExitExam }: ExamWindowProps) {
  const [examStarted, setExamStarted] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [timeLeft, setTimeLeft] = useState(examData.durationInSeconds);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [connectionActive, setConnectionActive] = useState(true);
  const [examDetails, setExamDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<any[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // AI Proctoring State
  const [faceDetectionModel, setFaceDetectionModel] = useState<any>(null);
  const [faceMeshModel, setFaceMeshModel] = useState<FaceMesh | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [lastFlagType, setLastFlagType] = useState<string | null>(null);
  const [activityLog, setActivityLog] = useState<
    Array<{
      id: number;
      timestamp: string;
      message: string;
      severity: "success" | "warning" | "error" | "info";
      type?: string;
    }>
  >([]);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const faceDetectionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [totalViolationFlags, setTotalViolationFlags] = useState(0);
  const [maxAllowedViolations, setMaxAllowedViolations] = useState(3);
  const [violationWarningShown, setViolationWarningShown] = useState(false);
  const [examAutoSubmitted, setExamAutoSubmitted] = useState(false);
  const [gazeAwayCount, setGazeAwayCount] = useState(0); // Track consecutive frames looking away
  const [enableAutoSubmission, setEnableAutoSubmission] = useState(true); // Track if auto-submission is enabled
  const [enablePause, setEnablePause] = useState(false); // Track if pause button is enabled
  const [detectTabSwitching, setDetectTabSwitching] = useState(false); // Track if tab switching detection is enabled
  const [enableCameraMonitoring, setEnableCameraMonitoring] = useState(false); // Track if camera monitoring is enabled
  const [randomizeQuestions, setRandomizeQuestions] = useState(false); // Track if question randomization is enabled
  const [randomizeOptions, setRandomizeOptions] = useState(false); // Track if option randomization is enabled
  const [userId, setUserId] = useState<string | undefined>(undefined); // Track user ID for fullscreen proctoring
  
  // Fullscreen guard hook - shows blocker overlay when fullscreen exits
  const {
    fullscreenActive,
    reEnterFullscreen,
  } = useFullscreenGuard({
    examId: examData.examId || examData.id,
    studentId: userId,
    enabled: examStarted, // Only enable when exam is started
  });

  // Fullscreen proctoring hook (for warnings and logging)
  const {
    isFullscreen,
    fullscreenWarnings,
    enterFullscreen,
    requestFullscreen,
  } = useFullscreenProctoring({
    examId: examData.examId || examData.id,
    userId: userId,
    enabled: examStarted && fullscreenActive, // Only enable when exam is started and fullscreen is active
    onFullscreenExit: () => {
      // Add to activity log when fullscreen exits
      addToActivityLog(
        `Fullscreen exit detected. This is considered suspicious activity.`,
        'error',
        'fullscreen-exit'
      );
    },
  });
  
  // Advanced 3D Head Pose Tracking
  const [currentHeadPose, setCurrentHeadPose] = useState<{yaw: number, pitch: number, roll: number} | null>(null);
  const [currentGaze, setCurrentGaze] = useState<string>('Center');
  const kalmanYawRef = useRef<any | null>(null);
  const kalmanPitchRef = useRef<any | null>(null);
  const kalmanRollRef = useRef<any | null>(null);
  const lastPoseRef = useRef<{yaw: number, pitch: number, roll: number} | null>(null);
  const violationStartTimeRef = useRef<{yaw: number | null, pitch: number | null, roll: number | null}>({
    yaw: null, pitch: null, roll: null
  });
  const lastViolationCheckRef = useRef<number>(0);
  const maxViolationMessageShownRef = useRef<boolean>(false);

  // Fetch exam details with questions from backend
  useEffect(() => {
    const fetchExamDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem('token');
        
        if (!token) {
          setError('Authentication required. Please login again.');
          setLoading(false);
          return;
        }

        // Get exam ID from examData
        const examId = examData.examId || examData.id;
        
        if (!examId) {
          setError('Invalid exam data - exam ID not found');
          setLoading(false);
          return;
        }

        console.log('Fetching exam details for ID:', examId);

        const response = await fetch(`http://localhost:3000/api/v1/exam/get/${examId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch exam details: ${response.statusText}`);
        }

        const data = await response.json();
        console.log('Exam details fetched:', data);
        console.log('Proctoring settings:', data.proctoringSettings);
        console.log('Enable pause value:', data.proctoringSettings?.enablePause);
        
        setExamDetails(data);
        
        // Set maxAllowedViolations from exam settings
        if (data.proctoringSettings?.maxAllowedViolations) {
          setMaxAllowedViolations(data.proctoringSettings.maxAllowedViolations);
        } else if (data.maxAllowedViolations) {
          setMaxAllowedViolations(data.maxAllowedViolations);
        }
        
        // Set enableAutoSubmission from exam settings
        if (data.proctoringSettings?.enableAutoSubmission !== undefined) {
          setEnableAutoSubmission(data.proctoringSettings.enableAutoSubmission);
        } else {
          setEnableAutoSubmission(true); // Default to true if not specified
        }
        
        // Set enablePause from exam settings
        if (data.proctoringSettings?.enablePause !== undefined) {
          setEnablePause(data.proctoringSettings.enablePause);
          console.log('Pause button enabled:', data.proctoringSettings.enablePause);
        } else {
          setEnablePause(false); // Default to false if not specified
          console.log('Pause button not specified in exam settings, defaulting to disabled');
        }
        
        // Set detectTabSwitching from exam settings
        if (data.proctoringSettings?.detectTabSwitching !== undefined) {
          setDetectTabSwitching(data.proctoringSettings.detectTabSwitching);
          console.log('Tab switching detection enabled:', data.proctoringSettings.detectTabSwitching);
        } else {
          setDetectTabSwitching(false); // Default to false if not specified
        }
        
        // Set enableCameraMonitoring from exam settings
        if (data.proctoringSettings?.enableCameraMonitoring !== undefined) {
          setEnableCameraMonitoring(data.proctoringSettings.enableCameraMonitoring);
          console.log('Camera monitoring enabled:', data.proctoringSettings.enableCameraMonitoring);
        } else {
          setEnableCameraMonitoring(false); // Default to false if not specified
        }
        
        // Set randomization settings from exam settings
        if (data.proctoringSettings?.randomizeQuestions !== undefined) {
          setRandomizeQuestions(data.proctoringSettings.randomizeQuestions);
          console.log('Randomize questions enabled:', data.proctoringSettings.randomizeQuestions);
        } else {
          setRandomizeQuestions(false); // Default to false if not specified
        }
        
        if (data.proctoringSettings?.randomizeOptions !== undefined) {
          setRandomizeOptions(data.proctoringSettings.randomizeOptions);
          console.log('Randomize options enabled:', data.proctoringSettings.randomizeOptions);
        } else {
          setRandomizeOptions(false); // Default to false if not specified
        }
        
        // Format questions from database
        if (data.questions && Array.isArray(data.questions)) {
          const formattedQuestions = data.questions.map((q: any, index: number) => ({
            id: q._id ? q._id.toString() : `q${index + 1}`,
            questionId: q._id ? q._id.toString() : null,
        type: "multiple-choice",
            question: q.questionText || q.question || `Question ${index + 1}`,
            options: q.options || [],
            correctAnswer: q.correctAnswer || '',
            marks: q.marks || 0
          }));
          
          console.log(`Formatted ${formattedQuestions.length} questions from database`);
          setQuestions(formattedQuestions);
          
          // Update time left if exam duration is available
          if (data.duration) {
            setTimeLeft(data.duration * 60); // Convert minutes to seconds
          }
        } else {
          console.error('No questions found in exam data:', data);
          setError('No questions found for this exam');
          setQuestions([]);
        }
        
        // Check for paused submission and load saved answers
        try {
          const examId = examData.examId || examData.id;
          const submissionResponse = await fetch(`http://localhost:3000/api/v1/submission/${examId}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
          });

          if (submissionResponse.ok) {
            const submissionData = await submissionResponse.json();
            console.log('Submission data:', submissionData);
            
            // If there's a paused submission, load saved answers
            if (submissionData.isPaused && submissionData.answers && submissionData.answers.length > 0) {
              console.log('Found paused submission, loading saved answers...');
              
              // Restore saved answers
              const savedAnswers: { [key: string]: string } = {};
              submissionData.answers.forEach((ans: any) => {
                if (ans.questionId && ans.selectedAnswer) {
                  savedAnswers[ans.questionId.toString()] = ans.selectedAnswer;
                }
              });
              
              setAnswers(savedAnswers);
              console.log('Loaded saved answers:', savedAnswers);
              
              // Restore time remaining if available
              if (submissionData.timeRemaining !== null && submissionData.timeRemaining !== undefined) {
                setTimeLeft(submissionData.timeRemaining);
                console.log('Restored time remaining:', submissionData.timeRemaining);
              }
              
              addToActivityLog('Resumed paused exam - answers restored', 'info', 'exam-resume');
            }
          } else if (submissionResponse.status !== 404) {
            // 404 is fine (no submission yet), but other errors should be logged
            console.warn('Error fetching submission:', submissionResponse.statusText);
          }
        } catch (submissionErr: any) {
          // Don't fail the exam load if submission fetch fails
          console.warn('Could not fetch paused submission:', submissionErr);
        }
        
        setError(null);
      } catch (err: any) {
        console.error('Error fetching exam details:', err);
        setError(err.message || 'Failed to load exam questions');
        setQuestions([]);
      } finally {
        setLoading(false);
      }
    };

    fetchExamDetails();
  }, [examData.examId, examData.id]);

  // Legacy proctoring log (kept for compatibility, will merge with activityLog)
  const [proctoringLog, setProctoringLog] = useState<
    Array<{
      id: number;
      timestamp: string;
      message: string;
      severity: string;
    }>
  >([]);

  // Start camera stream (automatic, cannot be disabled by student)
  const startCamera = async () => {
    try {
      // Check if camera is already active
      if (streamRef.current && cameraActive) {
        console.log('Camera already active');
        return;
      }

      // Only allow camera to start when exam is started
      if (!examStarted) {
        console.log('Camera can only start when exam is in progress');
        return;
      }

      // Clear any previous errors
      setCameraError(null);

      // Check if browser supports getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera access is not supported in this browser');
      }

      console.log('Requesting camera access...');

      // Request camera access
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user' // Front-facing camera
        },
        audio: false // No audio for now
      });

      console.log('Camera stream obtained:', stream);

      // Store stream reference
      streamRef.current = stream;

      // Attach stream to video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Set camera active immediately
        setCameraActive(true);
        setCameraError(null);
        
        // Wait for video element to be ready and play
        videoRef.current.onloadedmetadata = () => {
          console.log('Video metadata loaded');
          if (videoRef.current) {
            videoRef.current.play().catch(err => {
              console.error('Error playing video:', err);
            });
          }
        };

        // Also try to play immediately
        videoRef.current.play().catch(err => {
          console.error('Error playing video immediately:', err);
        });

        console.log('Camera started successfully, stream attached to video element');
      } else {
        console.error('Video ref is null, will retry after a short delay');
        // Retry after a short delay if video ref is not ready
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            setCameraActive(true);
            setCameraError(null);
            videoRef.current.play().catch(err => {
              console.error('Error playing video:', err);
            });
          }
        }, 100);
      }
    } catch (err: any) {
      console.error('Error accessing camera:', err);
      setCameraActive(false);
      
      // Stop any partial stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      // Handle specific error cases
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setCameraError('Camera access denied. Please enable camera permissions to continue.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError('No camera device found. Please connect a camera.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setCameraError('Camera is already in use by another application.');
      } else {
        setCameraError(err.message || 'Failed to access camera. Please check your camera settings.');
      }
    }
  };

  // Stop camera stream
  const stopCamera = () => {
    try {
      if (streamRef.current) {
        // Stop all tracks in the stream
        streamRef.current.getTracks().forEach(track => {
          track.stop();
        });
        
        // Clear stream reference
        streamRef.current = null;

        // Clear video element
        if (videoRef.current) {
          videoRef.current.srcObject = null;
        }

        setCameraActive(false);
        setCameraError(null);
        console.log('Camera stopped successfully');
      }
    } catch (err) {
      console.error('Error stopping camera:', err);
    }
  };

  // Initialize camera when exam starts - only if camera monitoring is enabled
  useEffect(() => {
    if (examStarted && enableCameraMonitoring) {
      // Start camera automatically when exam begins (only if monitoring is enabled)
      if (!cameraActive && !streamRef.current) {
        console.log('Exam started, initializing camera automatically...');
        startCamera();
      }
    } else {
      // Stop camera if exam is not started or monitoring is disabled
      if (streamRef.current) {
        console.log('Exam not started or camera monitoring disabled, stopping camera...');
        stopCamera();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examStarted, enableCameraMonitoring]);

  // Cleanup camera when component unmounts
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        stopCamera();
      }
      // Clear face detection interval
      if (faceDetectionIntervalRef.current) {
        clearInterval(faceDetectionIntervalRef.current);
      }
      
      // Dispose models
      if (faceDetectionModel) {
        faceDetectionModel.dispose?.();
      }
      
      // Dispose FaceMesh model
      if (faceMeshModel) {
        faceMeshModel.close();
      }
      
      // Clean up canvas
      if (canvasRef.current) {
        canvasRef.current = null;
      }
    };
  }, []);

  // Load MediaPipe FaceMesh model when exam starts - only if camera monitoring is enabled
  useEffect(() => {
    if (enableCameraMonitoring && examStarted && !faceMeshModel && !faceDetectionModel && !isModelLoading) {
      loadFaceMeshModel();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableCameraMonitoring, examStarted]);

  // Load MediaPipe FaceMesh model (preferred) with fallback to BlazeFace
  const loadFaceMeshModel = async () => {
    try {
      setIsModelLoading(true);
      console.log('Loading MediaPipe FaceMesh model...');
      
      const faceMesh = new FaceMesh({
        locateFile: (file: string) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
        },
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
        maxNumFaces: 2, // Enable multi-face detection (up to 2 faces)
      });

      await faceMesh.setOptions({
        refineLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5,
        maxNumFaces: 2, // Enable multi-face detection (up to 2 faces)
      });

      setFaceMeshModel(faceMesh);
      console.log('MediaPipe FaceMesh model loaded successfully');
      addToActivityLog('Advanced 3D face detection model loaded', 'success', 'model-loaded');
      setIsModelLoading(false);
    } catch (err: any) {
      console.error('Error loading MediaPipe FaceMesh model:', err);
      // Fallback to BlazeFace
      console.log('Falling back to BlazeFace model...');
      await loadFaceDetectionModel();
    }
  };

  // Load BlazeFace model (fallback)
  const loadFaceDetectionModel = async () => {
    try {
      setIsModelLoading(true);
      console.log('Loading BlazeFace model...');
      const blazefaceModel = await blazeface.load();
      setFaceDetectionModel(blazefaceModel);
      console.log('BlazeFace model loaded successfully');
      addToActivityLog('Face detection model loaded (fallback)', 'success', 'model-loaded');
      setIsModelLoading(false);
    } catch (err: any) {
      console.error('Error loading BlazeFace model:', err);
      setIsModelLoading(false);
      addToActivityLog(`Failed to load face detection model: ${err.message || 'Unknown error'}`, 'error', 'model-error');
    }
  };

  // Add entry to activity log
  const addToActivityLog = (
    message: string,
    severity: "success" | "warning" | "error" | "info",
    type?: string
  ) => {
    const newLog = {
      id: Date.now(),
      timestamp: new Date().toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
      message,
      severity,
      type,
    };
    
    setActivityLog((prev) => [...prev, newLog].slice(-50)); // Keep last 50 entries
    
    // Also update legacy proctoringLog for compatibility
    setProctoringLog((prev) => [
      ...prev,
      {
        id: newLog.id,
        timestamp: newLog.timestamp,
        message: newLog.message,
        severity: newLog.severity,
      },
    ].slice(-50));

    // Auto-scroll to bottom
    setTimeout(() => {
      if (logContainerRef.current) {
        logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
      }
    }, 100);
  };

  // Send flag to backend
  const sendFlagToBackend = async (
    type: string,
    message: string,
    countAsViolation: boolean = true
  ) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No authentication token found');
        return;
      }

      const examId = examData.examId || examData.id;
      if (!examId) {
        console.error('No exam ID found');
        return;
      }

      // Get student ID from token or user profile
      const userProfileResponse = await fetch('http://localhost:3000/api/v1/auth/me', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!userProfileResponse.ok) {
        console.error('Failed to fetch user profile');
        return;
      }

      const userProfile = await userProfileResponse.json();
      const studentId = userProfile._id;

      const flagData = {
        examId: examId.toString(),
        studentId: studentId,
        type: type,
        timestamp: new Date().toISOString(),
        message: message,
        countAsViolation: countAsViolation, // Indicate if this should count toward violation limit
      };

      // Send to backend
      const response = await axios.post("http://localhost:3000/api/v1/proctor/flag", flagData, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      console.log('Flag sent to backend:', flagData);
      
      // Check response for flag count and auto-submit status
      if (response.data) {
        const { totalFlags, maxAllowedViolations: maxFlags, autoSubmitted, shouldAutoSubmit } = response.data;
        
        // Update violation count (only count error/warning flags, not info flags)
        // New 3D head pose flag types with persistence checking
        const isErrorFlag = type.includes('face-missing') || 
                           type.includes('multiple-faces') || 
                           type.includes('tab-switch') ||
                           type.includes('switch') ||
                           type.includes('head-turn-left') ||
                           type.includes('head-turn-right') ||
                           type.includes('look-up') ||
                           type.includes('look-down') ||
                           type.includes('head-tilt') ||
                           type.includes('gaze-left') ||
                           type.includes('gaze-right') ||
                           type.includes('looking-away') ||
                           type.includes('fullscreen-exit') ||
                           type.includes('devtools-access') ||
                           type.includes('console-access') ||
                           type.includes('inspect-access') ||
                           type.includes('view-source');
        
        // Only count as violation if countAsViolation is true AND it's an error flag type
        if (isErrorFlag && countAsViolation && totalFlags !== undefined) {
          setTotalViolationFlags(totalFlags);
          
          // Show warning when approaching limit (at 80% of limit)
          const warningThreshold = Math.max(1, Math.floor(maxFlags * 0.8));
          if (totalFlags >= warningThreshold && totalFlags < maxFlags && !violationWarningShown) {
            const warningMessage = enableAutoSubmission
              ? `Warning: You have ${totalFlags} violation(s). Maximum allowed: ${maxFlags}. Exam will be auto-submitted if limit is exceeded.`
              : `Warning: You have ${totalFlags} violation(s). Maximum allowed: ${maxFlags}. Auto-submission is disabled, but violations are being recorded.`;
            addToActivityLog(
              warningMessage,
              'warning',
              'violation-warning'
            );
            setViolationWarningShown(true);
          }
          
          // Show critical warning at limit (only once)
          if (totalFlags >= maxFlags && !examAutoSubmitted && !maxViolationMessageShownRef.current) {
            maxViolationMessageShownRef.current = true; // Mark as shown
            if (enableAutoSubmission) {
              addToActivityLog(
                `Critical: You have reached the maximum allowed violations (${totalFlags}/${maxFlags}). Exam will be auto-submitted.`,
                'error',
                'violation-critical'
              );
            } else {
              addToActivityLog(
                `Critical: You have reached the maximum allowed violations (${totalFlags}/${maxFlags}). Auto-submission is disabled.`,
                'error',
                'violation-critical'
              );
            }
          }
          
          // Auto-submit if limit exceeded (only if auto-submission is enabled)
          if (enableAutoSubmission && (autoSubmitted || shouldAutoSubmit || totalFlags > maxFlags)) {
            if (!examAutoSubmitted) {
              setExamAutoSubmitted(true);
              addToActivityLog(
                `Exam auto-submitted due to exceeding maximum allowed violations (${totalFlags}/${maxFlags}).`,
                'error',
                'auto-submit'
              );
              
              // Auto-submit the exam
              setTimeout(() => {
                handleAutoSubmit();
              }, 2000); // Wait 2 seconds to show the message
            }
          } else if (!enableAutoSubmission && totalFlags >= maxFlags) {
            // If auto-submission is disabled, message already shown above (only once)
            // No need to show it again
          }
        }
      }
    } catch (err) {
      console.error('Error sending flag to backend:', err);
      // Don't show error to user, just log it
    }
  };

  // Initialize Kalman filters for smoothing head pose
  const initializeKalmanFilters = () => {
    if (!kalmanYawRef.current) {
      kalmanYawRef.current = new KalmanFilter({ R: 0.1, Q: 0.5 }); // Better smoothing parameters
    }
    if (!kalmanPitchRef.current) {
      kalmanPitchRef.current = new KalmanFilter({ R: 0.1, Q: 0.5 });
    }
    if (!kalmanRollRef.current) {
      kalmanRollRef.current = new KalmanFilter({ R: 0.1, Q: 0.5 });
    }
  };

  // 3D Face Model - Standard face proportions in 3D space (normalized)
  // Based on MediaPipe FaceMesh landmark indices and average human face measurements
  // Coordinates are in meters, centered at origin
  const get3DFaceModel = () => {
    // Create a 3D face model based on average human proportions
    const faceWidth = 0.12; // Average face width ~12cm
    const faceHeight = 0.15; // Average face height ~15cm
    const eyeDepth = 0.02; // Eyes are ~2cm deep
    const faceDepth = 0.03; // Nose depth ~3cm
    
    // MediaPipe FaceMesh landmark indices:
    // 1: Nose tip
    // 33: Left eye outer corner
    // 263: Right eye outer corner
    // 61: Left mouth corner
    // 291: Right mouth corner
    // 152: Chin
    
    return {
      // MediaPipe landmark indices
      noseTip: [0, faceHeight * 0.05, faceDepth], // Index 1
      chin: [0, faceHeight * 0.50, faceDepth * 0.3], // Index 152
      leftEyeOuter: [-faceWidth / 2, -faceHeight * 0.15, -eyeDepth], // Index 33
      rightEyeOuter: [faceWidth / 2, -faceHeight * 0.15, -eyeDepth], // Index 263
      leftMouthCorner: [-faceWidth * 0.25, faceHeight * 0.35, faceDepth * 0.5], // Index 61
      rightMouthCorner: [faceWidth * 0.25, faceHeight * 0.35, faceDepth * 0.5], // Index 291
    };
  };

  // Extract MediaPipe FaceMesh landmarks
  const extractMediaPipeLandmarks = (results: any, videoWidth: number, videoHeight: number) => {
    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
      return null;
    }

    const landmarks = results.multiFaceLandmarks[0]; // Get first face
    if (!landmarks || landmarks.length < 468) {
      return null; // MediaPipe FaceMesh has 468 landmarks
    }

    // Extract specific landmarks as per requirements
    // MediaPipe landmarks are in normalized coordinates [0, 1]
    const noseTip = landmarks[1]; // Index 1
    const chin = landmarks[152]; // Index 152
    const leftEyeOuter = landmarks[33]; // Index 33
    const rightEyeOuter = landmarks[263]; // Index 263
    const leftMouthCorner = landmarks[61]; // Index 61
    const rightMouthCorner = landmarks[291]; // Index 291

    // Convert to pixel coordinates
    return {
      noseTip: [noseTip.x * videoWidth, noseTip.y * videoHeight, noseTip.z * videoWidth], // z is depth
      chin: [chin.x * videoWidth, chin.y * videoHeight, chin.z * videoWidth],
      leftEyeOuter: [leftEyeOuter.x * videoWidth, leftEyeOuter.y * videoHeight, leftEyeOuter.z * videoWidth],
      rightEyeOuter: [rightEyeOuter.x * videoWidth, rightEyeOuter.y * videoHeight, rightEyeOuter.z * videoWidth],
      leftMouthCorner: [leftMouthCorner.x * videoWidth, leftMouthCorner.y * videoHeight, leftMouthCorner.z * videoWidth],
      rightMouthCorner: [rightMouthCorner.x * videoWidth, rightMouthCorner.y * videoHeight, rightMouthCorner.z * videoWidth],
    };
  };

  // Simplified PnP solver using Direct Linear Transform (DLT)
  // This estimates the rotation matrix from 3D model points to 2D image points
  const solvePnP = (
    modelPoints: number[][],
    imagePoints: number[][],
    focalLength: number,
    principalPoint: [number, number]
  ): { rotation: number[][], translation: number[] } | null => {
    try {
      // Camera intrinsic matrix (simplified)
      const fx = focalLength;
      const fy = focalLength;
      const cx = principalPoint[0];
      const cy = principalPoint[1];

      // Build system of equations for DLT
      // For each point pair: [u, v] = K * [R|t] * [X, Y, Z, 1]
      // We solve for rotation and translation using SVD
      
      // Simplified approach: use geometric relationship between 3D and 2D points
      // Calculate scale factor from known distances
      const eyeDistance3D = Math.sqrt(
        Math.pow(modelPoints[0][0] - modelPoints[1][0], 2) +
        Math.pow(modelPoints[0][1] - modelPoints[1][1], 2) +
        Math.pow(modelPoints[0][2] - modelPoints[1][2], 2)
      );
      
      const eyeDistance2D = Math.sqrt(
        Math.pow(imagePoints[0][0] - imagePoints[1][0], 2) +
        Math.pow(imagePoints[0][1] - imagePoints[1][1], 2)
      );

      if (eyeDistance2D < 1) return null;

      // Estimate depth from face size
      const estimatedDepth = (fx * eyeDistance3D) / eyeDistance2D;

      // Calculate face center in 3D and 2D
      const faceCenter3D = [
        (modelPoints[0][0] + modelPoints[1][0] + modelPoints[2][0]) / 3,
        (modelPoints[0][1] + modelPoints[1][1] + modelPoints[2][1]) / 3,
        (modelPoints[0][2] + modelPoints[1][2] + modelPoints[2][2]) / 3,
      ];
      
      const faceCenter2D = [
        (imagePoints[0][0] + imagePoints[1][0] + imagePoints[2][0]) / 3,
        (imagePoints[0][1] + imagePoints[1][1] + imagePoints[2][1]) / 3,
      ];

      // Estimate translation
      const tx = (faceCenter2D[0] - cx) * estimatedDepth / fx;
      const ty = (faceCenter2D[1] - cy) * estimatedDepth / fy;
      const tz = estimatedDepth;

      // Calculate rotation angles from landmark positions
      // Use eye line and nose position to estimate yaw, pitch, roll
      const eyeLine2D = [
        imagePoints[1][0] - imagePoints[0][0],
        imagePoints[1][1] - imagePoints[0][1],
      ];
      
      const eyeLine3D = [
        modelPoints[1][0] - modelPoints[0][0],
        modelPoints[1][1] - modelPoints[0][1],
        modelPoints[1][2] - modelPoints[0][2],
      ];

      // Calculate roll from eye line (clamp to reasonable range)
      const rollRaw = Math.atan2(eyeLine2D[1], eyeLine2D[0]) * 180 / Math.PI;
      const roll = Math.max(-60, Math.min(60, rollRaw)); // Clamp roll to ±60 degrees (increased from ±45)

      // Calculate yaw from horizontal asymmetry
      const eyeCenter2D = [
        (imagePoints[0][0] + imagePoints[1][0]) / 2,
        (imagePoints[0][1] + imagePoints[1][1]) / 2,
      ];
      const nose2D = imagePoints[2];
      const horizontalOffset = nose2D[0] - eyeCenter2D[0];
      const normalizedOffset = Math.max(-1, Math.min(1, horizontalOffset / eyeDistance2D)); // Clamp to [-1, 1]
      const yaw = Math.asin(normalizedOffset * 0.3) * 180 / Math.PI; // Reduced scale factor from 0.5 to 0.3

      // Calculate pitch from vertical position
      const eyeCenterY = eyeCenter2D[1];
      const noseY = nose2D[1];
      const verticalOffset = noseY - eyeCenterY;
      const normalizedVerticalOffset = Math.max(-1, Math.min(1, verticalOffset / eyeDistance2D)); // Clamp to [-1, 1]
      const pitch = Math.asin(normalizedVerticalOffset * 0.3) * 180 / Math.PI; // Reduced scale factor from 0.6 to 0.3

      // Convert Euler angles to rotation matrix
      const yawRad = yaw * Math.PI / 180;
      const pitchRad = pitch * Math.PI / 180;
      const rollRad = roll * Math.PI / 180;

      const cosY = Math.cos(yawRad);
      const sinY = Math.sin(yawRad);
      const cosP = Math.cos(pitchRad);
      const sinP = Math.sin(pitchRad);
      const cosR = Math.cos(rollRad);
      const sinR = Math.sin(rollRad);

      const rotation = [
        [cosY * cosP, cosY * sinP * sinR - sinY * cosR, cosY * sinP * cosR + sinY * sinR],
        [sinY * cosP, sinY * sinP * sinR + cosY * cosR, sinY * sinP * cosR - cosY * sinR],
        [-sinP, cosP * sinR, cosP * cosR],
      ];

      return {
        rotation,
        translation: [tx, ty, tz],
      };
    } catch (err) {
      console.error('Error in PnP solver:', err);
      return null;
    }
  };

  // Convert rotation matrix to Euler angles (yaw, pitch, roll)
  const rotationMatrixToEuler = (rotation: number[][]): { yaw: number, pitch: number, roll: number } => {
    const r11 = rotation[0][0];
    const r21 = rotation[1][0];
    const r31 = rotation[2][0];
    const r32 = rotation[2][1];
    const r33 = rotation[2][2];

    const yaw = Math.atan2(r21, r11) * 180 / Math.PI;
    const pitch = Math.atan2(-r31, Math.sqrt(r32 * r32 + r33 * r33)) * 180 / Math.PI;
    const roll = Math.atan2(r32, r33) * 180 / Math.PI;

    return { yaw, pitch, roll };
  };

  // Advanced 3D Head Pose Estimation using PnP solver with MediaPipe FaceMesh landmarks
  const calculateHeadPose3D = (landmarks: any, videoWidth: number, videoHeight: number) => {
    if (!landmarks || !videoWidth || !videoHeight) {
      return null;
    }

    try {
      // Get 3D face model
      const model3D = get3DFaceModel();
      
      // Use MediaPipe landmarks: nose tip, chin, eye corners, mouth corners
      const modelPoints = [
        model3D.noseTip,        // Index 1
        model3D.chin,           // Index 152
        model3D.leftEyeOuter,   // Index 33
        model3D.rightEyeOuter,  // Index 263
        model3D.leftMouthCorner,   // Index 61
        model3D.rightMouthCorner,  // Index 291
      ];
      
      const imagePoints = [
        [landmarks.noseTip[0], landmarks.noseTip[1]],
        [landmarks.chin[0], landmarks.chin[1]],
        [landmarks.leftEyeOuter[0], landmarks.leftEyeOuter[1]],
        [landmarks.rightEyeOuter[0], landmarks.rightEyeOuter[1]],
        [landmarks.leftMouthCorner[0], landmarks.leftMouthCorner[1]],
        [landmarks.rightMouthCorner[0], landmarks.rightMouthCorner[1]],
      ];
      
      // Calculate face size ratio for validation
      const eyeDistance = Math.sqrt(
        Math.pow(landmarks.rightEyeOuter[0] - landmarks.leftEyeOuter[0], 2) +
        Math.pow(landmarks.rightEyeOuter[1] - landmarks.leftEyeOuter[1], 2)
      );
      const faceSizeRatio = (eyeDistance * eyeDistance) / (videoWidth * videoHeight);
      
      // Camera parameters (estimated)
      const focalLength = videoWidth; // Approximate focal length
      const principalPoint: [number, number] = [videoWidth / 2, videoHeight / 2];
      
      // Solve PnP
      const result = solvePnP(modelPoints, imagePoints, focalLength, principalPoint);
      
      if (!result) {
        return null;
      }
      
      // Convert rotation matrix to Euler angles
      const { yaw, pitch, roll } = rotationMatrixToEuler(result.rotation);
      
      // Clamp raw values to reasonable ranges before filtering
      const clampedYaw = Math.max(-70, Math.min(70, yaw));
      const clampedPitch = Math.max(-60, Math.min(60, pitch));
      const clampedRoll = Math.max(-60, Math.min(60, roll)); // Increased from ±45 to ±60
      
      // Apply Kalman filtering for smoothing
      initializeKalmanFilters();
      
      const smoothedYaw = kalmanYawRef.current!.filter(clampedYaw);
      const smoothedPitch = kalmanPitchRef.current!.filter(clampedPitch);
      const smoothedRoll = kalmanRollRef.current!.filter(clampedRoll);
      
      // Final clamping after smoothing to ensure values stay within reasonable ranges
      const finalYaw = Math.max(-60, Math.min(60, smoothedYaw));
      const finalPitch = Math.max(-50, Math.min(50, smoothedPitch));
      const finalRoll = Math.max(-60, Math.min(60, smoothedRoll)); // Increased from ±40 to ±60
      
      // Calculate gaze direction from eye center position
      const eyeCenterX = (landmarks.rightEyeOuter[0] + landmarks.leftEyeOuter[0]) / 2;
      const eyeCenterY = (landmarks.rightEyeOuter[1] + landmarks.leftEyeOuter[1]) / 2;
      const normalizedEyeCenterX = eyeCenterX / videoWidth;
      const gazeRatio = Math.max(0, Math.min(1, normalizedEyeCenterX));
      
      return {
        yaw: finalYaw,
        pitch: finalPitch,
        roll: finalRoll,
        gazeRatio,
        faceSizeRatio,
        raw: { yaw, pitch, roll }, // Keep raw values for debugging
      };
    } catch (err) {
      console.error('Error calculating 3D head pose:', err);
      return null;
    }
  };

  // Improved head pose estimation using geometric calculations
  // This method uses facial landmarks to estimate 3D head pose more accurately
  const calculateHeadPose = (prediction: any, videoWidth: number, videoHeight: number) => {
    if (!prediction || !videoWidth || !videoHeight) {
      return null;
    }

    try {
      // Get bounding box
      const topLeft = prediction.topLeft;
      const bottomRight = prediction.bottomRight;
      
      if (!topLeft || !bottomRight) {
        return null;
      }
      
      // Convert normalized coordinates to pixel coordinates
      const topLeftX = topLeft[0] * videoWidth;
      const topLeftY = topLeft[1] * videoHeight;
      const bottomRightX = bottomRight[0] * videoWidth;
      const bottomRightY = bottomRight[1] * videoHeight;
      
      const faceWidth = bottomRightX - topLeftX;
      const faceHeight = bottomRightY - topLeftY;
      const faceSizeRatio = (faceWidth * faceHeight) / (videoWidth * videoHeight);
      
      // Check if landmarks are available
      const landmarks = prediction.landmarks;
      if (!landmarks || landmarks.length < 6) {
        // Fallback to bounding box method
        const centerX = (topLeftX + bottomRightX) / 2;
        const centerY = (topLeftY + bottomRightY) / 2;
        const normalizedX = centerX / videoWidth;
        const normalizedY = centerY / videoHeight;
        const xDeviation = normalizedX - 0.5;
        const yDeviation = normalizedY - 0.5;
        
        return {
          yaw: xDeviation * 25,
          pitch: yDeviation * 25,
          gazeRatio: 0.5 + (xDeviation * 0.3),
          faceSizeRatio
        };
      }
      
      // BlazeFace landmarks: [rightEye, leftEye, nose, mouth, rightMouthCorner, leftMouthCorner]
      // Landmarks are already converted to pixel coordinates in detectFaces
      const rightEye = landmarks[0];
      const leftEye = landmarks[1];
      const noseTip = landmarks[2];
      const mouthCenter = landmarks[3];
      
      // Use landmarks directly (already in pixel coordinates)
      const rightEyeX = rightEye[0];
      const rightEyeY = rightEye[1];
      const leftEyeX = leftEye[0];
      const leftEyeY = leftEye[1];
      const noseTipX = noseTip[0];
      const noseTipY = noseTip[1];
      const mouthCenterX = mouthCenter[0];
      const mouthCenterY = mouthCenter[1];
      
      // Calculate key distances and points
      const eyeCenterX = (rightEyeX + leftEyeX) / 2;
      const eyeCenterY = (rightEyeY + leftEyeY) / 2;
      
      // Eye distance (interpupillary distance)
      const eyeDistance = Math.sqrt(
        Math.pow(rightEyeX - leftEyeX, 2) + 
        Math.pow(rightEyeY - leftEyeY, 2)
      );
      
      if (eyeDistance < 10) {
        return null; // Invalid face detection
      }
      
      // Face center (between eyes and mouth)
      const faceCenterX = (eyeCenterX + mouthCenterX) / 2;
      const faceCenterY = (eyeCenterY + mouthCenterY) / 2;
      
      // Calculate YAW (left/right rotation) using geometric method
      // Method: Compare the horizontal distance from face center to screen center
      // and use eye asymmetry to refine the estimate
      const screenCenterX = videoWidth / 2;
      const faceOffsetX = faceCenterX - screenCenterX;
      
      // Normalize by face width for more accurate measurement
      const normalizedOffsetX = faceOffsetX / faceWidth;
      
      // Calculate eye asymmetry (when head turns, one eye appears closer to center)
      const eyeCenterOffsetX = eyeCenterX - screenCenterX;
      const normalizedEyeOffsetX = eyeCenterOffsetX / faceWidth;
      
      // Combine both measurements for more accurate yaw
      // Use weighted average: 70% face position, 30% eye asymmetry
      const yawRaw = (normalizedOffsetX * 0.7 + normalizedEyeOffsetX * 0.3);
      
      // Convert to degrees using a calibrated scale
      // Average human head can turn about 70 degrees, but we use a conservative scale
      const yaw = yawRaw * 35; // Scale factor calibrated for reasonable angles
      
      // Calculate PITCH (up/down rotation) using vertical geometry
      const screenCenterY = videoHeight / 2;
      const faceOffsetY = faceCenterY - screenCenterY;
      const normalizedOffsetY = faceOffsetY / faceHeight;
      
      // Use eye-nose-mouth triangle for more accurate pitch
      // When looking up, nose moves up relative to eyes; when down, nose moves down
      const eyeNoseDistanceY = noseTipY - eyeCenterY;
      const eyeMouthDistanceY = mouthCenterY - eyeCenterY;
      
      // Expected distances when looking straight (calibrated)
      const expectedEyeNoseDistance = eyeDistance * 0.6;
      const expectedEyeMouthDistance = eyeDistance * 1.2;
      
      // Calculate pitch from geometric relationships
      const nosePitchFactor = (eyeNoseDistanceY - expectedEyeNoseDistance) / eyeDistance;
      const mouthPitchFactor = (eyeMouthDistanceY - expectedEyeMouthDistance) / eyeDistance;
      
      // Combine measurements
      const pitchRaw = normalizedOffsetY * 0.6 + (nosePitchFactor + mouthPitchFactor) * 0.2;
      const pitch = pitchRaw * 30; // Scale to degrees
      
      // Calculate GAZE direction (where eyes are looking)
      // Use eye center position relative to screen
      const normalizedEyeCenterX = eyeCenterX / videoWidth;
      const gazeRatio = Math.max(0, Math.min(1, normalizedEyeCenterX));
      
      // Clamp angles to reasonable ranges
      const yawClamped = Math.max(-60, Math.min(60, yaw));
      const pitchClamped = Math.max(-50, Math.min(50, pitch));
      
      return {
        yaw: yawClamped,
        pitch: pitchClamped,
        gazeRatio,
        faceSizeRatio,
        eyeDistance
      };
    } catch (err) {
      console.error('Error calculating head pose:', err);
      return null;
    }
  };

  // Detect faces using MediaPipe FaceMesh (preferred) or BlazeFace (fallback)
  const detectFaces = async () => {
    if ((!faceMeshModel && !faceDetectionModel) || !videoRef.current || !examStarted) {
      return;
    }

    try {
      const video = videoRef.current;
      if (video.readyState !== video.HAVE_ENOUGH_DATA) {
        return;
      }

      const videoWidth = video.videoWidth || 640;
      const videoHeight = video.videoHeight || 480;
      
      // Use MediaPipe FaceMesh if available (preferred)
      if (faceMeshModel) {
        return new Promise<void>((resolve) => {
          faceMeshModel.onResults(async (results: any) => {
            if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
              // No face detected
              if (lastFlagType !== 'face-missing') {
                addToActivityLog('Face not detected', 'error', 'face-missing');
                sendFlagToBackend('face-missing', 'Face not detected');
                setLastFlagType('face-missing');
              }
              setGazeAwayCount(0);
              resolve();
              return;
            }

            // Check for multiple faces - MediaPipe returns multiFaceLandmarks array
            const faceCount = results.multiFaceLandmarks ? results.multiFaceLandmarks.length : 0;
            console.log(`MediaPipe FaceMesh detected ${faceCount} face(s)`, results.multiFaceLandmarks);
            
            if (faceCount > 1) {
              // Multiple faces detected
              console.log(`Multiple faces detected: ${faceCount} faces`);
              
              if (lastFlagType !== 'multiple-faces') {
                addToActivityLog(`Multiple faces detected (${faceCount})`, 'warning', 'multiple-faces');
                await sendFlagToBackend('multiple-faces', `Multiple faces detected (${faceCount})`, true);
                setLastFlagType('multiple-faces');
              }
              setGazeAwayCount(0);
              resolve();
              return;
            }

            // Extract MediaPipe landmarks
            const extractedLandmarks = extractMediaPipeLandmarks(results, videoWidth, videoHeight);
            
            if (!extractedLandmarks) {
              resolve();
              return;
            }

            // Use advanced 3D head pose estimation with MediaPipe landmarks
            const headPose = calculateHeadPose3D(extractedLandmarks, videoWidth, videoHeight);
            
            if (headPose) {
              await processHeadPose(headPose, videoWidth, videoHeight);
            }
            
            resolve();
          });

          // Process video frame
          faceMeshModel.send({ image: video });
        });
      } 
      // Fallback to BlazeFace
      else if (faceDetectionModel) {
        // Use BlazeFace for face detection with landmarks
        const predictions = await faceDetectionModel.estimateFaces(video, false);
        
        if (predictions.length === 0) {
          // No face detected
          if (lastFlagType !== 'face-missing') {
            addToActivityLog('Face not detected', 'error', 'face-missing');
            await sendFlagToBackend('face-missing', 'Face not detected');
            setLastFlagType('face-missing');
          }
          setGazeAwayCount(0);
          return;
        } else if (predictions.length > 1) {
          // Multiple faces detected
          const faceCount = predictions.length;
          console.log(`Multiple faces detected (BlazeFace): ${faceCount} faces`);
          
          if (lastFlagType !== 'multiple-faces') {
            addToActivityLog(`Multiple faces detected (${faceCount})`, 'warning', 'multiple-faces');
            await sendFlagToBackend('multiple-faces', `Multiple faces detected (${faceCount})`, true);
            setLastFlagType('multiple-faces');
          }
          setGazeAwayCount(0);
          return;
        }

        // One face detected - estimate head pose from landmarks
        const prediction = predictions[0];
        
        // BlazeFace returns normalized coordinates, need to convert to pixel coordinates
        if (prediction.landmarks && Array.isArray(prediction.landmarks) && prediction.landmarks.length >= 6) {
          // Convert normalized landmarks to pixel coordinates
          const landmarks = prediction.landmarks.map((landmark: number[]) => {
            if (Array.isArray(landmark) && landmark.length >= 2) {
              return [
                landmark[0] * videoWidth,
                landmark[1] * videoHeight
              ];
            }
            return landmark;
          });
          
          // Create landmarks object compatible with MediaPipe format
          const extractedLandmarks = {
            noseTip: [landmarks[2][0], landmarks[2][1], 0], // Nose tip from BlazeFace
            chin: [landmarks[3][0], landmarks[3][1], 0], // Mouth center as chin approximation
            leftEyeOuter: [landmarks[1][0], landmarks[1][1], 0], // Left eye
            rightEyeOuter: [landmarks[0][0], landmarks[0][1], 0], // Right eye
            leftMouthCorner: [landmarks[5][0], landmarks[5][1], 0], // Left mouth corner
            rightMouthCorner: [landmarks[4][0], landmarks[4][1], 0], // Right mouth corner
          };
          
          // Use advanced 3D head pose estimation
          const headPose = calculateHeadPose3D(extractedLandmarks, videoWidth, videoHeight);
        
          if (headPose) {
            await processHeadPose(headPose, videoWidth, videoHeight);
          }
        } else {
          // Fallback to basic face detection if head pose calculation fails
          if (lastFlagType !== 'face-detected') {
            addToActivityLog('Face detected successfully', 'success', 'face-detected');
            setLastFlagType('face-detected');
          }
        }
      }
    } catch (err) {
      console.error('Error detecting faces:', err);
    }
  };

  // Process head pose results (common function for both MediaPipe and BlazeFace)
  const processHeadPose = async (headPose: any, videoWidth: number, videoHeight: number) => {
    let { yaw, pitch, roll, gazeRatio, faceSizeRatio } = headPose;
    
    // Ensure values are within reasonable ranges (defensive clamping)
    yaw = Math.max(-60, Math.min(60, yaw));
    pitch = Math.max(-50, Math.min(50, pitch));
    roll = Math.max(-60, Math.min(60, roll)); // Increased from ±40 to ±60
    
    // Update current head pose state for UI display
    setCurrentHeadPose({ yaw, pitch, roll });
    
    // Determine gaze direction for UI
    if (gazeRatio < 0.3) {
      setCurrentGaze('Left');
    } else if (gazeRatio > 0.7) {
      setCurrentGaze('Right');
    } else {
      setCurrentGaze('Center');
    }
    
    // Check if pose changed significantly (>10° delta) to reduce noise
    const lastPose = lastPoseRef.current;
    const poseChanged = !lastPose || 
      Math.abs(yaw - lastPose.yaw) > 10 || 
      Math.abs(pitch - lastPose.pitch) > 10 || 
      Math.abs(roll - lastPose.roll) > 10;
    
    if (poseChanged) {
      lastPoseRef.current = { yaw, pitch, roll };
    }
    
    // Thresholds for flagging (as per requirements)
    const YAW_THRESHOLD = 35; // degrees
    const PITCH_THRESHOLD = 25; // degrees
    const ROLL_THRESHOLD = 20; // degrees
    const PERSISTENCE_TIME = 1500; // 1.5 seconds
    
    const currentTime = Date.now();
    
    // Check YAW (left/right rotation)
    const yawViolation = Math.abs(yaw) > YAW_THRESHOLD;
    if (yawViolation) {
      if (violationStartTimeRef.current.yaw === null) {
        violationStartTimeRef.current.yaw = currentTime;
      } else if (currentTime - violationStartTimeRef.current.yaw >= PERSISTENCE_TIME) {
        // Violation persisted for >1.5 seconds, raise flag
        const direction = yaw > 0 ? 'right' : 'left';
        const flagType = `head-turn-${direction}`;
        
        if (lastFlagType !== flagType) {
          addToActivityLog(
            `Head turned ${direction} (${Math.abs(yaw).toFixed(1)}°) for >1.5s`,
            'warning',
            flagType
          );
          await sendFlagToBackend(
            flagType,
            `Head turned ${direction} (${Math.abs(yaw).toFixed(1)}°)`,
            true
          );
          setLastFlagType(flagType);
        }
      }
    } else {
      violationStartTimeRef.current.yaw = null;
    }
    
    // Check PITCH (up/down rotation)
    const pitchViolation = Math.abs(pitch) > PITCH_THRESHOLD;
    if (pitchViolation) {
      if (violationStartTimeRef.current.pitch === null) {
        violationStartTimeRef.current.pitch = currentTime;
      } else if (currentTime - violationStartTimeRef.current.pitch >= PERSISTENCE_TIME) {
        // Violation persisted for >1.5 seconds, raise flag
        const direction = pitch > 0 ? 'down' : 'up';
        const flagType = `look-${direction}`;
        
        if (lastFlagType !== flagType) {
          addToActivityLog(
            `Looking ${direction} (${Math.abs(pitch).toFixed(1)}°) for >1.5s`,
            'warning',
            flagType
          );
          await sendFlagToBackend(
            flagType,
            `Looking ${direction} (${Math.abs(pitch).toFixed(1)}°)`,
            true
          );
          setLastFlagType(flagType);
        }
      }
    } else {
      violationStartTimeRef.current.pitch = null;
    }
    
    // Check ROLL (side tilt)
    const rollViolation = Math.abs(roll) > ROLL_THRESHOLD;
    if (rollViolation) {
      if (violationStartTimeRef.current.roll === null) {
        violationStartTimeRef.current.roll = currentTime;
      } else if (currentTime - violationStartTimeRef.current.roll >= PERSISTENCE_TIME) {
        // Violation persisted for >1.5 seconds, raise flag
        const flagType = 'head-tilt';
        
        if (lastFlagType !== flagType) {
          addToActivityLog(
            `Head tilted sideways (${Math.abs(roll).toFixed(1)}°) for >1.5s`,
            'warning',
            flagType
          );
          await sendFlagToBackend(
            flagType,
            `Head tilted (${Math.abs(roll).toFixed(1)}°)`,
            true
          );
          setLastFlagType(flagType);
        }
      }
    } else {
      violationStartTimeRef.current.roll = null;
    }
    
    // Check if face is too small (might indicate looking away)
    if (faceSizeRatio < 0.05) {
      setGazeAwayCount(prev => {
        const newCount = prev + 1;
        if (newCount >= 3 && lastFlagType !== 'looking-away') {
          addToActivityLog('Face appears too small (possibly looking away)', 'warning', 'looking-away');
          sendFlagToBackend('looking-away', 'Face appears too small (possibly looking away)');
          setLastFlagType('looking-away');
        }
        return newCount;
      });
    } else {
      // Reset gaze away count if face size is normal
      setGazeAwayCount(0);
    }
    
    // Enhanced gaze estimation - check if gaze is away from center
    const GAZE_THRESHOLD = 0.35; // Threshold for gaze detection
    if (gazeRatio < GAZE_THRESHOLD) {
      // Looking left - track persistence
      setGazeAwayCount(prev => {
        const newCount = prev + 1;
        if (newCount >= 3 && lastFlagType !== 'gaze-left') {
          addToActivityLog('Gaze looking left (away from screen)', 'warning', 'gaze-left');
          sendFlagToBackend('gaze-left', 'Gaze looking left (away from screen)', true);
          setLastFlagType('gaze-left');
        }
        return newCount;
      });
    } else if (gazeRatio > (1 - GAZE_THRESHOLD)) {
      // Looking right - track persistence
      setGazeAwayCount(prev => {
        const newCount = prev + 1;
        if (newCount >= 3 && lastFlagType !== 'gaze-right') {
          addToActivityLog('Gaze looking right (away from screen)', 'warning', 'gaze-right');
          sendFlagToBackend('gaze-right', 'Gaze looking right (away from screen)', true);
          setLastFlagType('gaze-right');
        }
        return newCount;
      });
    } else {
      // Looking forward (normal)
      setGazeAwayCount(0);
      if (Math.abs(yaw) <= YAW_THRESHOLD && 
          Math.abs(pitch) <= PITCH_THRESHOLD && 
          Math.abs(roll) <= ROLL_THRESHOLD && 
          faceSizeRatio >= 0.05) {
        if (lastFlagType !== 'face-detected' && 
            !lastFlagType?.startsWith('gaze-') && 
            !lastFlagType?.startsWith('head-') &&
            !lastFlagType?.startsWith('look-') &&
            lastFlagType !== 'looking-away' &&
            lastFlagType !== 'head-tilt') {
          addToActivityLog('Face detected, looking forward', 'success', 'face-detected');
          setLastFlagType('face-detected');
        }
      }
    }
  };

  // Start face detection and head pose tracking interval - only if camera monitoring is enabled
  useEffect(() => {
    if (enableCameraMonitoring && examStarted && (faceMeshModel || faceDetectionModel) && cameraActive && videoRef.current) {
      console.log('Starting face detection interval with improved head tracking (2 seconds)');
      
      // Start face detection and head pose tracking every 2 seconds
      const intervalId = setInterval(() => {
        if (videoRef.current && videoRef.current.readyState >= videoRef.current.HAVE_METADATA) {
          detectFaces();
        }
      }, 2000); // 2 seconds as requested
      
      faceDetectionIntervalRef.current = intervalId;

      return () => {
        clearInterval(intervalId);
        faceDetectionIntervalRef.current = null;
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableCameraMonitoring, examStarted, faceMeshModel, faceDetectionModel, cameraActive]);

  // Tab switch / Focus detection - only if enabled in exam settings
  useEffect(() => {
    if (!examStarted || !detectTabSwitching) return;

    const handleBlur = () => {
      addToActivityLog('Tab switched or window lost focus', 'error', 'tab-switch');
      sendFlagToBackend('tab-switch', 'Tab switched or window lost focus');
    };

    const handleFocus = () => {
      addToActivityLog('Back to exam window', 'info', 'window-focus');
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        addToActivityLog('Window minimized or tab hidden', 'error', 'tab-switch');
        sendFlagToBackend('tab-switch', 'Window minimized or tab hidden');
      } else {
        addToActivityLog('Window restored', 'info', 'window-focus');
      }
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examStarted, detectTabSwitching]);

  // Add initial log entry when exam starts
  useEffect(() => {
    if (examStarted && activityLog.length === 0) {
      addToActivityLog('Exam started', 'info', 'exam-start');
      addToActivityLog('Proctoring system activated', 'info', 'proctoring-start');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examStarted]);

  // Countdown timer - only starts when exam is started
  useEffect(() => {
    if (examStarted && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    } else if (examStarted && timeLeft <= 0) {
      // Auto-submit when time runs out
      alert("Time's up! Your exam will now be submitted automatically.");
      handleSubmitExam();
    }
  }, [timeLeft, examStarted]);

  // Prevent accidental page refresh/close during exam
  useEffect(() => {
    if (!examStarted) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
      return "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [examStarted]);

  // Disable right-click, F11, ESC, and other shortcuts during exam
  useEffect(() => {
    if (!examStarted) return;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      addToActivityLog('Right-click disabled during exam', 'warning', 'right-click-blocked');
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Disable ESC key (most aggressive approach)
      if (e.key === 'Escape' || e.keyCode === 27) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        addToActivityLog('ESC key pressed - fullscreen exit blocked', 'error', 'esc-blocked');
        sendFlagToBackend('esc-pressed', 'ESC key pressed - attempting to exit fullscreen', true);
        
        // Immediately re-enter fullscreen (multiple attempts)
        requestAnimationFrame(() => requestFullscreen());
        setTimeout(() => requestFullscreen(), 0);
        setTimeout(() => requestFullscreen(), 10);
        setTimeout(() => requestFullscreen(), 50);
        setTimeout(() => requestFullscreen(), 100);
        setTimeout(() => requestFullscreen(), 200);
        return false;
      }

      // Disable F11 (fullscreen toggle)
      if (e.key === 'F11') {
        e.preventDefault();
        e.stopPropagation();
        addToActivityLog('F11 fullscreen toggle disabled', 'warning', 'f11-blocked');
        return false;
      }

      // Disable Ctrl+Shift+I (DevTools)
      if (e.ctrlKey && e.shiftKey && e.key === 'I') {
        e.preventDefault();
        e.stopPropagation();
        addToActivityLog('Developer tools access blocked', 'error', 'devtools-blocked');
        sendFlagToBackend('devtools-access', 'Developer tools access attempted', true);
        return false;
      }

      // Disable Ctrl+Shift+J (Console)
      if (e.ctrlKey && e.shiftKey && e.key === 'J') {
        e.preventDefault();
        e.stopPropagation();
        addToActivityLog('Console access blocked', 'error', 'console-blocked');
        sendFlagToBackend('console-access', 'Console access attempted', true);
        return false;
      }

      // Disable Ctrl+Shift+C (Inspect Element)
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        e.preventDefault();
        e.stopPropagation();
        addToActivityLog('Inspect element blocked', 'error', 'inspect-blocked');
        sendFlagToBackend('inspect-access', 'Inspect element attempted', true);
        return false;
      }

      // Disable Ctrl+U (View Source)
      if (e.ctrlKey && e.key === 'u') {
        e.preventDefault();
        e.stopPropagation();
        addToActivityLog('View source blocked', 'error', 'view-source-blocked');
        sendFlagToBackend('view-source', 'View source attempted', true);
        return false;
      }

      // Disable Ctrl+S (Save Page)
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        e.stopPropagation();
        addToActivityLog('Save page blocked', 'warning', 'save-blocked');
        return false;
      }

      // Disable Ctrl+P (Print)
      if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        e.stopPropagation();
        addToActivityLog('Print blocked', 'warning', 'print-blocked');
        return false;
      }
    };

    // Disable text selection (optional - can be removed if needed)
    const handleSelectStart = (e: Event) => {
      // Allow selection for text inputs and textareas
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }
      e.preventDefault();
      return false;
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('selectstart', handleSelectStart);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('selectstart', handleSelectStart);
    };
  }, [examStarted, addToActivityLog, sendFlagToBackend]);

  // Simulate random proctoring events - only when exam is started
  useEffect(() => {
    if (!examStarted) return;

    const eventTimer = setInterval(() => {
      const randomEvent = Math.random();
      if (randomEvent < 0.1) {
        // 10% chance of an event
        const events = [
          {
            message: "Multiple faces detected",
            severity: "warning",
          },
          {
            message: "Face not detected",
            severity: "error",
          },
          {
            message: "Tab switch detected",
            severity: "warning",
          },
          {
            message: "Audio anomaly detected",
            severity: "warning",
          },
        ];
        const event = events[Math.floor(Math.random() * events.length)];
        const newLog = {
          id: proctoringLog.length + 1,
          timestamp: new Date().toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          }),
          message: event.message,
          severity: event.severity,
        };
        setProctoringLog((prev) => [newLog, ...prev].slice(0, 10));
      }
    }, 10000); // Check every 10 seconds

    return () => clearInterval(eventTimer);
  }, [proctoringLog.length, examStarted]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleAnswerChange = (value: string) => {
    const currentQ = questions[currentQuestion];
    if (currentQ && currentQ.questionId) {
    setAnswers((prev) => ({
      ...prev,
        [currentQ.questionId]: value,
      }));
    } else if (currentQ && currentQ.id) {
      setAnswers((prev) => ({
        ...prev,
        [currentQ.id]: value,
      }));
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion((prev) => prev + 1);
    }
  };

  const handlePreviousQuestion = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion((prev) => prev - 1);
    }
  };

  // Auto-submit exam (called when violation limit exceeded)
  const handleAutoSubmit = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No authentication token found');
        onExitExam();
        return;
      }

      // Get exam ID
      const examId = examData.examId || examData.id;
      if (!examId) {
        console.error('Invalid exam data. Cannot submit.');
        onExitExam();
        return;
      }

      // Format answers for submission (submit whatever is answered)
      const formattedAnswers = questions.map((q) => {
        const questionId = q.questionId || q.id;
        const selectedAnswer = answers[questionId] || '';
        
        return {
          questionId: questionId,
          selectedAnswer: selectedAnswer
        };
      }).filter(ans => ans.selectedAnswer); // Only include answered questions

      console.log('Auto-submitting exam due to violations:', {
        examId,
        answers: formattedAnswers,
        totalQuestions: questions.length,
        answeredCount: formattedAnswers.length,
        violations: totalViolationFlags,
        maxAllowed: maxAllowedViolations
      });

      const response = await fetch(`http://localhost:3000/api/v1/submission/${examId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          answers: formattedAnswers
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        console.error('Error auto-submitting exam:', errorData);
      } else {
        const data = await response.json();
        console.log('Exam auto-submitted successfully:', data);
      }

      // Show alert and exit
      alert(
        `Exam Auto-Submitted!\n\nReason: Maximum allowed violations exceeded (${totalViolationFlags}/${maxAllowedViolations})\n\nAnswered: ${formattedAnswers.length}/${questions.length} questions\nTime used: ${formatTime(examData.durationInSeconds - timeLeft)}`
      );
      onExitExam();
    } catch (err: any) {
      console.error('Error auto-submitting exam:', err);
      alert(`Exam auto-submitted due to violations.`);
      onExitExam();
    }
  };

  const handleSubmitExam = async () => {
    try {
    setShowSubmitDialog(false);
      
      // If exam was auto-submitted, don't submit again
      if (examAutoSubmitted) {
        onExitExam();
        return;
      }
      
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Authentication required. Please login again.');
        onExitExam();
        return;
      }

      // Get exam ID
      const examId = examData.examId || examData.id;
      if (!examId) {
        alert('Invalid exam data. Cannot submit.');
        onExitExam();
        return;
      }

      // Format answers for submission
      const formattedAnswers = questions.map((q) => {
        const questionId = q.questionId || q.id;
        const selectedAnswer = answers[questionId] || '';
        
        return {
          questionId: questionId,
          selectedAnswer: selectedAnswer
        };
      }).filter(ans => ans.selectedAnswer); // Only include answered questions

      console.log('Submitting exam:', {
        examId,
        answers: formattedAnswers,
        totalQuestions: questions.length,
        answeredCount: formattedAnswers.length
      });

      const response = await fetch(`http://localhost:3000/api/v1/submission/${examId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          answers: formattedAnswers
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        throw new Error(errorData.message || `Failed to submit exam: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Exam submitted successfully:', data);

    alert(
        `Exam submitted successfully!\n\nAnswered: ${formattedAnswers.length}/${questions.length} questions\nTime used: ${formatTime(examData.durationInSeconds - timeLeft)}`
    );
    onExitExam();
    } catch (err: any) {
      console.error('Error submitting exam:', err);
      alert(`Failed to submit exam: ${err.message || 'Unknown error'}`);
    }
  };

  // Handle pause exam - saves progress and returns to dashboard
  const handlePauseExam = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Authentication required. Please login again.');
        onExitExam();
        return;
      }

      // Get exam ID
      const examId = examData.examId || examData.id;
      if (!examId) {
        console.error('Invalid exam data. Cannot save progress.');
        onExitExam();
        return;
      }

      // Format answers for saving (save all answers, even if incomplete)
      const formattedAnswers = questions.map((q) => {
        const questionId = q.questionId || q.id;
        const selectedAnswer = answers[questionId] || '';
        
        return {
          questionId: questionId,
          selectedAnswer: selectedAnswer
        };
      }).filter(ans => ans.selectedAnswer); // Only include answered questions

      console.log('Pausing exam and saving progress:', {
        examId,
        answers: formattedAnswers,
        totalQuestions: questions.length,
        answeredCount: formattedAnswers.length,
        timeRemaining: timeLeft
      });

      // Save progress to backend using the submission endpoint
      // The backend should handle this as a paused/incomplete submission
      const response = await fetch(`http://localhost:3000/api/v1/submission/${examId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          answers: formattedAnswers,
          isPaused: true, // Indicate this is a pause, not a final submission
          timeRemaining: timeLeft
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: response.statusText }));
        console.error('Error saving paused exam progress:', errorData);
        // Still show success message and exit even if save fails
        alert(
          `Exam paused!\n\nProgress saved: ${formattedAnswers.length}/${questions.length} questions answered\nTime remaining: ${formatTime(timeLeft)}\n\nNote: There was an issue saving to server, but your local progress is preserved.`
        );
      } else {
        const data = await response.json();
        console.log('Exam paused successfully, progress saved:', data);
        alert(
          `Exam paused!\n\nProgress saved: ${formattedAnswers.length}/${questions.length} questions answered\nTime remaining: ${formatTime(timeLeft)}\n\nYou can resume this exam later from your dashboard.`
        );
      }
      
      onExitExam();
    } catch (err: any) {
      console.error('Error pausing exam:', err);
      alert(`Error pausing exam: ${err.message || 'Unknown error'}`);
      // Still exit even if save fails
      onExitExam();
    }
  };

  const answeredCount = Object.keys(answers).length;
  const totalQuestions = questions.length || examData.totalQuestions || 0;
  const progressPercentage = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;

  // Show loading screen while fetching exam data
  if (loading) {
    return (
      <div className="h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <Card className="w-[600px] shadow-2xl">
          <CardContent className="pt-6 pb-6 text-center">
            <p className="text-gray-600">Loading exam questions...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show error screen if exam data failed to load
  if (error || questions.length === 0) {
    return (
      <div className="h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <Card className="w-[600px] shadow-2xl">
          <CardHeader className="text-center border-b">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <CardTitle className="text-2xl text-red-600">Error Loading Exam</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <p className="text-gray-600 text-center">{error || 'No questions found for this exam'}</p>
            <Button
              onClick={onExitExam}
              variant="outline"
              className="w-full"
            >
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show start screen before exam begins
  if (!examStarted) {
    return (
      <div className="h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <Card className="w-[600px] shadow-2xl">
          <CardHeader className="text-center border-b">
            <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: '#4444FF' }}>
              <FileText className="w-8 h-8 text-white" />
            </div>
            <CardTitle className="text-2xl">{examData.subject || examDetails?.title || 'Exam'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                <span className="text-gray-700">Total Questions</span>
                <span className="font-semibold text-gray-900">
                  {questions.length || examData.totalQuestions || 0}
                </span>
              </div>
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                <span className="text-gray-700">Duration</span>
                <span className="font-semibold text-gray-900">
                  {formatTime(examData.durationInSeconds)}
                </span>
              </div>
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                <span className="text-gray-700">Camera Monitoring</span>
                <Badge className={enableCameraMonitoring ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-700 border-gray-200"}>
                  <Camera className="w-3 h-3 mr-1" />
                  {enableCameraMonitoring ? "Active" : "Disabled"}
                </Badge>
              </div>
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                <div className="flex flex-col">
                  <span className="text-gray-700">Auto-Submit on Violations</span>
                  <span className="text-xs text-gray-500 mt-0.5">
                    {enableAutoSubmission ? "Will auto-submit if violations exceed limit" : "Disabled - violations will be recorded"}
                  </span>
                </div>
                <Switch
                  checked={enableAutoSubmission}
                  onCheckedChange={(checked) => {
                    setEnableAutoSubmission(checked);
                  }}
                />
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div className="flex-1 text-sm text-yellow-800">
                  <p className="font-semibold mb-2">
                    Important Instructions:
                  </p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Ensure your camera is enabled and working</li>
                    <li>Do not switch tabs or minimize the window</li>
                    <li>Do not leave your seat during the exam</li>
                    <li>Make sure you have a stable internet connection</li>
                    <li>The exam will auto-submit when time expires</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex space-x-3">
              <Button
                onClick={onExitExam}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={async () => {
                  // Enter fullscreen before starting exam using guard hook
                  const fullscreenSuccess = await reEnterFullscreen();
                  
                  if (!fullscreenSuccess) {
                    alert('Fullscreen permission required to begin the exam.');
                    return;
                  }
                  
                  // Randomize questions and options if enabled (per student)
                  let randomizedQuestions = [...questions];
                  
                  // Randomize question order if enabled
                  if (randomizeQuestions && randomizedQuestions.length > 1) {
                    console.log('Randomizing question order for this student...');
                    for (let i = randomizedQuestions.length - 1; i > 0; i--) {
                      const j = Math.floor(Math.random() * (i + 1));
                      [randomizedQuestions[i], randomizedQuestions[j]] = [randomizedQuestions[j], randomizedQuestions[i]];
                    }
                    addToActivityLog('Question order randomized for this exam session', 'info', 'question-randomize');
                  }
                  
                  // Randomize option order for each question if enabled
                  if (randomizeOptions) {
                    console.log('Randomizing option order for all questions...');
                    randomizedQuestions = randomizedQuestions.map(question => {
                      if (!question.options.length || !question.correctAnswer) {
                        return question;
                      }
                      
                      // Find the correct answer text
                      const correctAnswerText = question.correctAnswer;
                      
                      // Create a shuffled copy of options
                      const shuffledOptions = [...question.options];
                      for (let i = shuffledOptions.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
                      }
                      
                      // The correct answer text remains the same (it's stored as the option text, not index)
                      return {
                        ...question,
                        options: shuffledOptions,
                        correctAnswer: correctAnswerText // Keep the same correct answer text
                      };
                    });
                    addToActivityLog('Option order randomized for all questions', 'info', 'option-randomize');
                  }
                  
                  // Update questions with randomized versions
                  setQuestions(randomizedQuestions);
                  
                  // Start exam after fullscreen is entered
                  setExamStarted(true);
                }}
                className="flex-1"
                style={{ backgroundColor: '#4444FF' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3333EE'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#4444FF'}
              >
                Start Exam
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden relative">
      {/* Fullscreen Blocker Overlay - shows when fullscreen is not active */}
      {examStarted && !fullscreenActive && (
        <FullscreenBlockerOverlay
          visible={true}
          onEnableFullscreen={reEnterFullscreen}
        />
      )}

      {/* Exam UI - disabled when not in fullscreen */}
      <div
        className={`h-full flex flex-col ${!fullscreenActive ? 'pointer-events-none opacity-50' : ''}`}
        style={{
          filter: !fullscreenActive ? 'blur(4px)' : 'none',
          transition: 'filter 0.3s ease',
        }}
      >
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <h1 className="text-lg text-gray-900">{examData.subject}</h1>
          </div>
          <div className="h-6 w-px bg-gray-300"></div>
          <div className="flex items-center space-x-2">
            <Clock
              className={`w-4 h-4 ${timeLeft < 300 ? "text-red-500" : "text-gray-600"}`}
            />
            <span
              className={`tabular-nums ${timeLeft < 300 ? "text-red-600" : "text-gray-900"}`}
            >
              {formatTime(timeLeft)}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Progress:</span>
            <span className="text-gray-900">
              {answeredCount}/{totalQuestions}
            </span>
            <div className="w-32">
              <Progress value={progressPercentage} className="h-2" />
            </div>
          </div>
          {examStarted && (
            <div className="flex items-center space-x-2">
              <AlertTriangle 
                className={`w-4 h-4 ${
                  totalViolationFlags >= maxAllowedViolations 
                    ? "text-red-500" 
                    : totalViolationFlags >= Math.floor(maxAllowedViolations * 0.8)
                      ? "text-yellow-500"
                      : "text-gray-400"
                }`}
              />
              <span className={`text-sm ${
                totalViolationFlags >= maxAllowedViolations 
                  ? "text-red-600 font-semibold" 
                  : totalViolationFlags >= Math.floor(maxAllowedViolations * 0.8)
                    ? "text-yellow-600"
                    : "text-gray-600"
              }`}>
                Violations: {totalViolationFlags}/{maxAllowedViolations}
              </span>
            </div>
          )}
          {/* Pause button - only shows if enabled by admin, exam is started, and not auto-submitted */}
          {enablePause && examStarted && !examAutoSubmitted && (
            <Button
              onClick={handlePauseExam}
              variant="outline"
              className="flex items-center space-x-2"
            >
              <Pause className="w-4 h-4" />
              <span>Pause Exam</span>
            </Button>
          )}
          <Button
            onClick={() => setShowSubmitDialog(true)}
            disabled={examAutoSubmitted}
            style={{ backgroundColor: examAutoSubmitted ? '#9CA3AF' : '#4444FF' }}
            onMouseEnter={(e) => !examAutoSubmitted && (e.currentTarget.style.backgroundColor = '#3333EE')}
            onMouseLeave={(e) => !examAutoSubmitted && (e.currentTarget.style.backgroundColor = '#4444FF')}
          >
            {examAutoSubmitted ? 'Auto-Submitted' : 'Submit Exam'}
          </Button>
        </div>
      </header>

      {/* Connection Warning */}
      {!connectionActive && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-2">
          <div className="flex items-center space-x-2 text-red-700">
            <WifiOff className="w-4 h-4" />
            <span className="text-sm">
              Connection lost. Attempting to reconnect...
            </span>
          </div>
        </div>
      )}

      {/* Camera Warning */}
      {!cameraActive && !cameraError && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-6 py-2">
          <div className="flex items-center space-x-2 text-yellow-700">
            <VideoOff className="w-4 h-4" />
            <span className="text-sm">
              Camera will start automatically when exam begins.
            </span>
          </div>
        </div>
      )}

      {/* Fullscreen Exit Warning */}
      {examStarted && fullscreenWarnings > 0 && (
        <div className={`border-b px-6 py-2 ${
          fullscreenWarnings >= 3 
            ? "bg-red-50 border-red-200" 
            : "bg-yellow-50 border-yellow-200"
        }`}>
          <div className={`flex items-center space-x-2 ${
            fullscreenWarnings >= 3 
              ? "text-red-700" 
              : "text-yellow-700"
          }`}>
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-medium">
              {fullscreenWarnings >= 3 
                ? `CRITICAL: Multiple fullscreen exits detected (${fullscreenWarnings} times). Exam integrity compromised.`
                : `Warning: Fullscreen exit detected (${fullscreenWarnings} time${fullscreenWarnings > 1 ? 's' : ''}). This is considered suspicious activity.`}
            </span>
          </div>
        </div>
      )}

      {/* Fullscreen Status Warning */}
      {examStarted && !isFullscreen && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-red-700">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm font-medium">
                Fullscreen mode is required. Please enter fullscreen to continue.
              </span>
            </div>
            <Button
              onClick={requestFullscreen}
              variant="outline"
              size="sm"
              className="text-red-700 border-red-300 hover:bg-red-100"
            >
              Enter Fullscreen
            </Button>
          </div>
        </div>
      )}

      {/* Violation Warning */}
      {examStarted && totalViolationFlags > 0 && (
        <div className={`border-b px-6 py-2 ${
          totalViolationFlags >= maxAllowedViolations 
            ? "bg-red-50 border-red-200" 
            : totalViolationFlags >= Math.floor(maxAllowedViolations * 0.8)
              ? "bg-yellow-50 border-yellow-200"
              : "bg-blue-50 border-blue-200"
        }`}>
          <div className={`flex items-center space-x-2 ${
            totalViolationFlags >= maxAllowedViolations 
              ? "text-red-700" 
              : totalViolationFlags >= Math.floor(maxAllowedViolations * 0.8)
                ? "text-yellow-700"
                : "text-blue-700"
          }`}>
            <AlertTriangle className="w-4 h-4" />
            <span className="text-sm font-medium">
              {totalViolationFlags >= maxAllowedViolations 
                ? enableAutoSubmission
                  ? `CRITICAL: Maximum violations exceeded (${totalViolationFlags}/${maxAllowedViolations}). Exam will be auto-submitted.`
                  : `CRITICAL: Maximum violations exceeded (${totalViolationFlags}/${maxAllowedViolations}).`
                : totalViolationFlags >= Math.floor(maxAllowedViolations * 0.8)
                  ? enableAutoSubmission
                    ? `Warning: You have ${totalViolationFlags} violation(s). Maximum allowed: ${maxAllowedViolations}. Exam will be auto-submitted if limit is exceeded.`
                    : `Warning: You have ${totalViolationFlags} violation(s). Maximum allowed: ${maxAllowedViolations}.`
                  : `Violations: ${totalViolationFlags}/${maxAllowedViolations}`}
            </span>
          </div>
        </div>
      )}

      {/* Auto-Submit Warning */}
      {examAutoSubmitted && (
        <div className="bg-red-100 border-b border-red-300 px-6 py-3">
          <div className="flex items-center space-x-2 text-red-800">
            <AlertTriangle className="w-5 h-5 animate-pulse" />
            <span className="text-sm font-semibold">
              Exam auto-submitted due to exceeding maximum allowed violations ({totalViolationFlags}/{maxAllowedViolations}). Please wait...
            </span>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Question Area (70%) */}
        <div className="flex-[0.7] p-6 overflow-y-auto">
          <Card className="h-full flex flex-col">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <CardTitle>
                  Question {currentQuestion + 1} of {questions.length}
                </CardTitle>
                <Badge
                  variant={
                    (questions[currentQuestion] && (answers[questions[currentQuestion].questionId] || answers[questions[currentQuestion].id])) ? "default" : "outline"
                  }
                  className={
                    (questions[currentQuestion] && (answers[questions[currentQuestion].questionId] || answers[questions[currentQuestion].id]))
                      ? "bg-green-50 text-green-700 border-green-200"
                      : ""
                  }
                >
                  {(questions[currentQuestion] && (answers[questions[currentQuestion].questionId] || answers[questions[currentQuestion].id])) ? (
                    <>
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Answered
                    </>
                  ) : (
                    "Not Answered"
                  )}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-6">
              <div className="flex-1">
                <p className="text-lg text-gray-900 mb-6">
                  {questions[currentQuestion].question}
                </p>

                {questions[currentQuestion].type === "multiple-choice" ? (
                  <RadioGroup
                    value={(questions[currentQuestion] && (answers[questions[currentQuestion].questionId] || answers[questions[currentQuestion].id])) || ""}
                    onValueChange={handleAnswerChange}
                    className="space-y-3"
                  >
                    {questions[currentQuestion].options.map(
                      (option, index) => (
                        <div
                          key={index}
                          className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <RadioGroupItem
                            value={option}
                            id={`option-${index}`}
                          />
                          <Label
                            htmlFor={`option-${index}`}
                            className="flex-1 cursor-pointer"
                          >
                            {option}
                          </Label>
                        </div>
                      )
                    )}
                  </RadioGroup>
                ) : (
                  <Textarea
                    value={(questions[currentQuestion] && (answers[questions[currentQuestion].questionId] || answers[questions[currentQuestion].id])) || ""}
                    onChange={(e) => handleAnswerChange(e.target.value)}
                    placeholder="Type your answer here..."
                    className="min-h-[200px] p-4 border-gray-300"
                  />
                )}
              </div>

              {/* Navigation Buttons */}
              <div className="flex items-center justify-between pt-6 border-t mt-6">
                <Button
                  onClick={handlePreviousQuestion}
                  disabled={currentQuestion === 0}
                  variant="outline"
                  className="flex items-center space-x-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </Button>
                <div className="text-sm text-gray-600">
                  Question {currentQuestion + 1} of {questions.length}
                </div>
                <Button
                  onClick={handleNextQuestion}
                  disabled={currentQuestion === questions.length - 1}
                  className="flex items-center space-x-2"
                  style={{ backgroundColor: '#4444FF' }}
                  onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#3333EE')}
                  onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#4444FF')}
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Proctoring Area (30%) */}
        <div className="flex-[0.3] bg-white border-l border-gray-200 p-4 overflow-y-auto">
          <div className="space-y-4">
            {/* Webcam Feed - only show if camera monitoring is enabled */}
            {enableCameraMonitoring && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Live Webcam</CardTitle>
                  <Badge
                    variant={cameraActive ? "default" : "destructive"}
                    className={
                      cameraActive
                        ? "bg-green-50 text-green-700 border-green-200"
                        : ""
                    }
                  >
                    <div
                      className={`w-2 h-2 rounded-full mr-1 ${cameraActive ? "bg-green-500 animate-pulse" : "bg-red-500"}`}
                    ></div>
                    {cameraActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-3">
                <div className="aspect-video bg-gray-900 rounded-lg relative overflow-hidden border border-gray-300" style={{ minHeight: '200px', maxHeight: '240px' }}>
                  {/* Always render video element so ref is available */}
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`w-full h-full object-cover rounded-lg ${cameraActive && !cameraError && streamRef.current ? 'block' : 'hidden'}`}
                    style={{ 
                      backgroundColor: '#1F2937',
                      border: '1px solid #E5E7EB',
                      borderRadius: '0.5rem',
                      minHeight: '200px',
                      maxHeight: '240px'
                    }}
                  />
                  {/* Show error state */}
                  {cameraError && (
                    <div className="absolute inset-0 bg-gray-900 flex flex-col items-center justify-center p-4 rounded-lg">
                      <VideoOff className="w-12 h-12 text-red-500 mb-3" />
                      <p className="text-xs text-red-400 text-center px-2">
                        {cameraError}
                          </p>
                        </div>
                  )}
                  {/* Show disabled state when camera is not active and no error */}
                  {!cameraActive && !cameraError && (
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-800 flex flex-col items-center justify-center rounded-lg">
                      <VideoOff className="w-12 h-12 text-gray-500 mb-2" />
                      <p className="text-xs text-gray-400">
                        Camera disabled
                      </p>
                    </div>
                  )}
                </div>
                {cameraError && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                    {cameraError}
                  </div>
                )}
                {!cameraActive && !cameraError && (
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                    Camera will start automatically when exam begins
                  </div>
                )}
              </CardContent>
            </Card>
            )}

            {/* Head Pose Display - only show if camera monitoring is enabled */}
            {enableCameraMonitoring && examStarted && currentHeadPose && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center space-x-2">
                    <Eye className="w-4 h-4" />
                    <span>Head Pose & Gaze</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-2 text-xs">
                  <div className="grid grid-cols-3 gap-2">
                    <div className={`p-2 rounded border ${
                      Math.abs(currentHeadPose.yaw) > 35 
                        ? 'bg-yellow-50 border-yellow-300' 
                        : 'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="text-gray-600 mb-1">Yaw</div>
                      <div className={`font-semibold ${
                        Math.abs(currentHeadPose.yaw) > 35 
                          ? 'text-yellow-700' 
                          : 'text-gray-700'
                      }`}>
                        {currentHeadPose.yaw.toFixed(1)}°
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {currentHeadPose.yaw > 35 ? 'Right' : currentHeadPose.yaw < -35 ? 'Left' : 'Center'}
                      </div>
                    </div>
                    <div className={`p-2 rounded border ${
                      Math.abs(currentHeadPose.pitch) > 25 
                        ? 'bg-yellow-50 border-yellow-300' 
                        : 'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="text-gray-600 mb-1">Pitch</div>
                      <div className={`font-semibold ${
                        Math.abs(currentHeadPose.pitch) > 25 
                          ? 'text-yellow-700' 
                          : 'text-gray-700'
                      }`}>
                        {currentHeadPose.pitch.toFixed(1)}°
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {currentHeadPose.pitch > 25 ? 'Down' : currentHeadPose.pitch < -25 ? 'Up' : 'Center'}
                      </div>
                    </div>
                    <div className={`p-2 rounded border ${
                      Math.abs(currentHeadPose.roll) > 20 
                        ? 'bg-yellow-50 border-yellow-300' 
                        : 'bg-gray-50 border-gray-200'
                    }`}>
                      <div className="text-gray-600 mb-1">Roll</div>
                      <div className={`font-semibold ${
                        Math.abs(currentHeadPose.roll) > 20 
                          ? 'text-yellow-700' 
                          : 'text-gray-700'
                      }`}>
                        {currentHeadPose.roll.toFixed(1)}°
                      </div>
                      <div className="text-[10px] text-gray-500">
                        {Math.abs(currentHeadPose.roll) > 20 ? 'Tilted' : 'Level'}
                      </div>
                    </div>
                  </div>
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Gaze:</span>
                      <span className={`font-semibold ${
                        currentGaze === 'Center' 
                          ? 'text-green-600' 
                          : 'text-yellow-600'
                      }`}>
                        {currentGaze}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Proctoring Activity Log */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Proctoring Activity Log</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-3">
                <div 
                  ref={logContainerRef}
                  className="space-y-2 max-h-[400px] overflow-y-auto"
                  style={{ scrollBehavior: 'smooth' }}
                >
                  {activityLog.length > 0 ? (
                    activityLog.map((log) => {
                      // Determine icon based on type
                      let IconComponent = Video;
                      if (log.type === 'face-missing') {
                        IconComponent = UserX;
                      } else if (log.type === 'multiple-faces') {
                        IconComponent = Users;
                      } else if (log.type === 'face-detected') {
                        IconComponent = Eye;
                      } else if (log.severity === 'success') {
                        IconComponent = CheckCircle;
                      } else if (log.severity === 'error') {
                        IconComponent = AlertTriangle;
                      }

                      return (
                      <div
                        key={log.id}
                          className={`p-2 rounded-lg text-xs transition-all ${
                          log.severity === "error"
                            ? "bg-red-50 border border-red-200"
                            : log.severity === "warning"
                              ? "bg-yellow-50 border border-yellow-200"
                              : log.severity === "success"
                                ? "bg-green-50 border border-green-200"
                                : "bg-blue-50 border border-blue-200"
                        }`}
                      >
                        <div className="flex items-start space-x-2">
                            <IconComponent
                              className={`w-3 h-3 mt-0.5 ${
                                log.severity === "error"
                                  ? "text-red-500"
                                  : log.severity === "warning"
                                    ? "text-yellow-500"
                                    : log.severity === "success"
                                      ? "text-green-500"
                                      : "text-blue-500"
                              }`}
                            />
                          <div className="flex-1">
                            <p
                                className={`font-medium ${
                                log.severity === "error"
                                  ? "text-red-700"
                                  : log.severity === "warning"
                                    ? "text-yellow-700"
                                    : log.severity === "success"
                                      ? "text-green-700"
                                      : "text-blue-700"
                                }`}
                            >
                              {log.message}
                            </p>
                              <p className="text-gray-600 mt-0.5 text-[10px]">
                              {log.timestamp}
                            </p>
                          </div>
                        </div>
                      </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Eye className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                      <p className="text-xs">No activity detected yet</p>
                      <p className="text-[10px] mt-1">Proctoring will start when exam begins</p>
                    </div>
                  )}
                </div>
                {isModelLoading && (
                  <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                    <p>Loading AI face detection model...</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* System Status */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">System Status</CardTitle>
              </CardHeader>
              <CardContent className="p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Camera</span>
                  <Badge
                    variant={cameraActive ? "default" : "destructive"}
                    className={
                      cameraActive
                        ? "bg-green-50 text-green-700 border-green-200 text-xs"
                        : "text-xs"
                    }
                  >
                    {cameraActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Connection</span>
                  <Badge
                    variant={connectionActive ? "default" : "destructive"}
                    className={
                      connectionActive
                        ? "bg-green-50 text-green-700 border-green-200 text-xs"
                        : "text-xs"
                    }
                  >
                    {connectionActive ? "Connected" : "Disconnected"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex flex-col">
                    <span className="text-gray-600">Auto-Submit on Violations</span>
                    <span className="text-[10px] text-gray-500 mt-0.5">
                      {enableAutoSubmission ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                  <Switch
                    checked={enableAutoSubmission}
                    onCheckedChange={(checked) => {
                      setEnableAutoSubmission(checked);
                      addToActivityLog(
                        `Auto-submit ${checked ? 'enabled' : 'disabled'}`,
                        'info',
                        'auto-submit-toggle'
                      );
                    }}
                    disabled={examAutoSubmitted || totalViolationFlags >= maxAllowedViolations}
                  />
                </div>
                <button
                  onClick={() => setConnectionActive(!connectionActive)}
                  className="w-full text-xs text-blue-600 hover:text-blue-800 mt-2"
                >
                  Toggle Connection (Demo)
                </button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Submit Exam Dialog */}
      <AlertDialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit Exam?</AlertDialogTitle>
            <AlertDialogDescription>
              You have answered {answeredCount} out of{" "}
              {totalQuestions} questions.{" "}
              {answeredCount < totalQuestions && (
                <span className="text-yellow-600">
                  {totalQuestions - answeredCount} questions remain
                  unanswered.
                </span>
              )}{" "}
              Are you sure you want to submit your exam? This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue Exam</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSubmitExam}
              style={{ backgroundColor: '#4444FF' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3333EE'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#4444FF'}
            >
              Submit Exam
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
}
