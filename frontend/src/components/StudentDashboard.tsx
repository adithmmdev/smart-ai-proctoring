import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import {
  LayoutDashboard,
  FileText,
  Trophy,
  User,
  Calendar,
  Clock,
  AlertTriangle,
  BookOpen,
  CheckCircle,
  XCircle,
  Eye,
  UserX,
  MonitorOff,
  Ban,
} from "lucide-react";
import { ExamWindow } from "./ExamWindow";

export function StudentDashboard() {
  const [activeView, setActiveView] = useState("dashboard");
  const [inExam, setInExam] = useState(false);
  const [currentExam, setCurrentExam] = useState<any>(null);

  // Student data
  const [studentName, setStudentName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [studentRole, setStudentRole] = useState("");
  const [accountCreatedAt, setAccountCreatedAt] = useState<Date | null>(null);
  
  // Dashboard data
  const [stats, setStats] = useState({
    completedExams: 0,
    totalExams: 0,
    averageScore: 0,
    upcomingExamsCount: 0,
  });
  const [upcomingExams, setUpcomingExams] = useState<any[]>([]);
  const [examHistory, setExamHistory] = useState<any[]>([]);
  const [proctoringAlerts, setProctoringAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date()); // For real-time availability checking

  // Fetch student profile and dashboard data
  useEffect(() => {
    const fetchStudentData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        
        if (!token) {
          setError('Authentication required. Please login again.');
          setLoading(false);
          return;
        }

        // Fetch student profile
        const profileResponse = await fetch('http://localhost:3000/api/v1/auth/me', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });

            if (profileResponse.ok) {
              const profileData = await profileResponse.json();
              setStudentName(profileData.name || 'Student');
              setStudentId(profileData._id || '');
              setStudentEmail(profileData.email || '');
              setStudentRole(profileData.role || 'student');
              setAccountCreatedAt(profileData.createdAt ? new Date(profileData.createdAt) : null);
            }

        // Fetch dashboard stats
        const dashboardResponse = await fetch('http://localhost:3000/api/v1/student/dashboard', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!dashboardResponse.ok) {
          throw new Error(`Failed to fetch dashboard data: ${dashboardResponse.statusText}`);
        }

        const dashboardData = await dashboardResponse.json();
        setStats(dashboardData.stats || {
          completedExams: 0,
          totalExams: 0,
          averageScore: 0,
          upcomingExamsCount: 0,
        });
        // Process exams with real-time availability checking
        const processedExams = (dashboardData.upcomingExams || []).map((exam: any) => {
          const now = new Date();
          const examStartTime = exam.examStartTime ? new Date(exam.examStartTime) : null;
          const examEndTime = exam.examEndTime ? new Date(exam.examEndTime) : null;
          
          // Real-time availability check
          let isAvailable = false;
          let isExpired = false;
          
          if (examStartTime && examEndTime) {
            isAvailable = now >= examStartTime && now <= examEndTime;
            isExpired = now > examEndTime;
          } else if (exam.rawDate) {
            // Fallback to raw date if ISO times not available
            const examDate = new Date(exam.rawDate);
            const endTime = new Date(examDate.getTime() + (exam.durationInSeconds * 1000));
            isAvailable = now >= examDate && now <= endTime;
            isExpired = now > endTime;
          }
          
          // Determine status: completed > expired > available > scheduled
          let status = exam.status || 'scheduled';
          if (exam.status === 'completed') {
            status = 'completed';
          } else if (isExpired) {
            status = 'expired';
          } else if (isAvailable) {
            status = 'available';
          } else {
            status = 'scheduled';
          }
          
          return {
            ...exam,
            isActive: isAvailable && exam.status !== 'completed' && !isExpired,
            isExpired: isExpired && exam.status !== 'completed',
            status: status
          };
        });
        
        setUpcomingExams(processedExams);
        setExamHistory(dashboardData.recentResults || []);
        setProctoringAlerts(dashboardData.proctoringAlerts || []);
        setError(null);
      } catch (err: any) {
        console.error('Error fetching student dashboard data:', err);
        setError(err.message || 'Failed to load dashboard data');
        // Set default values on error
        setStats({
          completedExams: 0,
          totalExams: 0,
          averageScore: 0,
          upcomingExamsCount: 0,
        });
        setUpcomingExams([]);
        setExamHistory([]);
        setProctoringAlerts([]);
      } finally {
        setLoading(false);
      }
    };

    if (activeView === "dashboard" || activeView === "results") {
      fetchStudentData();
      // Refresh every 30 seconds
      const interval = setInterval(fetchStudentData, 30000);
      return () => clearInterval(interval);
    }
  }, [activeView]);

  // Real-time availability checking - update every 10 seconds
  useEffect(() => {
    if (upcomingExams.length === 0) return; // Don't run if no exams
    
    const updateAvailability = () => {
      setCurrentTime(new Date());
      setUpcomingExams(prevExams => 
        prevExams.map(exam => {
          const now = new Date();
          const examStartTime = exam.examStartTime ? new Date(exam.examStartTime) : null;
          const examEndTime = exam.examEndTime ? new Date(exam.examEndTime) : null;
          
          let isAvailable = false;
          let isExpired = false;
          
          if (examStartTime && examEndTime) {
            isAvailable = now >= examStartTime && now <= examEndTime;
            isExpired = now > examEndTime;
          } else if (exam.rawDate) {
            const examDate = new Date(exam.rawDate);
            const endTime = new Date(examDate.getTime() + (exam.durationInSeconds * 1000));
            isAvailable = now >= examDate && now <= endTime;
            isExpired = now > endTime;
          }
          
          // Don't override completed status
          if (exam.status === 'completed') {
            return exam;
          }
          
          // Determine status: expired > available > scheduled
          let status = exam.status || 'scheduled';
          if (isExpired) {
            status = 'expired';
          } else if (isAvailable) {
            status = 'available';
          } else {
            status = 'scheduled';
          }
          
          return {
            ...exam,
            isActive: isAvailable && !isExpired,
            isExpired: isExpired,
            status: status
          };
        })
      );
    };

    // Update immediately
    updateAvailability();

    // Update every 10 seconds for real-time availability
    const interval = setInterval(updateAvailability, 10000);
    return () => clearInterval(interval);
  }, [upcomingExams.length, activeView]); // Re-run when exams list changes or view changes

  // Handle starting an exam
  const handleStartExam = (exam: any) => {
    setCurrentExam(exam);
    setInExam(true);
  };

  // Handle exam submission/exit
  const handleExamComplete = () => {
    setInExam(false);
    setCurrentExam(null);
  };

  // If in exam mode, show the exam window
  if (inExam && currentExam) {
    return (
      <ExamWindow
        examData={currentExam}
        onExitExam={handleExamComplete}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#4444FF' }}>
                <BookOpen className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl text-gray-900">Student Dashboard</h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right mr-3">
                <p className="text-sm text-gray-900">{studentName}</p>
                <p className="text-xs text-gray-600">{studentId}</p>
              </div>
              <Avatar>
                <AvatarFallback className="text-white" style={{ backgroundColor: '#4444FF' }}>
                  AJ
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <nav className="w-64 bg-white border-r border-gray-200 min-h-screen">
          <div className="p-4">
            <div className="space-y-2">
              {[
                {
                  id: "dashboard",
                  label: "Dashboard",
                  icon: LayoutDashboard,
                },
                { id: "exams", label: "My Exams", icon: FileText },
                { id: "completed", label: "Completed Exams", icon: CheckCircle },
                { id: "results", label: "Results", icon: Trophy },
                { id: "profile", label: "Profile", icon: User },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors ${
                    activeView === item.id
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="flex-1 p-6">
          {activeView === "dashboard" && (
            <div className="space-y-6">
              {error && (
                <Card className="border-red-200 bg-red-50">
                  <CardContent className="pt-6">
                    <p className="text-sm text-red-600">{error}</p>
                  </CardContent>
                </Card>
              )}
              
              {loading && (
                <div className="text-center py-8">
                  <p className="text-gray-600">Loading dashboard data...</p>
                </div>
              )}

              {!loading && (
                <>
              {/* Welcome Header */}
              <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-100">
                <CardHeader>
                  <CardTitle className="text-gray-900">
                        Welcome back, {studentName || 'Student'}!
                  </CardTitle>
                  <CardDescription className="text-gray-700">
                        You have {stats.upcomingExamsCount} upcoming exam(s) and {stats.completedExams} completed exam(s). Good luck with your studies!
                  </CardDescription>
                </CardHeader>
              </Card>

                  {/* Statistics Cards */}
                  <div className="grid grid-cols-4 gap-6">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardDescription>Completed Exams</CardDescription>
                        <CardTitle className="text-3xl" style={{ color: '#4444FF' }}>
                          {stats.completedExams}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <CheckCircle className="w-4 h-4" />
                          <span>Total: {stats.totalExams}</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardDescription>Average Score</CardDescription>
                        <CardTitle className="text-3xl text-green-600">
                          {stats.averageScore}%
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Progress value={stats.averageScore} className="h-2" />
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardDescription>Upcoming Exams</CardDescription>
                        <CardTitle className="text-3xl text-blue-600">
                          {stats.upcomingExamsCount}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4" />
                          <span>Scheduled</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardDescription>Available Now</CardDescription>
                        <CardTitle className="text-3xl text-green-600">
                          {upcomingExams.filter(e => e.isActive).length}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Clock className="w-4 h-4" />
                          <span>Ready to start</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardDescription>Expired Exams</CardDescription>
                        <CardTitle className="text-3xl text-red-600">
                          {upcomingExams.filter(e => e.status === 'expired').length}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <Ban className="w-4 h-4" />
                          <span>Missed deadline</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

              {/* Grid layout for cards */}
              <div className="grid grid-cols-2 gap-6">
                {/* Upcoming Exams */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Calendar className="w-5 h-5" />
                      <span>Upcoming Exams</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {upcomingExams.length > 0 ? (
                      upcomingExams.slice(0, 3).map((exam) => (
                      <div
                        key={exam.id}
                        className="p-4 bg-gray-50 rounded-lg space-y-3"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-gray-900">{exam.subject}</p>
                            <p className="text-sm text-gray-600 mt-1">
                              {exam.date} • {exam.time}
                            </p>
                          </div>
                          <Badge 
                            variant="outline" 
                            className={
                              exam.status === 'completed'
                                ? "bg-gray-50 border-gray-200 text-gray-700"
                                : exam.status === 'expired'
                                  ? "bg-red-50 border-red-200 text-red-700"
                                  : exam.isActive
                                    ? "bg-green-50 border-green-200 text-green-700"
                                    : exam.status === 'available'
                                      ? "bg-yellow-50 border-yellow-200 text-yellow-700"
                                      : "bg-blue-50 border-blue-200 text-blue-700"
                            }
                          >
                            {exam.status === 'completed' 
                              ? "Completed" 
                              : exam.status === 'expired'
                                ? "Expired"
                                : exam.isActive 
                                  ? "Available Now" 
                                  : exam.status === 'available'
                                    ? "Available Soon"
                                    : "Scheduled"}
                          </Badge>
                        </div>
                        <Button
                          onClick={() => exam.isActive && handleStartExam(exam)}
                          variant={exam.isActive ? "default" : "outline"}
                          className="w-full"
                          style={exam.isActive ? { backgroundColor: '#4444FF' } : {}}
                          onMouseEnter={(e) => exam.isActive && (e.currentTarget.style.backgroundColor = '#3333EE')}
                          onMouseLeave={(e) => exam.isActive && (e.currentTarget.style.backgroundColor = '#4444FF')}
                          disabled={!exam.isActive || exam.status === 'completed' || exam.status === 'expired'}
                        >
                          <Clock className="w-4 h-4 mr-2" />
                          {exam.status === 'completed' 
                            ? "Completed" 
                            : exam.status === 'expired'
                              ? "Expired"
                              : exam.isActive 
                                ? "Start Exam" 
                                : exam.status === 'available'
                                  ? "Available Soon"
                                  : "Scheduled"}
                        </Button>
                      </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <Calendar className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                        <p className="text-sm">No upcoming exams</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Proctoring Alerts */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <AlertTriangle className="w-5 h-5" />
                      <span>Proctoring Alerts</span>
                    </CardTitle>
                    <CardDescription>
                      Recent warnings during exams
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {proctoringAlerts.length > 0 ? (
                      proctoringAlerts.map((alert) => (
                        <div
                          key={alert.id}
                          className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg"
                        >
                          {alert.alert.includes("Face not detected") ? (
                            <UserX className="w-4 h-4 text-red-500 mt-0.5" />
                          ) : alert.alert.includes("Tab switched") ? (
                            <MonitorOff className="w-4 h-4 text-yellow-500 mt-0.5" />
                          ) : (
                            <Eye className="w-4 h-4 text-red-500 mt-0.5" />
                          )}
                          <div className="flex-1">
                            <p className="text-sm text-gray-900">
                              {alert.alert}
                            </p>
                            <p className="text-xs text-gray-600 mt-1">
                              {alert.exam}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {alert.timestamp}
                            </p>
                          </div>
                          <Badge
                            variant={
                              alert.severity === "high"
                                ? "destructive"
                                : "secondary"
                            }
                            className="text-xs"
                          >
                            {alert.severity}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                        <p className="text-sm">No alerts! Keep it up!</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Recent Exam History */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Trophy className="w-5 h-5" />
                    <span>Recent Results</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Exam Name</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {examHistory.length > 0 ? (
                        examHistory.slice(0, 4).map((exam) => (
                        <TableRow key={exam.id}>
                          <TableCell className="font-medium">
                              {exam.examName}
                          </TableCell>
                          <TableCell>
                              {exam.submittedAt ? new Date(exam.submittedAt).toLocaleDateString('en-US', { 
                                year: 'numeric', 
                                month: 'short', 
                                day: 'numeric' 
                              }) : exam.examDate ? new Date(exam.examDate).toLocaleDateString('en-US', { 
                                year: 'numeric', 
                                month: 'short', 
                                day: 'numeric' 
                              }) : 'N/A'}
                            </TableCell>
                            <TableCell>
                              {exam.score !== null ? (
                            <span
                              className={
                                exam.score >= 90
                                  ? "text-green-600"
                                  : exam.score >= 70
                                    ? "text-blue-600"
                                    : "text-yellow-600"
                              }
                            >
                                  {exam.score}%
                            </span>
                              ) : (
                                <span className="text-gray-500">N/A</span>
                              )}
                          </TableCell>
                          <TableCell>
                            <Badge
                                variant={exam.status === 'completed' ? 'default' : 'outline'}
                              className={
                                  exam.status === 'completed'
                                    ? 'bg-green-50 text-green-700 border-green-200'
                                    : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                }
                              >
                                {exam.status === 'completed' ? 'Completed' : 'Pending'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                            <Trophy className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                            <p className="text-sm">No exam results yet</p>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
                </>
              )}
            </div>
          )}

          {activeView === "exams" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="w-5 h-5" />
                  <span>My Exams</span>
                </CardTitle>
                <CardDescription>
                  View all your scheduled and completed exams
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {upcomingExams.map((exam) => (
                  <div
                    key={exam.id}
                    className="p-4 bg-gray-50 rounded-lg space-y-3"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-gray-900">{exam.subject}</p>
                        <p className="text-sm text-gray-600 mt-1">
                          {exam.date} • {exam.time}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {exam.totalQuestions} questions
                        </p>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={
                          exam.status === 'completed'
                            ? "bg-gray-50 border-gray-200 text-gray-700"
                            : exam.status === 'expired'
                              ? "bg-red-50 border-red-200 text-red-700"
                              : exam.isActive
                                ? "bg-green-50 border-green-200 text-green-700"
                                : exam.status === 'available'
                                  ? "bg-yellow-50 border-yellow-200 text-yellow-700"
                                  : "bg-blue-50 border-blue-200 text-blue-700"
                        }
                      >
                        {exam.status === 'completed' 
                          ? "Completed" 
                          : exam.status === 'expired'
                            ? "Expired"
                            : exam.isActive 
                              ? "Available Now" 
                              : exam.status === 'available'
                                ? "Available Soon"
                                : exam.duration}
                      </Badge>
                    </div>
                    <Button
                      onClick={() => (exam.isActive || exam.isPaused) && handleStartExam(exam)}
                      variant={(exam.isActive || exam.isPaused) ? "default" : "outline"}
                      className="w-full"
                      style={(exam.isActive || exam.isPaused) ? { backgroundColor: '#4444FF' } : {}}
                      onMouseEnter={(e) => (exam.isActive || exam.isPaused) && (e.currentTarget.style.backgroundColor = '#3333EE')}
                      onMouseLeave={(e) => (exam.isActive || exam.isPaused) && (e.currentTarget.style.backgroundColor = '#4444FF')}
                      disabled={!exam.isActive && !exam.isPaused || exam.status === 'completed' || exam.status === 'expired'}
                    >
                      <Clock className="w-4 h-4 mr-2" />
                          {exam.status === 'completed' 
                            ? "Completed" 
                            : exam.status === 'expired'
                              ? "Expired"
                              : exam.isPaused
                                ? "Resume Exam"
                                : exam.isActive 
                                  ? "Start Exam" 
                                  : exam.status === 'available'
                                    ? "Available Soon"
                                    : "Scheduled"}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {activeView === "completed" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5" />
                    <span>Completed Exams</span>
                  </CardTitle>
                  <CardDescription>
                    All exams you have completed and submitted
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {examHistory.length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Exam Name</TableHead>
                          <TableHead>Date Completed</TableHead>
                          <TableHead>Score</TableHead>
                          <TableHead>Marks Obtained</TableHead>
                          <TableHead>Total Marks</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {examHistory.map((exam) => (
                          <TableRow key={exam.id}>
                            <TableCell className="font-medium">
                              {exam.examName || 'Unknown Exam'}
                            </TableCell>
                            <TableCell>
                              {exam.submittedAt
                                ? new Date(exam.submittedAt).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true,
                                  })
                                : exam.examDate
                                  ? new Date(exam.examDate).toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric',
                                    })
                                  : 'N/A'}
                            </TableCell>
                            <TableCell>
                              {exam.score !== null ? (
                                <span
                                  className={
                                    exam.score >= 90
                                      ? "text-green-600 font-semibold"
                                      : exam.score >= 70
                                        ? "text-blue-600 font-semibold"
                                        : exam.score >= 50
                                          ? "text-yellow-600 font-semibold"
                                          : "text-red-600 font-semibold"
                                  }
                                >
                                  {exam.score}%
                                </span>
                              ) : (
                                <span className="text-gray-500">N/A</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {exam.totalScore !== undefined ? (
                                <span className="text-gray-700 font-medium">
                                  {exam.totalScore}
                                </span>
                              ) : (
                                <span className="text-gray-500">N/A</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {exam.totalMarks ? (
                                <span className="text-gray-700">
                                  {exam.totalMarks}
                                </span>
                              ) : (
                                <span className="text-gray-500">N/A</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={exam.status === 'completed' ? 'default' : 'outline'}
                                className={
                                  exam.status === 'completed'
                                    ? exam.score !== null && exam.score >= 50
                                      ? 'bg-green-50 text-green-700 border-green-200'
                                      : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                    : 'bg-gray-50 text-gray-700 border-gray-200'
                                }
                              >
                                {exam.status === 'completed'
                                  ? exam.score !== null && exam.score >= 50
                                    ? 'Passed'
                                    : 'Failed'
                                  : 'Pending'}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-12">
                      <CheckCircle className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                      <p className="text-gray-600 text-lg font-medium mb-2">
                        No completed exams yet
                      </p>
                      <p className="text-gray-500 text-sm">
                        Complete exams to see your results here
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {activeView === "results" && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-4 gap-6">
                <Card>
                  <CardHeader className="pb-3">
                    <CardDescription>Total Exams Taken</CardDescription>
                    <CardTitle className="text-3xl" style={{ color: '#4444FF' }}>
                      {examHistory.length}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <CheckCircle className="w-4 h-4" />
                      <span>Completed</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardDescription>Average Score</CardDescription>
                    <CardTitle className="text-3xl text-green-600">
                      {examHistory.length > 0
                        ? Math.round(
                            examHistory.reduce((sum, exam) => sum + (exam.score || 0), 0) /
                              examHistory.length
                          )
                        : 0}
                      %
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Progress
                      value={
                        examHistory.length > 0
                          ? examHistory.reduce((sum, exam) => sum + (exam.score || 0), 0) /
                            examHistory.length
                          : 0
                      }
                      className="h-2"
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardDescription>Highest Score</CardDescription>
                    <CardTitle className="text-3xl text-blue-600">
                      {examHistory.length > 0
                        ? Math.max(...examHistory.map((exam) => exam.score || 0))
                        : 0}
                      %
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Trophy className="w-4 h-4" />
                      <span>Best Performance</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Results Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Trophy className="w-5 h-5" />
                  <span>Exam History & Results</span>
                </CardTitle>
                <CardDescription>
                  Your complete exam performance record
                </CardDescription>
              </CardHeader>
              <CardContent>
                  {examHistory.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Exam Name</TableHead>
                          <TableHead>Date Taken</TableHead>
                      <TableHead>Score</TableHead>
                          <TableHead>Marks Obtained</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {examHistory.map((exam) => (
                      <TableRow key={exam.id}>
                        <TableCell className="font-medium">
                              {exam.examName || 'Unknown Exam'}
                        </TableCell>
                        <TableCell>
                              {exam.submittedAt
                                ? new Date(exam.submittedAt).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                    hour12: true,
                                  })
                                : exam.examDate
                                  ? new Date(exam.examDate).toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric',
                                    })
                                  : 'N/A'}
                            </TableCell>
                            <TableCell>
                              {exam.score !== null ? (
                          <span
                            className={
                              exam.score >= 90
                                      ? "text-green-600 font-semibold"
                                : exam.score >= 70
                                        ? "text-blue-600 font-semibold"
                                        : exam.score >= 50
                                          ? "text-yellow-600 font-semibold"
                                          : "text-red-600 font-semibold"
                                  }
                                >
                                  {exam.score}%
                          </span>
                              ) : (
                                <span className="text-gray-500">N/A</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {exam.totalScore !== undefined && exam.totalMarks ? (
                                <span className="text-gray-700">
                                  {exam.totalScore} / {exam.totalMarks}
                                </span>
                              ) : (
                                <span className="text-gray-500">N/A</span>
                              )}
                        </TableCell>
                        <TableCell>
                          <Badge
                                variant={exam.status === 'completed' ? 'default' : 'outline'}
                            className={
                                  exam.status === 'completed'
                                    ? exam.score !== null && exam.score >= 50
                                      ? 'bg-green-50 text-green-700 border-green-200'
                                      : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                    : 'bg-gray-50 text-gray-700 border-gray-200'
                                }
                              >
                                {exam.status === 'completed'
                                  ? exam.score !== null && exam.score >= 50
                                    ? 'Passed'
                                    : 'Failed'
                                  : 'Pending'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                  ) : (
                    <div className="text-center py-12">
                      <Trophy className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                      <p className="text-gray-600 text-lg font-medium mb-2">
                        No exam results yet
                      </p>
                      <p className="text-gray-500 text-sm">
                        Complete exams to see your results here
                      </p>
                    </div>
                  )}
              </CardContent>
            </Card>
            </div>
          )}

          {activeView === "profile" && (
            <div className="space-y-6">
              {/* Profile Header Card */}
              <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-100">
                <CardHeader>
                  <div className="flex items-center space-x-6">
                    <Avatar className="w-24 h-24 border-4 border-white shadow-lg">
                      <AvatarFallback className="text-white text-3xl font-semibold" style={{ backgroundColor: '#4444FF' }}>
                        {studentName.split(' ').map(n => n[0]).join('').toUpperCase() || 'ST'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <CardTitle className="text-2xl text-gray-900 mb-2">{studentName || 'Student'}</CardTitle>
                      <CardDescription className="text-base mb-4">{studentEmail || 'No email provided'}</CardDescription>
                      <div className="flex items-center space-x-4">
                        <Badge className="bg-green-50 text-green-700 border-green-200 text-sm px-3 py-1">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Active Student
                        </Badge>
                        <Badge variant="outline" className="text-sm px-3 py-1">
                          {studentRole === 'admin' ? 'Administrator' : 'Student'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* Personal Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <User className="w-5 h-5" />
                    <span>Personal Information</span>
                  </CardTitle>
                  <CardDescription>
                    Your account details and information
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-gray-600">Full Name</p>
                      <p className="text-gray-900 text-lg">{studentName || 'Not provided'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-gray-600">Email Address</p>
                      <p className="text-gray-900 text-lg">{studentEmail || 'Not provided'}</p>
                  </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-gray-600">Student ID</p>
                      <p className="text-gray-900 text-lg font-mono">{studentId || 'Not available'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-gray-600">Account Type</p>
                      <Badge variant="outline" className="text-sm">
                        {studentRole === 'admin' ? 'Administrator' : 'Student'}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-gray-600">Account Created</p>
                      <p className="text-gray-900 text-lg">
                        {accountCreatedAt
                          ? accountCreatedAt.toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })
                          : 'Not available'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-gray-600">Account Status</p>
                      <Badge className="bg-green-50 text-green-700 border-green-200">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Active
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Performance Statistics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Trophy className="w-5 h-5" />
                    <span>Performance Overview</span>
                  </CardTitle>
                  <CardDescription>
                    Your exam performance and statistics
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <p className="text-sm text-blue-600 font-medium mb-1">Total Exams</p>
                      <p className="text-3xl font-bold text-blue-700">{examHistory.length}</p>
                      <p className="text-xs text-blue-600 mt-1">Completed</p>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-sm text-green-600 font-medium mb-1">Average Score</p>
                      <p className="text-3xl font-bold text-green-700">
                        {examHistory.length > 0
                          ? Math.round(
                              examHistory.reduce((sum, exam) => sum + (exam.score || 0), 0) /
                                examHistory.length
                            )
                          : 0}
                        %
                      </p>
                      <p className="text-xs text-green-600 mt-1">Overall Performance</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                      <p className="text-sm text-purple-600 font-medium mb-1">Highest Score</p>
                      <p className="text-3xl font-bold text-purple-700">
                        {examHistory.length > 0
                          ? Math.max(...examHistory.map((exam) => exam.score || 0))
                          : 0}
                        %
                      </p>
                      <p className="text-xs text-purple-600 mt-1">Best Performance</p>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                      <p className="text-sm text-orange-600 font-medium mb-1">Pass Rate</p>
                      <p className="text-3xl font-bold text-orange-700">
                        {examHistory.length > 0
                          ? Math.round(
                              (examHistory.filter((exam) => exam.score !== null && exam.score >= 50).length /
                                examHistory.length) *
                                100
                            )
                          : 0}
                        %
                      </p>
                      <p className="text-xs text-orange-600 mt-1">Exams Passed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="w-5 h-5" />
                    <span>Recent Exam Activity</span>
                  </CardTitle>
                  <CardDescription>
                    Your latest exam submissions and results
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {examHistory.length > 0 ? (
                    <div className="space-y-4">
                      {examHistory.slice(0, 5).map((exam) => (
                        <div
                          key={exam.id}
                          className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                        >
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{exam.examName || 'Unknown Exam'}</p>
                            <p className="text-sm text-gray-600 mt-1">
                              {exam.submittedAt
                                ? `Submitted on ${new Date(exam.submittedAt).toLocaleDateString('en-US', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                  })}`
                                : 'Not submitted'}
                            </p>
                          </div>
                          <div className="flex items-center space-x-4">
                            {exam.score !== null ? (
                              <div className="text-right">
                                <p
                                  className={`text-lg font-semibold ${
                                    exam.score >= 90
                                      ? 'text-green-600'
                                      : exam.score >= 70
                                        ? 'text-blue-600'
                                        : exam.score >= 50
                                          ? 'text-yellow-600'
                                          : 'text-red-600'
                                  }`}
                                >
                                  {exam.score}%
                                </p>
                                <p className="text-xs text-gray-500">
                                  {exam.totalScore} / {exam.totalMarks}
                                </p>
                              </div>
                            ) : (
                              <span className="text-gray-500">N/A</span>
                            )}
                            <Badge
                              variant={exam.status === 'completed' ? 'default' : 'outline'}
                              className={
                                exam.status === 'completed'
                                  ? exam.score !== null && exam.score >= 50
                                    ? 'bg-green-50 text-green-700 border-green-200'
                                    : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                  : 'bg-gray-50 text-gray-700 border-gray-200'
                              }
                            >
                              {exam.status === 'completed'
                                ? exam.score !== null && exam.score >= 50
                                  ? 'Passed'
                                  : 'Failed'
                                : 'Pending'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                      <p className="text-gray-600 font-medium">No exam activity yet</p>
                      <p className="text-sm text-gray-500 mt-1">
                        Complete exams to see your activity here
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Account Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Account Statistics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Total Exams Available</span>
                      <span className="font-semibold text-gray-900">{upcomingExams.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Exams Completed</span>
                      <span className="font-semibold text-gray-900">{examHistory.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Proctoring Alerts</span>
                      <span className="font-semibold text-gray-900">{proctoringAlerts.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Account Status</span>
                      <Badge className="bg-green-50 text-green-700 border-green-200">
                        Active
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => setActiveView('dashboard')}
                    >
                      <LayoutDashboard className="w-4 h-4 mr-2" />
                      Go to Dashboard
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => setActiveView('exams')}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      View My Exams
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => setActiveView('results')}
                    >
                      <Trophy className="w-4 h-4 mr-2" />
                      View Results
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-4 text-center text-sm text-gray-600">
        Smart AI Proctoring System © 2025
      </footer>
    </div>
  );
}
