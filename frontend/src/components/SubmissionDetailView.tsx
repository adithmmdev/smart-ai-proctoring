import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Progress } from './ui/progress';
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  CheckCircle, 
  XCircle,
  AlertTriangle,
  FileText,
  User,
  Award,
  Eye,
  Download,
  Flag
} from 'lucide-react';

interface SubmissionDetailViewProps {
  submission: any;
  onBack: () => void;
}

export default function SubmissionDetailView({ submission, onBack }: SubmissionDetailViewProps) {
  const [submissionDetails, setSubmissionDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSubmissionDetails = async () => {
      try {
        setLoading(true);
        setError(null);
        const token = localStorage.getItem('token');
        
        if (!token) {
          setError('Authentication required. Please login again.');
          setLoading(false);
          return;
        }

        if (!submission.id && !submission._id) {
          setError('Invalid submission data');
          setLoading(false);
          return;
        }

        const submissionId = submission.id || submission._id;
        const response = await fetch(`http://localhost:3000/api/v1/submission/details/${submissionId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch submission details: ${response.statusText}`);
        }

        const data = await response.json();
        setSubmissionDetails(data);
        setError(null);
      } catch (err: any) {
        console.error('Error fetching submission details:', err);
        setError(err.message || 'Failed to load submission details');
      } finally {
        setLoading(false);
      }
    };

    fetchSubmissionDetails();
  }, [submission.id, submission._id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Loading submission details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <p className="text-sm text-red-600">{error}</p>
              <Button variant="outline" onClick={onBack} className="mt-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Submissions
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!submissionDetails) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardContent className="pt-6">
              <p className="text-gray-600">No submission details found.</p>
              <Button variant="outline" onClick={onBack} className="mt-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Submissions
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const submissionData = submissionDetails.submission || submission;
  const detailedAnswers = submissionDetails.detailedAnswers || [];
  const proctoringIncidents = submissionDetails.proctoringIncidents || [];
  const statistics = submissionDetails.statistics || {
    totalQuestions: detailedAnswers.length,
    correctAnswers: detailedAnswers.filter((a: any) => a.isCorrect).length,
    totalPoints: detailedAnswers.reduce((sum: number, a: any) => sum + a.points, 0),
    maxPoints: submissionData.totalMarks || 100,
    accuracyPercentage: 0,
    scorePercentage: submissionData.score || 0
  };

  const totalQuestions = statistics.totalQuestions;
  const correctAnswers = statistics.correctAnswers;
  const totalPoints = statistics.totalPoints;
  const maxPoints = statistics.maxPoints;
  const accuracyPercentage = statistics.accuracyPercentage;

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button 
              variant="outline" 
              onClick={onBack}
              className="flex items-center space-x-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Submissions</span>
            </Button>
          </div>
          <div className="flex items-center space-x-3">
            <Button 
              variant="outline"
              className="flex items-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Download Report</span>
            </Button>
          </div>
        </div>

        {/* Submission Summary Card */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-2">
                <CardTitle className="text-2xl">Submission Details</CardTitle>
                <CardDescription className="flex items-center space-x-6 text-base">
                  <span className="flex items-center space-x-2">
                    <User className="w-4 h-4" />
                    <span>{submissionData.student}</span>
                  </span>
                  <span className="flex items-center space-x-2">
                    <FileText className="w-4 h-4" />
                    <span>{submissionData.exam}</span>
                  </span>
                  <span className="flex items-center space-x-2">
                    <Clock className="w-4 h-4" />
                    <span>Submitted: {submissionData.submittedAt}</span>
                  </span>
                </CardDescription>
              </div>
              <Badge 
                variant="outline" 
                className={`px-4 py-2 ${
                  submissionData.score >= 90 
                    ? 'bg-green-50 border-green-200 text-green-700' 
                    : submissionData.score >= 70 
                    ? 'bg-blue-50 border-blue-200 text-blue-700' 
                    : 'bg-orange-50 border-orange-200 text-orange-700'
                }`}
              >
                Score: {submissionData.score}%
              </Badge>
            </div>
          </CardHeader>
        </Card>

        {/* Statistics Grid */}
        <div className="grid grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Total Score</CardDescription>
              <CardTitle className="text-3xl" style={{ color: '#4444FF' }}>
                {submissionData.score}%
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={submissionData.score} className="h-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Correct Answers</CardDescription>
              <CardTitle className="text-3xl text-green-600">
                {correctAnswers}/{totalQuestions}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <CheckCircle className="w-4 h-4" />
                <span>{accuracyPercentage}% accuracy</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Points Earned</CardDescription>
              <CardTitle className="text-3xl">
                {totalPoints}/{maxPoints}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Award className="w-4 h-4" />
                <span>Total points</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Proctoring Flags</CardDescription>
              <CardTitle className="text-3xl text-orange-600">
                {proctoringIncidents.length}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Flag className="w-4 h-4" />
                <span>Incidents detected</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-3 gap-6">
          {/* Answer Details - Takes 2 columns */}
          <div className="col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="w-5 h-5" />
                  <span>Answer Review</span>
                </CardTitle>
                <CardDescription>
                  Detailed breakdown of student answers
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">#</TableHead>
                      <TableHead>Question</TableHead>
                      <TableHead>Student Answer</TableHead>
                      <TableHead>Correct Answer</TableHead>
                      <TableHead className="w-24">Status</TableHead>
                      <TableHead className="w-20">Points</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailedAnswers.map((answer) => (
                      <TableRow key={answer.id}>
                        <TableCell className="text-gray-600">{answer.id}</TableCell>
                        <TableCell className="max-w-xs">{answer.question}</TableCell>
                        <TableCell>
                          <span className={answer.isCorrect ? 'text-green-700' : 'text-red-700'}>
                            {answer.studentAnswer}
                          </span>
                        </TableCell>
                        <TableCell className="text-gray-600">{answer.correctAnswer}</TableCell>
                        <TableCell>
                          {answer.isCorrect ? (
                            <Badge variant="outline" className="bg-green-50 border-green-200 text-green-700">
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Correct
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-50 border-red-200 text-red-700">
                              <XCircle className="w-3 h-3 mr-1" />
                              Wrong
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {answer.points}/{answer.maxPoints || 2}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Proctoring Incidents - Takes 1 column */}
          <div className="col-span-1">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <AlertTriangle className="w-5 h-5" />
                  <span>Proctoring Report</span>
                </CardTitle>
                <CardDescription>
                  AI-detected incidents
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {proctoringIncidents.length > 0 ? (
                    proctoringIncidents.map((incident) => (
                      <div 
                        key={incident.id} 
                        className="p-3 bg-gray-50 rounded-lg border border-gray-200"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <Badge 
                            variant="outline"
                            className={
                              incident.severity === 'High' 
                                ? 'bg-red-50 border-red-200 text-red-700' 
                                : incident.severity === 'Medium'
                                ? 'bg-orange-50 border-orange-200 text-orange-700'
                                : 'bg-yellow-50 border-yellow-200 text-yellow-700'
                            }
                          >
                            {incident.severity}
                          </Badge>
                          <span className="text-xs text-gray-600">{incident.time}</span>
                        </div>
                        <p className="text-sm text-gray-900">{incident.incident}</p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-500" />
                      <p>No incidents detected</p>
                      <p className="text-xs mt-1">Clean proctoring session</p>
                    </div>
                  )}
                </div>

                {proctoringIncidents.length > 0 && (
                  <div className="mt-6 pt-4 border-t">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <div className="flex items-start space-x-2">
                        <AlertTriangle className="w-4 h-4 text-yellow-700 mt-0.5" />
                        <div className="text-xs text-yellow-800">
                          <p className="font-medium">Review Recommended</p>
                          <p className="mt-1">
                            {proctoringIncidents.length} incident{proctoringIncidents.length > 1 ? 's' : ''} detected during this exam session.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
