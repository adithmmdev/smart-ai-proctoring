import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  Users, 
  Video, 
  AlertTriangle, 
  CheckCircle, 
  Download, 
  RefreshCw,
  Eye,
  FileText,
  UserX,
  Monitor,
  XCircle,
  ChevronDown,
  ChevronUp,
  Users as UsersIcon
} from 'lucide-react';

interface ExamDetailViewProps {
  exam: any;
  onBack: () => void;
}

export default function ExamDetailView({ exam, onBack }: ExamDetailViewProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [examDetails, setExamDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedActivityLogs, setExpandedActivityLogs] = useState<Set<string>>(new Set());

  // Fetch exam details from API
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

        if (!exam._id && !exam.id) {
          setError('Invalid exam data');
          setLoading(false);
          return;
        }

        const examId = exam._id || exam.id;
        const response = await fetch(`http://localhost:3000/api/v1/exam/details/${examId}`, {
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
        setExamDetails(data);
        setError(null);
      } catch (err: any) {
        console.error('Error fetching exam details:', err);
        setError(err.message || 'Failed to load exam details');
      } finally {
        setLoading(false);
      }
    };

    fetchExamDetails();
    // Refresh every 30 seconds
    const interval = setInterval(fetchExamDetails, 30000);
    return () => clearInterval(interval);
  }, [exam._id, exam.id]);

  // Use API data if available, otherwise use exam prop
  const examData = examDetails?.exam || exam;
  const stats = examDetails?.stats || {
    totalStudents: 0,
    activeStudents: 0,
    completed: 0,
    flaggedStudents: 0,
    totalFlags: 0,
    averageProgress: 0
  };
  const liveStudents = examDetails?.liveStudents || [];
  const activityLogs = examDetails?.activityLogs || [];
  const submissions = examDetails?.submissions || [];

  // Format exam date and time
  const examDate = examData.date ? new Date(examData.date) : new Date();
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

  // Format duration
  const durationMinutes = examData.durationMinutes || examData.duration || 0;
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

  const totalQuestions = examData.totalQuestions || examData.questions?.length || 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Loading exam details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-sm text-red-600">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline" 
              onClick={onBack}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Dashboard</span>
            </Button>
          </div>
          <div className="flex items-center space-x-3">
            <Button 
              variant="outline"
              className="flex items-center space-x-2"
              onClick={() => window.location.reload()}
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </Button>
            <Button 
              variant="outline"
              className="flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Download Report</span>
            </Button>
            <Button 
              className="flex items-center space-x-2"
              style={{ backgroundColor: isMonitoring ? '#22c55e' : '#4444FF' }}
              onMouseEnter={(e) => !isMonitoring && (e.currentTarget.style.backgroundColor = '#3333EE')}
              onMouseLeave={(e) => !isMonitoring && (e.currentTarget.style.backgroundColor = '#4444FF')}
              onClick={() => setIsMonitoring(!isMonitoring)}
            >
              <Eye className="w-4 h-4" />
              <span>{isMonitoring ? 'Monitoring Active' : 'Start Monitoring'}</span>
            </Button>
          </div>
        </div>

        {/* Exam Summary Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <CardTitle className="text-2xl">{examData.title || examData.subject}</CardTitle>
                {examData.description && (
                  <CardDescription className="text-base">{examData.description}</CardDescription>
                )}
                <CardDescription className="flex items-center space-x-6 text-base flex-wrap gap-2">
                  <span className="flex items-center space-x-2">
                    <Calendar className="w-4 h-4" />
                    <span>{exam.date || formattedDate}</span>
                  </span>
                  <span className="flex items-center space-x-2">
                    <Clock className="w-4 h-4" />
                    <span>{exam.time || formattedTime}</span>
                  </span>
                  <span className="flex items-center space-x-2">
                    <Clock className="w-4 h-4" />
                    <span>Duration: {exam.duration || durationText}</span>
                  </span>
                  <span className="flex items-center space-x-2">
                    <FileText className="w-4 h-4" />
                    <span>{totalQuestions} Questions</span>
                  </span>
                  {examData.totalMarks && (
                    <span className="flex items-center space-x-2">
                      <FileText className="w-4 h-4" />
                      <span>{examData.totalMarks} Marks</span>
                    </span>
                  )}
                </CardDescription>
              </div>
              <Badge 
                variant="outline" 
                className="bg-green-50 border-green-200 text-green-700 px-4 py-2"
              >
                {stats.activeStudents > 0 ? 'Live' : 'Scheduled'}
              </Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Tabs Section */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="live-proctoring">Live Proctoring</TabsTrigger>
            <TabsTrigger value="activity-logs">Suspicious Activity</TabsTrigger>
            <TabsTrigger value="submissions">Submissions</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-3 gap-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Total Students</CardDescription>
                  <CardTitle className="text-3xl">{stats.totalStudents}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Users className="w-4 h-4" />
                    <span>Enrolled in exam</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Active Now</CardDescription>
                  <CardTitle className="text-3xl text-green-600">{stats.activeStudents}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Video className="w-4 h-4" />
                    <span>Currently taking exam</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardDescription>Completed</CardDescription>
                  <CardTitle className="text-3xl">{stats.completed}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <CheckCircle className="w-4 h-4" />
                    <span>Submitted exams</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <AlertTriangle className="w-5 h-5" />
                    <span>Flagged Activity</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Students Flagged</span>
                    <span className="text-2xl text-red-600">{stats.flaggedStudents}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Total Flags</span>
                    <span className="text-2xl text-orange-600">{stats.totalFlags}</span>
                  </div>
                  <div className="pt-4 border-t">
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => setActiveTab('activity-logs')}
                    >
                      View Activity Logs
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Monitor className="w-5 h-5" />
                    <span>Exam Progress</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Average Progress</span>
                    <span className="text-2xl" style={{ color: '#4444FF' }}>{stats.averageProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div 
                      className="h-3 rounded-full" 
                      style={{ width: `${stats.averageProgress}%`, backgroundColor: '#4444FF' }}
                    />
                  </div>
                  <div className="pt-4 border-t">
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => setActiveTab('submissions')}
                    >
                      View Submissions
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Live Proctoring Tab */}
          <TabsContent value="live-proctoring" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <Video className="w-5 h-5" />
                      <span>Live Student Monitoring</span>
                    </CardTitle>
                    <CardDescription className="mt-2">
                      Real-time webcam feeds with AI-powered proctoring
                    </CardDescription>
                  </div>
                  {isMonitoring && (
                    <Badge variant="outline" className="bg-green-50 border-green-200 text-green-700">
                      <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
                      Monitoring Active
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {liveStudents.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-600">No active students at the moment.</p>
                    <p className="text-sm text-gray-500 mt-2">Students will appear here when they start taking the exam.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-4">
                    {liveStudents.map((student) => (
                    <Card key={student.id} className="overflow-hidden">
                      <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center relative">
                        <span className="text-6xl">{student.image}</span>
                        {isMonitoring && (
                          <div className="absolute top-2 right-2">
                            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                          </div>
                        )}
                        {student.severity === 'critical' && (
                          <div className="absolute top-2 left-2">
                            <Badge variant="destructive" className="text-xs">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Alert
                            </Badge>
                          </div>
                        )}
                        {student.severity === 'warning' && (
                          <div className="absolute top-2 left-2">
                            <Badge variant="outline" className="text-xs bg-orange-50 border-orange-200 text-orange-700">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              Warning
                            </Badge>
                          </div>
                        )}
                      </div>
                      <CardContent className="p-3">
                        <p className="text-sm text-gray-900 mb-2">{student.name}</p>
                        <div className="space-y-1">
                          {student.flags.map((flag, idx) => (
                            <div key={idx} className="flex items-center space-x-1 text-xs text-gray-600">
                              {flag.includes('Not Detected') || flag.includes('Multiple') || flag.includes('Switched') ? (
                                <XCircle className="w-3 h-3 text-red-500" />
                              ) : (
                                <CheckCircle className="w-3 h-3 text-green-500" />
                              )}
                              <span>{flag}</span>
                            </div>
                          ))}
                        </div>
                        {student.flagCount > 0 && (
                          <div className="mt-2 pt-2 border-t">
                            <span className="text-xs text-red-600">
                              {student.flagCount} flag{student.flagCount > 1 ? 's' : ''}
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activity Logs Tab */}
          <TabsContent value="activity-logs" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5" />
                  <span>Suspicious Activity Logs</span>
                </CardTitle>
                <CardDescription>
                  AI-detected suspicious activities during the exam
                </CardDescription>
              </CardHeader>
              <CardContent>
                {activityLogs.length === 0 ? (
                  <div className="text-center py-8">
                    <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                    <p className="text-gray-600 font-medium">No suspicious activities detected.</p>
                    <p className="text-sm text-gray-500 mt-2">All students are following exam guidelines.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activityLogs.map((log) => {
                      const isExpanded = expandedActivityLogs.has(log.logId || log.id);
                      const hasMultipleFlags = log.allFlags && log.allFlags.length > 1;
                      
                      // Determine icon based on flag type
                      let IconComponent = AlertTriangle;
                      if (log.flagType?.includes('face-missing') || log.flagType?.includes('face-not-detected')) {
                        IconComponent = UserX;
                      } else if (log.flagType?.includes('multiple-faces')) {
                        IconComponent = UsersIcon;
                      } else if (log.flagType?.includes('tab-switch') || log.flagType?.includes('switch')) {
                        IconComponent = Monitor;
                      } else if (log.flagType?.includes('face-detected')) {
                        IconComponent = Eye;
                      }

                      return (
                        <div
                          key={log.id}
                          className={`p-4 rounded-lg border transition-all ${
                            log.severity === "High"
                              ? "bg-red-50 border-red-200 hover:bg-red-100"
                              : log.severity === "Medium"
                                ? "bg-yellow-50 border-yellow-200 hover:bg-yellow-100"
                                : "bg-blue-50 border-blue-200 hover:bg-blue-100"
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start space-x-3 flex-1">
                              <IconComponent
                                className={`w-5 h-5 mt-0.5 ${
                                  log.severity === "High"
                                    ? "text-red-500"
                                    : log.severity === "Medium"
                                      ? "text-yellow-500"
                                      : "text-blue-500"
                                }`}
                              />
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                  <p className="font-medium text-gray-900">
                                    {log.activity}
                                  </p>
                                  {log.flagCount > 1 && (
                                    <Badge variant="outline" className="text-xs">
                                      Flag {log.flagIndex} of {log.flagCount}
                                    </Badge>
                                  )}
                                </div>
                                <div className="mt-2 space-y-1">
                                  <p className="text-sm text-gray-600">
                                    <span className="font-medium">Student:</span> {log.student}
                                    {log.studentEmail && (
                                      <span className="text-gray-500"> ({log.studentEmail})</span>
                                    )}
                                  </p>
                                  <p className="text-sm text-gray-500">
                                    {log.fullTimestamp || `${log.formattedDate} at ${log.timestamp}`}
                                    {log.timeAgo && <span className="ml-2">• {log.timeAgo}</span>}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    Flag Type: <span className="font-mono">{log.flagType || 'unknown'}</span>
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="text-right ml-4 flex flex-col items-end space-y-2">
                              <Badge
                                variant={log.severity === 'High' ? 'destructive' : 'outline'}
                                className={
                                  log.severity === 'High'
                                    ? "bg-red-100 text-red-800 border-red-300"
                                    : log.severity === 'Medium'
                                      ? "bg-yellow-100 text-yellow-800 border-yellow-300"
                                      : "bg-blue-100 text-blue-800 border-blue-300"
                                }
                              >
                                {log.severity.toUpperCase()}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {log.action}
                              </Badge>
                              {hasMultipleFlags && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => {
                                    const logId = log.logId || log.id;
                                    setExpandedActivityLogs(prev => {
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
                          {isExpanded && hasMultipleFlags && log.allFlags && (
                            <div className="mt-4 pt-4 border-t border-gray-300">
                              <p className="text-xs font-medium text-gray-700 mb-2">
                                All Flags for this Session ({log.allFlags.length} total):
                              </p>
                              <div className="space-y-2">
                                {log.allFlags.map((flag: any, flagIdx: number) => {
                                  const flagSeverity = flag.type?.toLowerCase().includes('face-missing') || 
                                    flag.type?.toLowerCase().includes('multiple-faces') ? 'High' :
                                    flag.type?.toLowerCase().includes('tab-switch') ? 'Medium' : 'Low';
                                  
                                  return (
                                    <div
                                      key={flagIdx}
                                      className={`p-2 rounded text-xs ${
                                        flagSeverity === "High"
                                          ? "bg-red-100 border border-red-200"
                                          : flagSeverity === "Medium"
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
              </CardContent>
            </Card>
          </TabsContent>

          {/* Submissions Tab */}
          <TabsContent value="submissions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="w-5 h-5" />
                  <span>Exam Submissions</span>
                </CardTitle>
                <CardDescription>
                  Student submission status and scores
                </CardDescription>
              </CardHeader>
              <CardContent>
                {submissions.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-600">No submissions yet.</p>
                    <p className="text-sm text-gray-500 mt-2">Submissions will appear here once students submit their exams.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student Name</TableHead>
                        <TableHead>Submitted At</TableHead>
                        <TableHead>Answered</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {submissions.map((submission) => (
                      <TableRow key={submission.id}>
                        <TableCell>{submission.student}</TableCell>
                        <TableCell className="text-gray-600">{submission.submittedAt}</TableCell>
                        <TableCell>
                          {submission.answered}/{submission.totalQuestions}
                        </TableCell>
                        <TableCell>
                          {submission.score !== null ? (
                            <span 
                              className={
                                submission.score >= 90 
                                  ? 'text-green-600' 
                                  : submission.score >= 70 
                                  ? 'text-blue-600' 
                                  : 'text-orange-600'
                              }
                            >
                              {submission.score}%
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={submission.status === 'Graded' ? 'default' : 'outline'}
                            className={
                              submission.status === 'Graded'
                                ? 'bg-green-50 border-green-200 text-green-700'
                                : 'bg-blue-50 border-blue-200 text-blue-700'
                            }
                          >
                            {submission.status === 'In Progress' && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full mr-2 animate-pulse" />
                            )}
                            {submission.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

