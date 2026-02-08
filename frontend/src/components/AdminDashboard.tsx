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
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "./ui/avatar";
import {
  Users,
  FileText,
  AlertTriangle,
  Calendar,
  Eye,
  Camera,
  Activity,
  Clock,
  CheckCircle,
  XCircle,
  Monitor,
  UserX,
  ChevronDown,
  ChevronUp,
  User,
} from "lucide-react";
import ExamDetailView from "./ExamDetailView";
import SubmissionDetailView from "./SubmissionDetailView";
import CreateExam from "./CreateExam";
import { AdminProfile } from "./AdminProfile";
import { Skeleton } from "./ui/skeleton";

export function AdminDashboard() {
  const [activeView, setActiveView] = useState("overview");
  const [selectedExam, setSelectedExam] = useState<any>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<any>(null);
  const [showCreateExam, setShowCreateExam] = useState(false);
  const [stats, setStats] = useState({
    totalExams: 0,
    activeStudents: 0,
    suspiciousActivities: 0,
    completedReports: 0,
  });
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upcomingExams, setUpcomingExams] = useState<any[]>([]);
  const [examsLoading, setExamsLoading] = useState(false);
  const [examsError, setExamsError] = useState<string | null>(null);
  const [suspiciousActivities, setSuspiciousActivities] = useState<any[]>([]);
  const [activitiesLoading, setActivitiesLoading] = useState(false);
  const [activitiesError, setActivitiesError] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionsError, setSubmissionsError] = useState<string | null>(null);
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(new Set());

  // Fetch overview stats from API
  useEffect(() => {
    const fetchOverviewStats = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('token');
        
        if (!token) {
          setError('Authentication required. Please login again.');
          setLoading(false);
          return;
        }

        const response = await fetch('https://smart-ai-proctoring.onrender.com/api/v1/report/overview', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch stats: ${response.statusText}`);
        }

        const data = await response.json();
        setStats(data.stats);
        setRecentActivities(data.recentActivities || []);
        setError(null);
      } catch (err: any) {
        console.error('Error fetching overview stats:', err);
        setError(err.message || 'Failed to load overview statistics');
        // Set default values on error
        setStats({
          totalExams: 0,
          activeStudents: 0,
          suspiciousActivities: 0,
          completedReports: 0,
        });
      } finally {
        setLoading(false);
      }
    };

    if (activeView === "overview") {
      fetchOverviewStats();
      // Refresh every 30 seconds
      const interval = setInterval(fetchOverviewStats, 30000);
      return () => clearInterval(interval);
    }
  }, [activeView]);

  // Fetch exams from API
  useEffect(() => {
    const fetchExams = async () => {
      try {
        setExamsLoading(true);
        setExamsError(null);
        const token = localStorage.getItem('token');
        
        if (!token) {
          setExamsError('Authentication required. Please login again.');
          setExamsLoading(false);
          return;
        }

        const response = await fetch('https://smart-ai-proctoring.onrender.com/api/v1/exam/get', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch exams: ${response.statusText}`);
        }

        const exams = await response.json();
        
        // Format exams for display
        const formattedExams = exams.map((exam: any) => {
          const examDate = new Date(exam.date);
          const formattedDate = examDate.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
          });
          
          // Start time
          const startTime = examDate.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
          });
          
          // Calculate end time (start time + duration in minutes)
          const endDate = new Date(examDate.getTime() + (exam.duration * 60 * 1000));
          const endTime = endDate.toLocaleTimeString('en-US', { 
            hour: 'numeric', 
            minute: '2-digit',
            hour12: true 
          });
          
          // Format time range
          const timeRange = `${startTime} - ${endTime}`;
          
          // Convert duration from minutes to readable format
          const durationHours = Math.floor(exam.duration / 60);
          const durationMinutes = exam.duration % 60;
          let durationText = '';
          if (durationHours > 0) {
            durationText = `${durationHours} hour${durationHours > 1 ? 's' : ''}`;
            if (durationMinutes > 0) {
              durationText += ` ${durationMinutes} min${durationMinutes > 1 ? 's' : ''}`;
            }
          } else {
            durationText = `${durationMinutes} min${durationMinutes > 1 ? 's' : ''}`;
          }

          return {
            id: exam._id,
            _id: exam._id,
            subject: exam.title,
            title: exam.title,
            description: exam.description,
            date: formattedDate,
            time: startTime,
            timeRange: timeRange,
            startTime: startTime,
            endTime: endTime,
            rawDate: exam.date,
            students: exam.studentCount || 0,
            duration: durationText,
            durationMinutes: exam.duration,
            totalQuestions: exam.totalQuestions || 0,
            totalMarks: exam.totalMarks,
            questions: exam.questions || [],
          };
        });

        setUpcomingExams(formattedExams);
        setExamsError(null);
      } catch (err: any) {
        console.error('Error fetching exams:', err);
        setExamsError(err.message || 'Failed to load exams');
        setUpcomingExams([]);
      } finally {
        setExamsLoading(false);
      }
    };

    if (activeView === "exams") {
      fetchExams();
    }
  }, [activeView]);

  // Fetch suspicious activities from API
  useEffect(() => {
    const fetchSuspiciousActivities = async () => {
      try {
        setActivitiesLoading(true);
        setActivitiesError(null);
        const token = localStorage.getItem('token');
        
        if (!token) {
          setActivitiesError('Authentication required. Please login again.');
          setActivitiesLoading(false);
          return;
        }

        const response = await fetch('https://smart-ai-proctoring.onrender.com/api/v1/report/activities', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch activities: ${response.statusText}`);
        }

        const data = await response.json();
        setSuspiciousActivities(data.activities || []);
        setActivitiesError(null);
      } catch (err: any) {
        console.error('Error fetching suspicious activities:', err);
        setActivitiesError(err.message || 'Failed to load suspicious activities');
        setSuspiciousActivities([]);
      } finally {
        setActivitiesLoading(false);
      }
    };

    if (activeView === "activities") {
      fetchSuspiciousActivities();
      // Refresh every 30 seconds
      const interval = setInterval(fetchSuspiciousActivities, 30000);
      return () => clearInterval(interval);
    }
  }, [activeView]);

  // Fetch submissions from API
  useEffect(() => {
    const fetchSubmissions = async () => {
      try {
        setSubmissionsLoading(true);
        setSubmissionsError(null);
        const token = localStorage.getItem('token');
        
        if (!token) {
          setSubmissionsError('Authentication required. Please login again.');
          setSubmissionsLoading(false);
          return;
        }

        const response = await fetch('https://smart-ai-proctoring.onrender.com/api/v1/submission/admin/all', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          let errorMessage = `Failed to fetch submissions: ${response.statusText}`;
          try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorData.error || errorMessage;
            console.error('Backend error:', errorData);
          } catch (parseErr) {
            const errorText = await response.text();
            console.error('Error response text:', errorText);
            errorMessage = errorText || errorMessage;
          }
          throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log('Submissions data received:', data);
        setSubmissions(data.submissions || []);
        setSubmissionsError(null);
      } catch (err: any) {
        console.error('Error fetching submissions:', err);
        setSubmissionsError(err.message || 'Failed to load submissions. Please check the backend console for details.');
        setSubmissions([]);
      } finally {
        setSubmissionsLoading(false);
      }
    };

    if (activeView === "submissions") {
      fetchSubmissions();
    }
  }, [activeView]);

  const liveStudents = [
    {
      id: 1,
      name: "John Smith",
      exam: "Mathematics Final",
      status: "active",
      duration: "45m",
      progress: 65,
    },
    {
      id: 2,
      name: "Sarah Johnson",
      exam: "Mathematics Final",
      status: "warning",
      duration: "42m",
      progress: 58,
    },
    {
      id: 3,
      name: "Mike Davis",
      exam: "Mathematics Final",
      status: "active",
      duration: "48m",
      progress: 72,
    },
    {
      id: 4,
      name: "Emma Wilson",
      exam: "Physics Midterm",
      status: "flagged",
      duration: "38m",
      progress: 45,
    },
  ];

  const StatCard = ({
    title,
    value,
    icon: Icon,
    trend,
    description,
  }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {trend && (
          <p className="text-xs text-muted-foreground">
            <span
              className={
                trend > 0 ? "text-green-600" : "text-red-600"
              }
            >
              {trend > 0 ? "+" : ""}
              {trend}%
            </span>{" "}
            from last month
          </p>
        )}
        {description && (
          <p className="text-xs text-muted-foreground">
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );

  const StudentWebcam = ({ student }) => (
    <div className="relative">
      <div className="w-48 h-36 bg-gray-200 rounded-lg flex items-center justify-center">
        <Camera className="w-8 h-8 text-gray-400" />
      </div>
      <div className="absolute -bottom-2 left-2 right-2">
        <div className="bg-white rounded-md shadow-sm p-2 text-xs">
          <div className="flex justify-between items-center">
            <span className="font-medium truncate">
              {student.name}
            </span>
            <Badge
              variant={
                student.status === "active"
                  ? "default"
                  : student.status === "warning"
                    ? "secondary"
                    : "destructive"
              }
              className="text-xs"
            >
              {student.status}
            </Badge>
          </div>
          <div className="text-gray-600 mt-1">
            {student.duration}
          </div>
          <Progress
            value={student.progress}
            className="mt-1 h-1"
          />
        </div>
      </div>
    </div>
  );

  // If showing create exam view
  if (showCreateExam) {
    return (
      <CreateExam 
        onBack={() => setShowCreateExam(false)} 
        onSuccess={() => {
          setShowCreateExam(false);
          // Refresh exams list if on exams view
          if (activeView === "exams") {
            // Trigger a refresh by updating state
            setActiveView("exams");
          }
        }}
      />
    );
  }

  // If an exam is selected, show the detail view
  if (selectedExam) {
    return <ExamDetailView exam={selectedExam} onBack={() => setSelectedExam(null)} />;
  }

  // If a submission is selected, show the submission detail view
  if (selectedSubmission) {
    return <SubmissionDetailView submission={selectedSubmission} onBack={() => setSelectedSubmission(null)} />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#4444FF' }}>
                <Eye className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">
                  Admin Dashboard
                </h1>
                <p className="text-sm text-gray-600">
                  Smart AI Proctoring System
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => setShowCreateExam(true)}
                className="flex items-center space-x-2"
                style={{ background: 'linear-gradient(135deg, #2563EB 0%, #1d4ed8 100%)' }}
              >
                <FileText className="w-4 h-4" />
                <span>Create Exam</span>
              </Button>
              <Badge
                variant="outline"
                className="bg-green-50 text-green-700 border-green-200"
              >
                <Activity className="w-3 h-3 mr-1" />
                System Online
              </Badge>
              <Avatar>
                <AvatarFallback>AD</AvatarFallback>
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
                  id: "overview",
                  label: "Overview",
                  icon: Monitor,
                },
                {
                  id: "exams",
                  label: "Upcoming Exams",
                  icon: Calendar,
                },
                {
                  id: "activities",
                  label: "Suspicious Activities",
                  icon: AlertTriangle,
                },
                {
                  id: "submissions",
                  label: "Submissions",
                  icon: FileText,
                },
                {
                  id: "profile",
                  label: "Admin Profile",
                  icon: User,
                },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors ${
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
          {activeView === "overview" && (
            <div className="space-y-6">
              {error && (
                <Card className="border-red-200 bg-red-50">
                  <CardContent className="pt-6">
                    <p className="text-sm text-red-600">{error}</p>
                  </CardContent>
                </Card>
              )}
              
              {loading && (
                <div className="py-6 space-y-4">
                  <div className="grid grid-cols-4 gap-4" aria-hidden="true">
                    {[...Array(4)].map((_, idx) => (
                      <Card key={idx}>
                        <CardContent className="pt-6 space-y-3">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-6 w-16" />
                          <Skeleton className="h-3 w-32" />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {!loading && (
                <>
                  {/* Statistics Cards */}
                  <div className="grid grid-cols-4 gap-6">
                    <StatCard
                      title="Total Exams"
                      value={stats.totalExams}
                      icon={FileText}
                    />
                    <StatCard
                      title="Active Students"
                      value={stats.activeStudents}
                      icon={Users}
                      description="Currently taking exams"
                    />
                    <StatCard
                      title="Suspicious Activities"
                      value={stats.suspiciousActivities}
                      icon={AlertTriangle}
                    />
                    <StatCard
                      title="Completed Reports"
                      value={stats.completedReports}
                      icon={CheckCircle}
                    />
                  </div>

                  {/* Quick Overview Cards */}
                  <div className="grid grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Recent Activity</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {recentActivities.length > 0 ? (
                          recentActivities.map((activity) => (
                            <div
                              key={activity.id}
                              className="flex items-center space-x-3"
                            >
                              <AlertTriangle
                                className={`w-4 h-4 ${
                                  activity.severity === "high"
                                    ? "text-red-500"
                                    : activity.severity === "medium"
                                      ? "text-yellow-500"
                                      : "text-blue-500"
                                }`}
                              />
                              <div className="flex-1">
                                <p className="text-sm font-medium">
                                  {activity.activity}
                                </p>
                                <p className="text-xs text-gray-600">
                                  {activity.student} •{" "}
                                  {activity.time}
                                </p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-gray-500 text-center py-4">
                            No recent suspicious activities
                          </p>
                        )}
                      </CardContent>
                    </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>System Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">
                        AI Detection
                      </span>
                      <Badge
                        variant="outline"
                        className="bg-green-50 text-green-700"
                      >
                        Online
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">
                        Camera Monitoring
                      </span>
                      <Badge
                        variant="outline"
                        className="bg-green-50 text-green-700"
                      >
                        Active
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">
                        Server Load
                      </span>
                      <span className="text-sm text-green-600">
                        68%
                      </span>
                    </div>
                    <Progress value={68} className="h-2" />
                  </CardContent>
                    </Card>
                  </div>
                </>
              )}
            </div>
          )}

          {activeView === "exams" && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2">
                    <Calendar className="w-5 h-5" />
                    <span>Upcoming Exams</span>
                  </CardTitle>
                  <Button
                    onClick={() => setShowCreateExam(true)}
                    className="flex items-center space-x-2"
                    style={{ background: 'linear-gradient(135deg, #2563EB 0%, #1d4ed8 100%)' }}
                  >
                    <FileText className="w-4 h-4" />
                    <span>Create New Exam</span>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {examsError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600 mb-4">
                    {examsError}
                  </div>
                )}
                
                {examsLoading && (
                  <div className="text-center py-8">
                    <p className="text-gray-600">Loading exams...</p>
                  </div>
                )}

                {!examsLoading && !examsError && (
                  <>
                    {upcomingExams.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-600">No exams found. Create your first exam to get started.</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Exam Title</TableHead>
                            <TableHead>Date & Time</TableHead>
                            <TableHead>Students</TableHead>
                            <TableHead>Duration</TableHead>
                            <TableHead>Questions</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {upcomingExams.map((exam) => (
                            <TableRow key={exam.id || exam._id}>
                              <TableCell className="font-medium">
                                {exam.subject || exam.title}
                              </TableCell>
                              <TableCell>
                                <div className="space-y-1">
                                  <div className="font-medium">{exam.date}</div>
                                  <div className="text-sm text-gray-600">
                                    <div>Start: {exam.startTime}</div>
                                    <div>End: {exam.endTime}</div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>{exam.students}</TableCell>
                              <TableCell>{exam.duration}</TableCell>
                              <TableCell>{exam.totalQuestions}</TableCell>
                              <TableCell>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setSelectedExam(exam)}
                                >
                                  View Details
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {activeView === "activities" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5" />
                  <span>Suspicious Activities</span>
                </CardTitle>
                <CardDescription>
                  AI-detected suspicious activities during exams
                </CardDescription>
              </CardHeader>
              <CardContent>
                {activitiesError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600 mb-4">
                    {activitiesError}
                  </div>
                )}
                
                {activitiesLoading && (
                  <div className="text-center py-8">
                    <p className="text-gray-600">Loading suspicious activities...</p>
                  </div>
                )}

                {!activitiesLoading && !activitiesError && (
                  <>
                    {suspiciousActivities.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-600">No suspicious activities detected.</p>
                        <p className="text-sm text-gray-500 mt-2">All students are following the exam guidelines.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {suspiciousActivities.map((activity) => {
                          const isExpanded = expandedActivities.has(activity.logId || activity.id);
                          const hasMultipleFlags = activity.allFlags && activity.allFlags.length > 1;
                          
                          // Determine icon based on flag type
                          let IconComponent = AlertTriangle;
                          if (activity.flagType?.includes('face-missing') || activity.flagType?.includes('face-not-detected')) {
                            IconComponent = UserX;
                          } else if (activity.flagType?.includes('multiple-faces')) {
                            IconComponent = Users;
                          } else if (activity.flagType?.includes('tab-switch') || activity.flagType?.includes('switch')) {
                            IconComponent = Monitor;
                          } else if (activity.flagType?.includes('face-detected')) {
                            IconComponent = Eye;
                          }

                          return (
                            <div
                              key={activity.id}
                              className={`p-4 rounded-lg border transition-all ${
                                activity.severity === "high"
                                  ? "bg-red-50 border-red-200 hover:bg-red-100"
                                  : activity.severity === "medium"
                                    ? "bg-yellow-50 border-yellow-200 hover:bg-yellow-100"
                                    : "bg-blue-50 border-blue-200 hover:bg-blue-100"
                              }`}
                            >
                              <div className="flex items-start justify-between">
                                <div className="flex items-start space-x-3 flex-1">
                                  <IconComponent
                                    className={`w-5 h-5 mt-0.5 ${
                                      activity.severity === "high"
                                        ? "text-red-500"
                                        : activity.severity === "medium"
                                          ? "text-yellow-500"
                                          : "text-blue-500"
                                    }`}
                                  />
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-2">
                                      <p className="font-medium text-gray-900">
                                        {activity.activity}
                                      </p>
                                      {activity.flagCount > 1 && (
                                        <Badge variant="outline" className="text-xs">
                                          Flag {activity.flagIndex} of {activity.flagCount}
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="mt-2 space-y-1">
                                      <p className="text-sm text-gray-600">
                                        <span className="font-medium">Student:</span> {activity.student}
                                        {activity.studentEmail && (
                                          <span className="text-gray-500"> ({activity.studentEmail})</span>
                                        )}
                                      </p>
                                      <p className="text-sm text-gray-600">
                                        <span className="font-medium">Exam:</span> {activity.exam}
                                      </p>
                                      <p className="text-sm text-gray-500">
                                        {activity.formattedDate} at {activity.formattedTime}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        Flag Type: <span className="font-mono">{activity.flagType || 'unknown'}</span>
                                      </p>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right ml-4 flex flex-col items-end space-y-2">
                                  <Badge
                                    variant={
                                      activity.severity === "high"
                                        ? "destructive"
                                        : activity.severity === "medium"
                                          ? "secondary"
                                          : "outline"
                                    }
                                    className={
                                      activity.severity === "high"
                                        ? "bg-red-100 text-red-800 border-red-300"
                                        : activity.severity === "medium"
                                          ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                                          : "bg-blue-100 text-blue-800 border-blue-300"
                                    }
                                  >
                                    {activity.severity.toUpperCase()}
                                  </Badge>
                                  <p className="text-xs text-gray-600">
                                    {activity.time}
                                  </p>
                                  {hasMultipleFlags && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 w-6 p-0"
                                      onClick={() => {
                                        const logId = activity.logId || activity.id;
                                        setExpandedActivities(prev => {
                                          const newSet = new Set(prev);
                                          if (newSet.has(logId)) {
                                            newSet.delete(logId);
                                          } else {
                                            newSet.add(logId);
                                          }
                                          return newSet;
                                        });
                                      }}
                                    >
                                      {isExpanded ? (
                                        <ChevronUp className="w-4 h-4" />
                                      ) : (
                                        <ChevronDown className="w-4 h-4" />
                                      )}
                                    </Button>
                                  )}
                                </div>
                              </div>
                              
                              {/* Expanded view showing all flags for this log entry */}
                              {isExpanded && hasMultipleFlags && activity.allFlags && (
                                <div className="mt-4 pt-4 border-t border-gray-300">
                                  <p className="text-xs font-medium text-gray-700 mb-2">
                                    All Flags for this Session ({activity.allFlags.length} total):
                                  </p>
                                  <div className="space-y-2">
                                    {activity.allFlags.map((flag: any, flagIdx: number) => {
                                      const flagSeverity = flag.type?.toLowerCase().includes('face-missing') || 
                                        flag.type?.toLowerCase().includes('multiple-faces') ? 'high' :
                                        flag.type?.toLowerCase().includes('tab-switch') ? 'medium' : 'low';
                                      
                                      return (
                                        <div
                                          key={flagIdx}
                                          className={`p-2 rounded text-xs ${
                                            flagSeverity === "high"
                                              ? "bg-red-100 border border-red-200"
                                              : flagSeverity === "medium"
                                                ? "bg-yellow-100 border border-yellow-200"
                                                : "bg-gray-100 border border-gray-200"
                                          }`}
                                        >
                                          <div className="flex items-center justify-between">
                                            <span className="font-medium">{flag.message || flag.type}</span>
                                            <Badge variant="outline" className="text-[10px]">
                                              {flag.type || 'unknown'}
                                            </Badge>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {activeView === "submissions" && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="w-5 h-5" />
                  <span>Student Submissions</span>
                </CardTitle>
                <CardDescription>
                  All student exam submissions and scores
                </CardDescription>
              </CardHeader>
              <CardContent>
                {submissionsError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600 mb-4">
                    {submissionsError}
                  </div>
                )}
                
                {submissionsLoading && (
                  <div className="text-center py-8">
                    <p className="text-gray-600">Loading submissions...</p>
                  </div>
                )}

                {!submissionsLoading && !submissionsError && (
                  <>
                    {submissions.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-gray-600">No submissions found.</p>
                        <p className="text-sm text-gray-500 mt-2">Submissions will appear here once students submit their exams.</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Student</TableHead>
                            <TableHead>Exam</TableHead>
                            <TableHead>Score</TableHead>
                            <TableHead>Questions</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Submitted At</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {submissions.map((submission) => (
                            <TableRow key={submission.id}>
                              <TableCell className="font-medium">
                                <div>
                                  <div>{submission.student}</div>
                                  {submission.studentEmail && (
                                    <div className="text-xs text-gray-500">{submission.studentEmail}</div>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>{submission.exam}</TableCell>
                              <TableCell>
                                {submission.score !== null && submission.score !== undefined ? (
                                  <span
                                    className={`font-medium ${
                                      submission.score >= 90
                                        ? "text-green-600"
                                        : submission.score >= 70
                                          ? "text-blue-600"
                                          : "text-red-600"
                                    }`}
                                  >
                                    {submission.score}%
                                  </span>
                                ) : (
                                  <span className="text-gray-400">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {submission.answered}/{submission.totalQuestions}
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={
                                    submission.status === "completed"
                                      ? "default"
                                      : "secondary"
                                  }
                                  className={
                                    submission.status === "completed"
                                      ? "bg-green-50 text-green-700 border-green-200"
                                      : "bg-yellow-50 text-yellow-700 border-yellow-200"
                                  }
                                >
                                  {submission.status === "completed" ? (
                                    <>
                                      <CheckCircle className="w-3 h-3 mr-1" />{" "}
                                      Completed
                                    </>
                                  ) : (
                                    <>
                                      <Clock className="w-3 h-3 mr-1" />{" "}
                                      Pending
                                    </>
                                  )}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-gray-600">
                                {submission.submittedAt}
                              </TableCell>
                              <TableCell>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => setSelectedSubmission(submission)}
                                >
                                  View Report
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {activeView === "profile" && (
            <AdminProfile />
          )}
        </main>
      </div>
    </div>
  );
}