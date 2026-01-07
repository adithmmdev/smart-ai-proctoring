const ProctoringLog = require("../models/proctorlog");

const storeCameraData = async (req, res) => {
  try {
    const { examId, snapshot, flags } = req.body;

    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    if (!examId) return res.status(400).json({ message: "Exam ID required" });

    const log = await ProctoringLog.create({
      exam: examId,
      student: req.user._id,
      snapshot, 
      flags: flags || [],
    });

    res.status(201).json({ message: "Proctoring data stored", log });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};


const getProctoringLogs = async (req, res) => {
  try {
    const logs = await ProctoringLog.find({ exam: req.params.examId })
      .populate("student", "name email")
      .sort({ timestamp: 1 });

    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Store proctoring flag (for AI-based proctoring)
const storeProctoringFlag = async (req, res) => {
  try {
    const { examId, studentId, type, timestamp, message } = req.body;

    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    if (!examId) return res.status(400).json({ message: "Exam ID required" });
    if (!type) return res.status(400).json({ message: "Flag type required" });

    // Get exam details to check maxAllowedViolations
    const Exam = require('../models/exam');
    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    const maxAllowedViolations = exam.proctoringSettings?.maxAllowedViolations || 3;

    // Find or create a proctoring log entry for this exam and student
    let log = await ProctoringLog.findOne({
      exam: examId,
      student: studentId || req.user._id,
    });

    const flagEntry = {
      type: type,
      message: message || type,
    };

    if (log) {
      // Update existing log with new flag
      log.flags.push(flagEntry);
      log.timestamp = timestamp ? new Date(timestamp) : new Date();
      await log.save();
    } else {
      // Create new log entry
      log = await ProctoringLog.create({
        exam: examId,
        student: studentId || req.user._id,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        flags: [flagEntry],
      });
    }

    // Count total flags (only count error/warning flags, not info flags)
    const errorFlags = log.flags.filter(flag => {
      const flagType = (flag.type || '').toLowerCase();
      return flagType.includes('face-missing') || 
             flagType.includes('multiple-faces') || 
             flagType.includes('tab-switch') ||
             flagType.includes('switch') ||
             flagType.includes('head-left') ||
             flagType.includes('head-right') ||
             flagType.includes('head-up') ||
             flagType.includes('head-down') ||
             flagType.includes('gaze-left') ||
             flagType.includes('gaze-right') ||
             flagType.includes('looking-away');
    });
    const totalErrorFlags = errorFlags.length;

    // Check if flag limit exceeded
    let shouldAutoSubmit = false;
    if (totalErrorFlags > maxAllowedViolations) {
      shouldAutoSubmit = true;
      
      // Auto-submit the exam
      try {
        const Submission = require('../models/submission');
        
        // Check if submission already exists
        let submission = await Submission.findOne({
          exam: examId,
          student: studentId || req.user._id,
        });

        if (!submission) {
          // Create a submission with empty answers (auto-submitted due to violations)
          submission = await Submission.create({
            exam: examId,
            student: studentId || req.user._id,
            answers: [], // Empty answers since exam was auto-submitted
            totalScore: 0,
            submittedAt: new Date(),
          });
        } else if (!submission.submittedAt) {
          // Update existing submission to mark as submitted
          submission.submittedAt = new Date();
          await submission.save();
        }
      } catch (submitErr) {
        console.error('Error auto-submitting exam:', submitErr);
        // Don't fail the flag storage, just log the error
      }
    }

    res.status(201).json({ 
      message: "Proctoring flag stored", 
      log,
      flag: flagEntry,
      totalFlags: totalErrorFlags,
      maxAllowedViolations: maxAllowedViolations,
      shouldAutoSubmit: shouldAutoSubmit,
      autoSubmitted: shouldAutoSubmit
    });
  } catch (err) {
    console.error('Error storing proctoring flag:', err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

module.exports = {
  storeCameraData,
  getProctoringLogs,
  storeProctoringFlag,
};