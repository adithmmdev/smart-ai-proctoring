const Exam = require('../models/exam');
const User = require('../models/user');

exports.createExam = async (req, res) => {
  try {
    const { title, description, questions, totalMarks, duration, date, proctoringSettings } = req.body;
    if (!title || !date || !duration || !totalMarks) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const exam = await Exam.create({
      title,
      description,
      questions,
      totalMarks,
      duration,
      date,
      createdBy: req.user ? req.user.id : null,  //only for production
      proctoringSettings: proctoringSettings || {
        enableCameraMonitoring: false,
        detectTabSwitching: false,
        enableFaceDetection: false,
        enableAutoSubmission: true,
        enablePause: false,
        randomizeQuestions: false,
        randomizeOptions: false,
        maxAllowedViolations: 3
      }
    });
    res.status(201).json(exam);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


exports.getAllExams = async (req,res) =>{
  try{
    const Submission = require('../models/submission');
    const exams = await Exam.find().populate("createdBy","name email").sort({ date: 1 });
    
    // Get student counts for each exam
    const examsWithCounts = await Promise.all(
      exams.map(async (exam) => {
        const studentCount = await Submission.distinct('student', { exam: exam._id }).then(students => students.length);
        return {
          ...exam.toObject(),
          studentCount: studentCount || 0,
          totalQuestions: exam.questions ? exam.questions.length : 0
        };
      })
    );
    
    res.json(examsWithCounts);
  }catch(error){
    res.status(500).json({error : error.message});
  }
}

exports.getExamById = async (req,res) =>{
  try{
    const exam = await Exam.findById(req.params.id).populate("createdBy","name email");
    if(!exam) return res.status(404).json({message : "Exam not found"});
    res.json(exam);
  }catch(error){
    res.status(500).json({error : error.message});
  }
}

exports.updateExam = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    Object.assign(exam, req.body); // update fields
    const updatedExam = await exam.save();

    res.json(updatedExam);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.deleteExam = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    await exam.deleteOne();
    res.json({ message: "Exam deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getExamDetails = async (req, res) => {
  try {
    const Submission = require('../models/submission');
    const ProctoringLog = require('../models/proctorlog');
    const { id } = req.params;

    const exam = await Exam.findById(id).populate("createdBy", "name email");
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    // Get all submissions for this exam
    const submissions = await Submission.find({ exam: id })
      .populate("student", "name email")
      .sort({ submittedAt: -1 })
      .lean();

    // Get all proctoring logs for this exam
    const proctoringLogs = await ProctoringLog.find({ exam: id })
      .populate("student", "name email")
      .sort({ timestamp: -1 })
      .lean();

    // Get unique students
    const uniqueStudents = [...new Set(submissions.filter(s => s.student && s.student._id).map(s => s.student._id.toString()))];
    const totalStudents = uniqueStudents.length;

    // Get active students (with proctoring logs in last 30 minutes)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const recentLogs = proctoringLogs.filter(log => 
      log.student && log.student._id && new Date(log.timestamp) >= thirtyMinutesAgo
    );
    const activeStudentIds = [...new Set(recentLogs.filter(log => log.student && log.student._id).map(log => log.student._id.toString()))];
    const activeStudents = activeStudentIds.length;

    // Get completed submissions
    const completed = submissions.length;

    // Get flagged students (students with flags in proctoring logs)
    const flaggedLogs = proctoringLogs.filter(log => 
      log.student && log.student._id && log.flags && log.flags.length > 0
    );
    const flaggedStudentIds = [...new Set(flaggedLogs.filter(log => log.student && log.student._id).map(log => log.student._id.toString()))];
    const flaggedStudents = flaggedStudentIds.length;
    const totalFlags = flaggedLogs.reduce((sum, log) => sum + (log.flags?.length || 0), 0);

    // Calculate average progress
    const totalQuestions = exam.questions ? exam.questions.length : 0;
    const averageProgress = submissions.length > 0 
      ? Math.round((submissions.reduce((sum, sub) => sum + (sub.answers?.length || 0), 0) / submissions.length) / totalQuestions * 100)
      : 0;

    // Format activity logs - create separate entry for each flag
    const activityLogs = [];
    
    flaggedLogs.forEach((log) => {
      const flags = log.flags || [];
      if (flags.length === 0) return; // Skip logs without flags
      
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
      
      // Calculate time ago
      const timeAgo = Math.floor((Date.now() - timestamp.getTime()) / (1000 * 60));
      let timeText = `${timeAgo} min ago`;
      if (timeAgo < 1) timeText = 'Just now';
      else if (timeAgo >= 60) {
        const hours = Math.floor(timeAgo / 60);
        timeText = `${hours} hour${hours > 1 ? 's' : ''} ago`;
      }

      // Create an entry for each flag
      flags.forEach((flag, flagIndex) => {
        // Determine severity based on flag type
        let severity = 'Low';
        const flagType = (flag.type || '').toLowerCase();
        const flagMessage = (flag.message || flag.type || '').toLowerCase();
        
        if (
          flagType.includes('face-missing') ||
          flagType.includes('face-not-detected') ||
          flagType.includes('no-face') ||
          flagType.includes('multiple-faces') ||
          flagMessage.includes('face not detected') ||
          flagMessage.includes('multiple faces')
        ) {
          severity = 'High';
        } else if (
          flagType.includes('tab-switch') ||
          flagType.includes('tab') ||
          flagType.includes('switch') ||
          flagMessage.includes('tab') ||
          flagMessage.includes('switch')
        ) {
          severity = 'Medium';
        }

        activityLogs.push({
          id: `${log._id.toString()}-${flagIndex}`,
          logId: log._id.toString(),
          timestamp: formattedTime,
          formattedDate: formattedDate,
          fullTimestamp: `${formattedDate} at ${formattedTime}`,
          timeAgo: timeText,
          student: log.student?.name || 'Unknown Student',
          studentEmail: log.student?.email || '',
          studentId: log.student?._id?.toString() || '',
          activity: flag.message || flag.type || 'Suspicious activity detected',
          flagType: flag.type || 'unknown',
          severity: severity,
          flagCount: flags.length,
          flagIndex: flagIndex + 1,
          action: severity === 'High' ? 'Flagged' : severity === 'Medium' ? 'Warning Sent' : 'Noted',
          // Include all flags for this log entry
          allFlags: flags.map(f => ({
            type: f.type || 'unknown',
            message: f.message || f.type || 'Unknown flag'
          }))
        });
      });
    });
    
    // Sort by timestamp (most recent first)
    activityLogs.sort((a, b) => {
      return new Date(b.formattedDate + ' ' + b.timestamp).getTime() - 
             new Date(a.formattedDate + ' ' + a.timestamp).getTime();
    });

    // Format submissions
    const formattedSubmissions = submissions.map((sub) => {
      const submittedAt = sub.submittedAt 
        ? new Date(sub.submittedAt).toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
          })
        : 'In Progress';
      
      const totalMarks = exam.totalMarks || 100;
      const score = sub.totalScore !== undefined && sub.totalScore !== null
        ? Math.round((sub.totalScore / totalMarks) * 100)
        : null;

      return {
        id: sub._id.toString(),
        student: sub.student?.name || 'Unknown Student',
        submittedAt: submittedAt,
        answered: sub.answers?.length || 0,
        totalQuestions: totalQuestions,
        score: score,
        status: sub.submittedAt ? 'Graded' : 'In Progress'
      };
    });

    // Format live students (students with recent proctoring activity)
    const liveStudentsData = recentLogs.reduce((acc, log) => {
      if (!log.student || !log.student._id) return acc;
      const studentId = log.student._id.toString();
      if (!acc[studentId]) {
        acc[studentId] = {
          id: studentId,
          name: log.student?.name || 'Unknown Student',
          status: 'Active',
          image: '👤',
          flags: [],
          flagCount: 0,
          severity: 'good'
        };
      }
      
      if (log.flags && log.flags.length > 0) {
        log.flags.forEach(flag => {
          if (!acc[studentId].flags.includes(flag.message || flag.type)) {
            acc[studentId].flags.push(flag.message || flag.type);
          }
        });
        acc[studentId].flagCount += log.flags.length;
        
        // Update severity based on flags
        const hasHighSeverity = log.flags.some(flag => 
          flag.type?.toLowerCase().includes('face') ||
          flag.type?.toLowerCase().includes('multiple') ||
          flag.type?.toLowerCase().includes('no face')
        );
        const hasMediumSeverity = log.flags.some(flag => 
          flag.type?.toLowerCase().includes('tab') ||
          flag.type?.toLowerCase().includes('switch')
        );
        
        if (hasHighSeverity) {
          acc[studentId].severity = 'critical';
          acc[studentId].status = 'Suspicious';
        } else if (hasMediumSeverity && acc[studentId].severity !== 'critical') {
          acc[studentId].severity = 'warning';
        }
      } else {
        if (!acc[studentId].flags.includes('Face Detected')) {
          acc[studentId].flags.push('Face Detected');
        }
        if (!acc[studentId].flags.includes('No Tab Switch')) {
          acc[studentId].flags.push('No Tab Switch');
        }
      }
      
      return acc;
    }, {});

    const liveStudents = Object.values(liveStudentsData);

    // Stats
    const stats = {
      totalStudents,
      activeStudents,
      completed,
      flaggedStudents,
      totalFlags,
      averageProgress
    };

    res.json({
      exam: exam.toObject(),
      stats,
      liveStudents,
      activityLogs,
      submissions: formattedSubmissions
    });
  } catch (err) {
    console.error('Error fetching exam details:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};