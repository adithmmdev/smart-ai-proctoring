const Submission = require('../models/submission');
const Exam = require('../models/exam');
const ProctoringLog = require('../models/proctorlog');
const User = require('../models/user');

// Get student dashboard statistics
const getStudentDashboardStats = async (req, res) => {
  try {
    const studentId = req.user.id;
    console.log('Fetching dashboard stats for student:', studentId);

    // Get all submissions for this student
    const submissions = await Submission.find({ student: studentId })
      .populate('exam', 'title date totalMarks questions')
      .sort({ submittedAt: -1 })
      .lean();
    
    console.log(`Found ${submissions.length} submissions for student`);

    // Calculate statistics
    const completedExams = submissions.filter(sub => sub.submittedAt).length;
    const totalExams = submissions.length;
    
    // Calculate average score
    let totalScore = 0;
    let scoredExams = 0;
    submissions.forEach(sub => {
      if (sub.submittedAt && sub.exam && sub.exam.totalMarks) {
        const percentage = (sub.totalScore / sub.exam.totalMarks) * 100;
        totalScore += percentage;
        scoredExams++;
      }
    });
    const averageScore = scoredExams > 0 ? Math.round(totalScore / scoredExams) : 0;

    // Get ALL exams from database
    const now = new Date();
    const allExams = await Exam.find({})
      .sort({ date: 1 })
      .lean();
    
    console.log(`Found ${allExams.length} total exams in database`);
    
    // Filter to show only upcoming exams (not yet ended and not completed)
    // Get exam IDs that the student has already completed
    const completedExamIds = new Set(
      submissions
        .filter(sub => sub.submittedAt && sub.exam && sub.exam._id)
        .map(sub => sub.exam._id.toString())
    );
    
    // Get exam IDs that are paused (not submitted but paused)
    const pausedExamIds = new Set(
      submissions
        .filter(sub => sub.isPaused && !sub.submittedAt && sub.exam && sub.exam._id)
        .map(sub => sub.exam._id.toString())
    );
    
    const upcomingExams = allExams.filter(exam => {
      const examDate = new Date(exam.date);
      const examEndTime = new Date(examDate.getTime() + (exam.duration * 60 * 1000));
      const examId = exam._id.toString();
      
      // Only include exams that:
      // 1. Haven't ended yet (examEndTime >= now) OR are paused (can resume even if expired)
      // 2. Haven't been completed by this student
      const isPaused = pausedExamIds.has(examId);
      return (examEndTime >= now || isPaused) && !completedExamIds.has(examId);
    });
    
    console.log(`Found ${upcomingExams.length} upcoming exams (not ended and not completed)`);
    
    // Use only upcoming exams
    const examsToShow = upcomingExams;

    // Get ALL exam results (all submissions with scores)
    // Show all completed submissions, sorted by submission date
    const completedSubmissions = submissions.filter(sub => sub.submittedAt);
    console.log(`Found ${completedSubmissions.length} completed submissions`);
    
    const recentResults = completedSubmissions.map(sub => {
      const exam = sub.exam || {};
      const totalMarks = exam.totalMarks || 100;
      const score = sub.totalScore !== undefined && sub.totalScore !== null && totalMarks > 0
        ? Math.round((sub.totalScore / totalMarks) * 100)
        : null;

      return {
        id: sub._id.toString(),
        examName: exam.title || 'Unknown Exam',
        examDate: exam.date || null,
        submittedAt: sub.submittedAt || null,
        score: score,
        totalScore: sub.totalScore || 0,
        totalMarks: totalMarks,
        status: sub.submittedAt ? 'completed' : 'pending'
      };
    });

    // Get proctoring alerts for this student
    const proctoringLogs = await ProctoringLog.find({ student: studentId })
      .populate('exam', 'title')
      .sort({ timestamp: -1 })
      .limit(5)
      .lean();

    const proctoringAlerts = proctoringLogs
      .filter(log => log.flags && log.flags.length > 0)
      .map(log => {
        const flags = log.flags || [];
        const mostSevereFlag = flags[0] || { type: 'unknown', message: 'Activity detected' };
        
        let severity = 'low';
        if (mostSevereFlag.type && (
          mostSevereFlag.type.toLowerCase().includes('face') ||
          mostSevereFlag.type.toLowerCase().includes('multiple') ||
          mostSevereFlag.type.toLowerCase().includes('no face')
        )) {
          severity = 'high';
        } else if (mostSevereFlag.type && (
          mostSevereFlag.type.toLowerCase().includes('tab') ||
          mostSevereFlag.type.toLowerCase().includes('switch')
        )) {
          severity = 'medium';
        }

        const timestamp = new Date(log.timestamp);
        const formattedDate = timestamp.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric' 
        });
        const formattedTime = timestamp.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true 
        });

        return {
          id: log._id.toString(),
          exam: log.exam?.title || 'Unknown Exam',
          alert: mostSevereFlag.message || mostSevereFlag.type || 'Suspicious activity detected',
          timestamp: `${formattedDate} ${formattedTime}`,
          severity: severity
        };
      });

    // Format upcoming exams
    const formattedUpcomingExams = examsToShow.map(exam => {
      const examDate = new Date(exam.date);
      const formattedDate = examDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric' 
      });
      const formattedTime = examDate.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
      });
      
      const durationMinutes = exam.duration || 0;
      const durationHours = Math.floor(durationMinutes / 60);
      const durationMins = durationMinutes % 60;
      let durationText = '';
      if (durationHours > 0) {
        durationText = `${durationHours} hour${durationHours > 1 ? 's' : ''}`;
        if (durationMins > 0) {
          durationText += ` ${durationMins} min${durationMins > 1 ? 's' : ''}`;
        }
      } else {
        durationText = `${durationMins} min${durationMins > 1 ? 's' : ''}`;
      }

      // Check if exam is available now (current time is within exam window)
      const examEndTime = new Date(examDate.getTime() + (exam.duration * 60 * 1000));
      const isAvailable = now >= examDate && now <= examEndTime;
      const isExpired = now > examEndTime;
      
      // Check if student has already taken this exam
      const submissionForThisExam = submissions.find(sub => 
        sub.exam && sub.exam._id && sub.exam._id.toString() === exam._id.toString()
      );
      const isCompleted = submissionForThisExam && submissionForThisExam.submittedAt;
      const isPaused = submissionForThisExam && submissionForThisExam.isPaused && !submissionForThisExam.submittedAt;

      // Determine status: completed > expired > available > scheduled
      let status = 'scheduled';
      if (isCompleted) {
        status = 'completed';
      } else if (isExpired) {
        status = 'expired';
      } else if (isAvailable) {
        status = 'available';
      }

      // Debug logging
      if (exam.title) {
        console.log(`Exam: ${exam.title}, Date: ${examDate.toISOString()}, Now: ${now.toISOString()}, End: ${examEndTime.toISOString()}, Available: ${isAvailable}, Expired: ${isExpired}, Completed: ${isCompleted}`);
      }

      return {
        id: exam._id.toString(),
        subject: exam.title,
        date: formattedDate,
        time: formattedTime,
        duration: durationText,
        durationInSeconds: exam.duration * 60,
        totalQuestions: exam.questions ? exam.questions.length : 0,
        status: status,
        isActive: isAvailable && !isCompleted && !isExpired, // Only active if available, not completed, and not expired
        isExpired: isExpired && !isCompleted, // Mark as expired if past end time and not completed
        isPaused: isPaused || false, // Include paused status
        rawDate: exam.date,
        examId: exam._id.toString(),
        examStartTime: examDate.toISOString(), // Include raw start time for frontend real-time checking
        examEndTime: examEndTime.toISOString() // Include raw end time for frontend real-time checking
      };
    });

    // Count only truly upcoming exams (not expired, not completed)
    const trulyUpcomingCount = formattedUpcomingExams.filter(exam => 
      exam.status === 'scheduled' || exam.status === 'available'
    ).length;
    
    const responseData = {
      stats: {
        completedExams,
        totalExams,
        averageScore,
        upcomingExamsCount: trulyUpcomingCount // Only count scheduled/available exams
      },
      upcomingExams: formattedUpcomingExams,
      recentResults,
      proctoringAlerts
    };
    
    console.log('Sending dashboard data:', {
      stats: responseData.stats,
      upcomingExamsCount: trulyUpcomingCount,
      totalExamsInList: formattedUpcomingExams.length,
      recentResultsCount: recentResults.length,
      proctoringAlertsCount: proctoringAlerts.length
    });
    
    res.json(responseData);
  } catch (err) {
    console.error('Error fetching student dashboard stats:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// Get student's submissions
const getStudentSubmissions = async (req, res) => {
  try {
    const studentId = req.user.id;

    const submissions = await Submission.find({ student: studentId })
      .populate('exam', 'title date totalMarks')
      .sort({ submittedAt: -1 })
      .lean();

    const formattedSubmissions = submissions.map(sub => {
      const exam = sub.exam || {};
      const totalMarks = exam.totalMarks || 100;
      const score = sub.totalScore !== undefined && sub.totalScore !== null && totalMarks > 0
        ? Math.round((sub.totalScore / totalMarks) * 100)
        : null;

      const submittedAt = sub.submittedAt 
        ? new Date(sub.submittedAt).toLocaleString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
          })
        : 'Not submitted';

      return {
        id: sub._id.toString(),
        examName: exam.title || 'Unknown Exam',
        examDate: exam.date || null,
        submittedAt: submittedAt,
        score: score,
        totalScore: sub.totalScore || 0,
        totalMarks: totalMarks,
        status: sub.submittedAt ? 'completed' : 'pending'
      };
    });

    res.json({
      submissions: formattedSubmissions,
      total: formattedSubmissions.length
    });
  } catch (err) {
    console.error('Error fetching student submissions:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = {
  getStudentDashboardStats,
  getStudentSubmissions
};

