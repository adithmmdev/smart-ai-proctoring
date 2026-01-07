const Submission = require('../models/submission');
const ProctoringLog = require('../models/proctorlog');
const Exam = require('../models/exam');
const User = require('../models/user');

const getOverviewStats = async (req, res) => {
  try {
    // Total Exams
    const totalExams = await Exam.countDocuments();

    // Active Students (students with proctoring logs in the last 30 minutes)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    const recentLogs = await ProctoringLog.find({
      timestamp: { $gte: thirtyMinutesAgo }
    }).distinct('student');
    const activeStudents = recentLogs.length;

    // Suspicious Activities (proctoring logs with flags)
    const suspiciousActivities = await ProctoringLog.find({
      flags: { $exists: true, $ne: [] }
    })
      .populate('student', 'name email')
      .populate('exam', 'title')
      .sort({ timestamp: -1 })
      .limit(10)
      .lean();

    // Format suspicious activities
    const formattedActivities = suspiciousActivities.map((log, index) => {
      const flags = log.flags || [];
      const mostSevereFlag = flags.length > 0 ? flags[0] : { type: 'unknown', message: 'Activity detected' };
      
      // Determine severity based on flag type
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

      // Calculate time ago
      const timeAgo = Math.floor((Date.now() - new Date(log.timestamp).getTime()) / (1000 * 60));
      let timeText = `${timeAgo} min ago`;
      if (timeAgo < 1) timeText = 'Just now';
      else if (timeAgo >= 60) timeText = `${Math.floor(timeAgo / 60)} hour${Math.floor(timeAgo / 60) > 1 ? 's' : ''} ago`;

      return {
        id: log._id.toString(),
        student: log.student?.name || 'Unknown Student',
        activity: mostSevereFlag.message || mostSevereFlag.type || 'Suspicious activity detected',
        time: timeText,
        severity: severity
      };
    });

    // Completed Reports (total submissions)
    const completedReports = await Submission.countDocuments();

    // Get recent suspicious activities (last 3 for overview)
    const recentActivities = formattedActivities.slice(0, 3);

    res.json({
      stats: {
        totalExams,
        activeStudents,
        suspiciousActivities: formattedActivities.length,
        completedReports
      },
      recentActivities
    });
  } catch (err) {
    console.error('Error fetching overview stats:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const getExamReport = async (req, res) => {
  const { examId } = req.params;

  try {
    const submissions = await Submission.find({ exam: examId }).lean();
    const proctorLogs = await ProctoringLog.find({ exam: examId }).lean();
    const report = submissions.map(sub => {
      const logs = proctorLogs.filter(log => log.student.toString() === sub.student.toString());
      return { ...sub, proctorLogs: logs };
    });

    res.json({
      examId,
      totalSubmissions: submissions.length,
      report
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

const getStudentReport = async (req, res) => {
  const { studentId } = req.params;

  try {
    const submissions = await Submission.find({ student: studentId }).lean();
    const proctorLogs = await ProctoringLog.find({ student: studentId }).lean();
    const report = submissions.map(sub => {
      const logs = proctorLogs.filter(log => log.exam.toString() === sub.exam.toString());
      return { ...sub, proctorLogs: logs };
    });

    res.json({
      studentId,
      totalExams: submissions.length,
      report
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

const getAllSuspiciousActivities = async (req, res) => {
  try {
    // Get all suspicious activities (proctoring logs with flags)
    const suspiciousActivities = await ProctoringLog.find({
      flags: { $exists: true, $ne: [] }
    })
      .populate('student', 'name email')
      .populate('exam', 'title date')
      .sort({ timestamp: -1 })
      .lean();

    // Format suspicious activities - create separate entries for each flag
    const formattedActivities = [];
    
    suspiciousActivities.forEach((log) => {
      const flags = log.flags || [];
      
      // If no flags, skip this log
      if (flags.length === 0) return;
      
      // Format timestamp
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
      flags.forEach((flag, index) => {
        // Determine severity based on flag type
        let severity = 'low';
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
          severity = 'high';
        } else if (
          flagType.includes('tab-switch') ||
          flagType.includes('tab') ||
          flagType.includes('switch') ||
          flagMessage.includes('tab') ||
          flagMessage.includes('switch')
        ) {
          severity = 'medium';
        }

        formattedActivities.push({
          id: `${log._id.toString()}-${index}`,
          logId: log._id.toString(),
          student: log.student?.name || 'Unknown Student',
          studentEmail: log.student?.email || '',
          studentId: log.student?._id?.toString() || '',
          exam: log.exam?.title || 'Unknown Exam',
          examId: log.exam?._id?.toString() || '',
          examDate: log.exam?.date || null,
          activity: flag.message || flag.type || 'Suspicious activity detected',
          flagType: flag.type || 'unknown',
          time: timeText,
          formattedDate: formattedDate,
          formattedTime: formattedTime,
          rawTimestamp: log.timestamp,
          severity: severity,
          flagCount: flags.length,
          flagIndex: index + 1,
          // Include all flags for this log entry
          allFlags: flags.map(f => ({
            type: f.type || 'unknown',
            message: f.message || f.type || 'Unknown flag'
          }))
        });
      });
    });
    
    // Sort by timestamp (most recent first)
    formattedActivities.sort((a, b) => {
      return new Date(b.rawTimestamp).getTime() - new Date(a.rawTimestamp).getTime();
    });

    res.json({
      activities: formattedActivities,
      total: formattedActivities.length
    });
  } catch (err) {
    console.error('Error fetching suspicious activities:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

module.exports = {
  getOverviewStats,
  getExamReport,
  getStudentReport,
  getAllSuspiciousActivities
};