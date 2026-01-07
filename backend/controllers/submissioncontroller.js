const Submission = require("../models/submission");
const Exam = require("../models/exam");
const ProctoringLog = require("../models/proctorlog");

const submitAnswers = async (req, res) => {
  try {
    const { answers, isPaused, timeRemaining } = req.body;
    const { examId } = req.params;

    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    // Check if there's an existing submission (for paused exams)
    let existingSubmission = await Submission.findOne({
      exam: examId,
      student: req.user._id,
    });

    let totalScore = 0;

    const evaluatedAnswers = answers.map((ans) => {
      const question = exam.questions.id(ans.questionId);
      if (!question) return ans;

      const isCorrect = ans.selectedAnswer === question.correctAnswer;
      const marksObtained = isCorrect ? question.marks : 0;
      totalScore += marksObtained;

      return {
        questionId: ans.questionId,
        selectedAnswer: ans.selectedAnswer,
        isCorrect,
        marksObtained,
      };
    });

    // If this is a pause, update existing submission or create new one
    if (isPaused) {
      if (existingSubmission) {
        // Update existing submission with new answers
        existingSubmission.answers = evaluatedAnswers;
        existingSubmission.totalScore = totalScore;
        existingSubmission.isPaused = true;
        existingSubmission.timeRemaining = timeRemaining;
        existingSubmission.submittedAt = null; // Not submitted yet
        await existingSubmission.save();
        return res.status(200).json(existingSubmission);
      } else {
        // Create new paused submission
        const submission = await Submission.create({
          exam: examId,
          student: req.user._id,
          answers: evaluatedAnswers,
          totalScore,
          isPaused: true,
          timeRemaining: timeRemaining,
          submittedAt: null,
        });
        return res.status(201).json(submission);
      }
    } else {
      // Final submission
      if (existingSubmission) {
        // Update existing submission
        existingSubmission.answers = evaluatedAnswers;
        existingSubmission.totalScore = totalScore;
        existingSubmission.isPaused = false;
        existingSubmission.submittedAt = new Date();
        existingSubmission.timeRemaining = null;
        await existingSubmission.save();
        return res.status(200).json(existingSubmission);
      } else {
        // Create new submission
        const submission = await Submission.create({
          exam: examId,
          student: req.user._id,
          answers: evaluatedAnswers,
          totalScore,
          isPaused: false,
          submittedAt: new Date(),
        });
        return res.status(201).json(submission);
      }
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


const getSubmission = async (req, res) => {
  try {
    const submission = await Submission.findOne({
      exam: req.params.examId,
      student: req.user._id,
    }).populate("exam", "title date");

    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    res.json(submission);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};


const getAllSubmissionsForExam = async (req, res) => {
  try {
    const submissions = await Submission.find({
      exam: req.params.examId,
    })
      .populate("student", "name email")
      .populate("exam", "title date");

    res.json(submissions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getAllSubmissions = async (req, res) => {
  try {
    console.log('Fetching all submissions...');
    
    // First, try to find submissions without populate to see if there are any
    const submissionCount = await Submission.countDocuments();
    console.log(`Total submissions in database: ${submissionCount}`);
    
    let submissions;
    try {
      submissions = await Submission.find()
        .populate("student", "name email")
        .populate("exam", "title date totalMarks questions")
        .sort({ submittedAt: -1 })
        .lean();
    } catch (populateErr) {
      console.error('Error during populate:', populateErr);
      console.error('Error stack:', populateErr.stack);
      // Try without populate if populate fails
      submissions = await Submission.find()
        .sort({ submittedAt: -1 })
        .lean();
    }
    
    console.log(`Found ${submissions.length} submissions after populate`);

    // Format submissions for display
    const formattedSubmissions = submissions.map((sub) => {
      try {
        // Handle null/missing exam or student gracefully
        if (!sub) {
          return null;
        }

        // Safe date formatting
        let submittedAt = 'Not submitted';
        if (sub.submittedAt) {
          try {
            submittedAt = new Date(sub.submittedAt).toLocaleString('en-US', { 
              year: 'numeric', 
              month: 'short', 
              day: 'numeric',
              hour: 'numeric', 
              minute: '2-digit',
              hour12: true 
            });
          } catch (dateErr) {
            submittedAt = 'Invalid date';
          }
        }

        const totalMarks = sub.exam?.totalMarks || 100;
        const score = sub.totalScore !== undefined && sub.totalScore !== null && totalMarks > 0
          ? Math.round((sub.totalScore / totalMarks) * 100)
          : null;

        const answered = sub.answers?.length || 0;
        const totalQuestions = sub.exam?.questions?.length || 0;

        return {
          id: sub._id ? sub._id.toString() : '',
          student: sub.student?.name || 'Unknown Student',
          studentEmail: sub.student?.email || '',
          exam: sub.exam?.title || 'Unknown Exam',
          examDate: sub.exam?.date || null,
          score: score,
          totalScore: sub.totalScore || 0,
          totalMarks: totalMarks,
          answered: answered,
          totalQuestions: totalQuestions,
          status: sub.submittedAt ? 'completed' : 'pending',
          submittedAt: submittedAt,
          rawSubmittedAt: sub.submittedAt,
          answers: sub.answers || [],
          examId: sub.exam?._id ? sub.exam._id.toString() : null,
          studentId: sub.student?._id ? sub.student._id.toString() : null
        };
      } catch (mapErr) {
        console.error('Error formatting submission:', mapErr, sub);
        return null;
      }
    }).filter(sub => sub !== null); // Remove any null entries

    console.log(`Formatted ${formattedSubmissions.length} submissions`);
    res.json({
      submissions: formattedSubmissions,
      total: formattedSubmissions.length
    });
  } catch (err) {
    console.error('Error fetching all submissions:', err);
    console.error('Error stack:', err.stack);
    res.status(500).json({ message: 'Server error', error: err.message, stack: process.env.NODE_ENV === 'development' ? err.stack : undefined });
  }
};

const getSubmissionDetails = async (req, res) => {
  try {
    const { submissionId } = req.params;

    // Get submission with populated exam and student
    const submission = await Submission.findById(submissionId)
      .populate("exam", "title date totalMarks questions description")
      .populate("student", "name email")
      .lean();

    if (!submission) {
      return res.status(404).json({ message: "Submission not found" });
    }

    // Get proctoring logs for this student and exam
    const proctoringLogs = await ProctoringLog.find({
      exam: submission.exam._id,
      student: submission.student._id
    })
      .sort({ timestamp: 1 })
      .lean();

    // Map student answers to exam questions
    const exam = submission.exam;
    const questions = exam.questions || [];
    const detailedAnswers = questions.map((question, index) => {
      const answer = submission.answers.find(
        ans => ans.questionId && ans.questionId.toString() === question._id.toString()
      );

      return {
        id: index + 1,
        questionId: question._id,
        question: question.questionText || `Question ${index + 1}`,
        options: question.options || [],
        studentAnswer: answer?.selectedAnswer || 'Not answered',
        correctAnswer: question.correctAnswer || '',
        isCorrect: answer?.isCorrect || false,
        points: answer?.marksObtained || 0,
        maxPoints: question.marks || 0
      };
    });

    // Format proctoring incidents
    const proctoringIncidents = proctoringLogs
      .filter(log => log.flags && log.flags.length > 0)
      .map((log, index) => {
        const flags = log.flags || [];
        const mostSevereFlag = flags[0] || { type: 'unknown', message: 'Activity detected' };
        
        let severity = 'Low';
        if (mostSevereFlag.type && (
          mostSevereFlag.type.toLowerCase().includes('face') ||
          mostSevereFlag.type.toLowerCase().includes('multiple') ||
          mostSevereFlag.type.toLowerCase().includes('no face')
        )) {
          severity = 'High';
        } else if (mostSevereFlag.type && (
          mostSevereFlag.type.toLowerCase().includes('tab') ||
          mostSevereFlag.type.toLowerCase().includes('switch')
        )) {
          severity = 'Medium';
        }

        const timestamp = new Date(log.timestamp);
        const timeText = timestamp.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        });

        return {
          id: log._id.toString(),
          time: timeText,
          incident: mostSevereFlag.message || mostSevereFlag.type || 'Suspicious activity detected',
          severity: severity
        };
      });

    // Calculate statistics
    const totalQuestions = detailedAnswers.length;
    const correctAnswers = detailedAnswers.filter(a => a.isCorrect).length;
    const totalPoints = detailedAnswers.reduce((sum, a) => sum + a.points, 0);
    const maxPoints = exam.totalMarks || totalQuestions * 2;
    const accuracyPercentage = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
    const scorePercentage = maxPoints > 0 ? Math.round((submission.totalScore / maxPoints) * 100) : 0;

    // Format submission date
    const submittedAt = submission.submittedAt 
      ? new Date(submission.submittedAt).toLocaleString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric',
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        })
      : 'Not submitted';

    res.json({
      submission: {
        id: submission._id.toString(),
        student: submission.student?.name || 'Unknown Student',
        studentEmail: submission.student?.email || '',
        exam: exam.title || 'Unknown Exam',
        examDate: exam.date || null,
        submittedAt: submittedAt,
        totalScore: submission.totalScore || 0,
        totalMarks: maxPoints,
        score: scorePercentage,
        status: submission.submittedAt ? 'completed' : 'pending'
      },
      exam: {
        title: exam.title,
        description: exam.description,
        date: exam.date,
        totalMarks: maxPoints
      },
      statistics: {
        totalQuestions,
        correctAnswers,
        totalPoints,
        maxPoints,
        accuracyPercentage,
        scorePercentage
      },
      detailedAnswers,
      proctoringIncidents
    });
  } catch (err) {
    console.error('Error fetching submission details:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = {
  submitAnswers,
  getSubmission,
  getAllSubmissionsForExam,
  getAllSubmissions,
  getSubmissionDetails,
};
