import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { 
  ArrowLeft, 
  Plus, 
  Trash2, 
  Save,
  Send,
  FileText,
  Calendar,
  Clock,
  Award,
  Settings,
  Camera,
  Monitor,
  Eye,
  AlertTriangle,
  Pause,
  Shuffle,
  ArrowUpDown
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

interface Question {
  id: string;
  questionText: string;
  options: string[];
  correctAnswer: string;
  marks: number;
}

interface CreateExamProps {
  onBack: () => void;
  onSuccess?: () => void;
}

export default function CreateExam({ onBack, onSuccess }: CreateExamProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    date: '',
    duration: '',
    totalMarks: '',
    category: '',
    enableCameraMonitoring: false,
    detectTabSwitching: false,
    enableFaceDetection: false,
    enableAutoSubmission: true, // Default to enabled
    enablePause: false, // Default to disabled
    randomizeQuestions: false, // Randomize question order per student
    randomizeOptions: false, // Randomize option order per student
    maxAllowedViolations: '3'
  });

  const [questions, setQuestions] = useState<Question[]>([
    {
      id: Date.now().toString(),
      questionText: '',
      options: ['', '', '', ''],
      correctAnswer: '',
      marks: 0
    }
  ]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load draft from localStorage on mount
  useEffect(() => {
    const draft = localStorage.getItem('examDraft');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed.formData) {
          setFormData(parsed.formData);
        }
        if (parsed.questions) {
          setQuestions(parsed.questions);
        }
      } catch (err) {
        console.error('Error loading draft:', err);
      }
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: checked }));
  };

  const handleQuestionChange = (questionId: string, field: keyof Question, value: any) => {
    setQuestions(prev => 
      prev.map(q => {
        if (q.id === questionId) {
          if (field === 'options') {
            return { ...q, options: value };
          }
          return { ...q, [field]: value };
        }
        return q;
      })
    );
  };

  const handleOptionChange = (questionId: string, optionIndex: number, value: string) => {
    setQuestions(prev => 
      prev.map(q => {
        if (q.id === questionId) {
          const newOptions = [...q.options];
          newOptions[optionIndex] = value;
          return { ...q, options: newOptions };
        }
        return q;
      })
    );
  };

  const addQuestion = () => {
    setQuestions(prev => [...prev, {
      id: Date.now().toString(),
      questionText: '',
      options: ['', '', '', ''],
      correctAnswer: '',
      marks: 0
    }]);
  };

  const removeQuestion = (questionId: string) => {
    if (questions.length > 1) {
      setQuestions(prev => prev.filter(q => q.id !== questionId));
    } else {
      toast.error('At least one question is required');
    }
  };


  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Exam title is required';
    }
    if (!formData.date) {
      newErrors.date = 'Date & time is required';
    }
    if (!formData.duration || parseInt(formData.duration) <= 0) {
      newErrors.duration = 'Duration must be greater than 0';
    }
    if (!formData.totalMarks || parseInt(formData.totalMarks) <= 0) {
      newErrors.totalMarks = 'Total marks must be greater than 0';
    }
    if (!formData.category) {
      newErrors.category = 'Category is required';
    }

    // Validate questions
    questions.forEach((question, index) => {
      if (!question.questionText.trim()) {
        newErrors[`question_${index}`] = `Question ${index + 1}: Question text is required`;
      }
      if (question.options.filter(opt => opt.trim()).length < 4) {
        newErrors[`question_${index}_options`] = `Question ${index + 1}: All 4 options are required`;
      }
      if (!question.correctAnswer) {
        newErrors[`question_${index}_correct`] = `Question ${index + 1}: Correct answer must be selected`;
      }
      if (!question.marks || question.marks <= 0) {
        newErrors[`question_${index}_marks`] = `Question ${index + 1}: Marks must be greater than 0`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const saveDraft = () => {
    const draft = {
      formData,
      questions,
      savedAt: new Date().toISOString()
    };
    localStorage.setItem('examDraft', JSON.stringify(draft));
    toast.success('Draft saved successfully!');
  };

  const handlePublish = async () => {
    if (!validateForm()) {
      toast.error('Please fix all errors before publishing');
      return;
    }

    setIsSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        toast.error('Authentication required. Please login again.');
        setIsSubmitting(false);
        return;
      }

      // Format questions for backend
      const formattedQuestions = questions.map(q => ({
        questionText: q.questionText,
        options: q.options,
        correctAnswer: q.correctAnswer,
        marks: q.marks
      }));

      // Calculate total marks from questions if not provided
      const calculatedTotalMarks = questions.reduce((sum, q) => sum + (q.marks || 0), 0);
      const totalMarks = formData.totalMarks 
        ? parseInt(formData.totalMarks) 
        : calculatedTotalMarks;

      const examData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        date: new Date(formData.date).toISOString(),
        duration: parseInt(formData.duration),
        totalMarks: totalMarks,
        questions: formattedQuestions,
        // Proctoring settings (can be stored in exam metadata if needed)
        proctoringSettings: {
          enableCameraMonitoring: formData.enableCameraMonitoring,
          detectTabSwitching: formData.detectTabSwitching,
          enableFaceDetection: formData.enableFaceDetection,
          enableAutoSubmission: formData.enableAutoSubmission,
          enablePause: formData.enablePause,
          randomizeQuestions: formData.randomizeQuestions,
          randomizeOptions: formData.randomizeOptions,
          maxAllowedViolations: Number(formData.maxAllowedViolations)
        }
      };

      const response = await axios.post('http://localhost:3000/api/v1/exam', examData, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 201) {
        // Clear draft after successful publish
        localStorage.removeItem('examDraft');
        toast.success('Exam published successfully!');
        
        // Reset form
        setFormData({
          title: '',
          description: '',
          date: '',
          duration: '',
          totalMarks: '',
          category: '',
          enableCameraMonitoring: false,
          detectTabSwitching: false,
          enableFaceDetection: false,
          enableAutoSubmission: true,
          enablePause: false,
          randomizeQuestions: false,
          randomizeOptions: false,
          maxAllowedViolations: '3'
        });
        setQuestions([{
          id: Date.now().toString(),
          questionText: '',
          options: ['', '', '', ''],
          correctAnswer: '',
          marks: 0
        }]);

        if (onSuccess) {
          onSuccess();
        }
      }
    } catch (error: any) {
      console.error('Error publishing exam:', error);
      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || 'Failed to publish exam';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
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
            <div>
              <h1 className="text-3xl font-bold" style={{ fontFamily: 'Inter, sans-serif' }}>Create New Exam</h1>
              <p className="text-gray-600 mt-1">Fill in the details to create a new examination</p>
            </div>
          </div>
        </div>

        {/* Main Form Card */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="w-5 h-5" />
              <span>Exam Details</span>
            </CardTitle>
            <CardDescription>Basic information about the exam</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="title">Exam Title *</Label>
                <Input
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleInputChange}
                  placeholder="e.g., Mathematics Final Exam"
                  className={errors.title ? 'border-red-500' : ''}
                />
                {errors.title && <p className="text-sm text-red-500">{errors.title}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category/Subject *</Label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  className={`w-full px-3 py-2 border rounded-md ${errors.category ? 'border-red-500' : 'border-gray-300'}`}
                >
                  <option value="">Select Category</option>
                  <option value="Mathematics">Mathematics</option>
                  <option value="Science">Science</option>
                  <option value="English">English</option>
                  <option value="History">History</option>
                  <option value="Computer Science">Computer Science</option>
                  <option value="Physics">Physics</option>
                  <option value="Chemistry">Chemistry</option>
                  <option value="Biology">Biology</option>
                  <option value="Other">Other</option>
                </select>
                {errors.category && <p className="text-sm text-red-500">{errors.category}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="Enter exam description..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <Label htmlFor="date" className="flex items-center space-x-2">
                  <Calendar className="w-4 h-4" />
                  <span>Date & Time *</span>
                </Label>
                <Input
                  id="date"
                  name="date"
                  type="datetime-local"
                  value={formData.date}
                  onChange={handleInputChange}
                  className={errors.date ? 'border-red-500' : ''}
                />
                {errors.date && <p className="text-sm text-red-500">{errors.date}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration" className="flex items-center space-x-2">
                  <Clock className="w-4 h-4" />
                  <span>Duration (minutes) *</span>
                </Label>
                <Input
                  id="duration"
                  name="duration"
                  type="number"
                  value={formData.duration}
                  onChange={handleInputChange}
                  placeholder="e.g., 60"
                  min="1"
                  className={errors.duration ? 'border-red-500' : ''}
                />
                {errors.duration && <p className="text-sm text-red-500">{errors.duration}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="totalMarks" className="flex items-center space-x-2">
                  <Award className="w-4 h-4" />
                  <span>Total Marks *</span>
                </Label>
                <Input
                  id="totalMarks"
                  name="totalMarks"
                  type="number"
                  value={formData.totalMarks}
                  onChange={handleInputChange}
                  placeholder="e.g., 100"
                  min="1"
                  className={errors.totalMarks ? 'border-red-500' : ''}
                />
                {errors.totalMarks && <p className="text-sm text-red-500">{errors.totalMarks}</p>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Questions Section */}
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center space-x-2">
                  <FileText className="w-5 h-5" />
                  <span>Questions</span>
                </CardTitle>
                <CardDescription>Add questions for the exam</CardDescription>
              </div>
              <Button 
                onClick={addQuestion}
                className="flex items-center space-x-2"
                style={{ background: 'linear-gradient(135deg, #2563EB 0%, #1d4ed8 100%)' }}
              >
                <Plus className="w-4 h-4" />
                <span>Add Question</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {questions.map((question, questionIndex) => (
              <Card key={question.id} className="border-2 border-gray-200">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">Question {questionIndex + 1}</CardTitle>
                    {questions.length > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeQuestion(question.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Question Text *</Label>
                    <Input
                      value={question.questionText}
                      onChange={(e) => handleQuestionChange(question.id, 'questionText', e.target.value)}
                      placeholder="Enter your question here..."
                      className={errors[`question_${questionIndex}`] ? 'border-red-500' : ''}
                    />
                    {errors[`question_${questionIndex}`] && (
                      <p className="text-sm text-red-500">{errors[`question_${questionIndex}`]}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {question.options.map((option, optionIndex) => (
                      <div key={optionIndex} className="space-y-2">
                        <Label>Option {String.fromCharCode(65 + optionIndex)}</Label>
                        <Input
                          value={option}
                          onChange={(e) => handleOptionChange(question.id, optionIndex, e.target.value)}
                          placeholder={`Option ${String.fromCharCode(65 + optionIndex)}`}
                          className={errors[`question_${questionIndex}_options`] ? 'border-red-500' : ''}
                        />
                      </div>
                    ))}
                  </div>
                  {errors[`question_${questionIndex}_options`] && (
                    <p className="text-sm text-red-500">{errors[`question_${questionIndex}_options`]}</p>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Correct Answer *</Label>
                      <select
                        value={question.correctAnswer}
                        onChange={(e) => handleQuestionChange(question.id, 'correctAnswer', e.target.value)}
                        className={`w-full px-3 py-2 border rounded-md ${errors[`question_${questionIndex}_correct`] ? 'border-red-500' : 'border-gray-300'}`}
                      >
                        <option value="">Select correct answer</option>
                        {question.options.map((option, idx) => (
                          option.trim() && (
                            <option key={idx} value={option}>
                              {String.fromCharCode(65 + idx)}: {option}
                            </option>
                          )
                        ))}
                      </select>
                      {errors[`question_${questionIndex}_correct`] && (
                        <p className="text-sm text-red-500">{errors[`question_${questionIndex}_correct`]}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Marks *</Label>
                      <Input
                        type="number"
                        value={question.marks || ''}
                        onChange={(e) => handleQuestionChange(question.id, 'marks', parseInt(e.target.value) || 0)}
                        placeholder="e.g., 5"
                        min="1"
                        className={errors[`question_${questionIndex}_marks`] ? 'border-red-500' : ''}
                      />
                      {errors[`question_${questionIndex}_marks`] && (
                        <p className="text-sm text-red-500">{errors[`question_${questionIndex}_marks`]}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>

        {/* Proctoring Settings */}
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="w-5 h-5" />
              <span>Proctoring Settings</span>
            </CardTitle>
            <CardDescription>Configure AI proctoring features</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="enableCameraMonitoring"
                  checked={formData.enableCameraMonitoring}
                  onChange={handleCheckboxChange}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div className="flex items-center space-x-2">
                  <Camera className="w-5 h-5 text-gray-600" />
                  <span className="font-medium">Enable Camera Monitoring</span>
                </div>
              </label>

              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="detectTabSwitching"
                  checked={formData.detectTabSwitching}
                  onChange={handleCheckboxChange}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div className="flex items-center space-x-2">
                  <Monitor className="w-5 h-5 text-gray-600" />
                  <span className="font-medium">Detect Tab Switching</span>
                </div>
              </label>

              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="enableFaceDetection"
                  checked={formData.enableFaceDetection}
                  onChange={handleCheckboxChange}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <div className="flex items-center space-x-2">
                  <Eye className="w-5 h-5 text-gray-600" />
                  <span className="font-medium">Enable Face Detection</span>
                </div>
              </label>

              <label className="flex items-start space-x-3 cursor-pointer pt-2 border-t">
                <input
                  type="checkbox"
                  name="enableAutoSubmission"
                  checked={formData.enableAutoSubmission}
                  onChange={handleCheckboxChange}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <AlertTriangle className="w-5 h-5 text-gray-600" />
                    <span className="font-medium">Enable Auto-Submission on Violations</span>
                  </div>
                  <p className="text-sm text-gray-500 ml-7">
                    {formData.enableAutoSubmission 
                      ? "Exam will be auto-submitted when violation limit is exceeded"
                      : "Violations will be recorded but exam won't auto-submit"}
                  </p>
                </div>
              </label>

              <label className="flex items-start space-x-3 cursor-pointer pt-2 border-t">
                <input
                  type="checkbox"
                  name="enablePause"
                  checked={formData.enablePause}
                  onChange={handleCheckboxChange}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <Pause className="w-5 h-5 text-gray-600" />
                    <span className="font-medium">Enable Pause Button</span>
                  </div>
                  <p className="text-sm text-gray-500 ml-7">
                    {formData.enablePause 
                      ? "Students can pause the exam and return to dashboard. Progress will be saved."
                      : "Pause button will be disabled. Students must complete the exam in one session."}
                  </p>
                </div>
              </label>

              <label className="flex items-start space-x-3 cursor-pointer pt-2 border-t">
                <input
                  type="checkbox"
                  name="randomizeQuestions"
                  checked={formData.randomizeQuestions}
                  onChange={handleCheckboxChange}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <Shuffle className="w-5 h-5 text-gray-600" />
                    <span className="font-medium">Randomize Question Order</span>
                  </div>
                  <p className="text-sm text-gray-500 ml-7">
                    {formData.randomizeQuestions 
                      ? "Questions will be shuffled individually for each student when they start the exam."
                      : "All students will see questions in the same order."}
                  </p>
                </div>
              </label>

              <label className="flex items-start space-x-3 cursor-pointer pt-2 border-t">
                <input
                  type="checkbox"
                  name="randomizeOptions"
                  checked={formData.randomizeOptions}
                  onChange={handleCheckboxChange}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <ArrowUpDown className="w-5 h-5 text-gray-600" />
                    <span className="font-medium">Randomize Option Order</span>
                  </div>
                  <p className="text-sm text-gray-500 ml-7">
                    {formData.randomizeOptions 
                      ? "Options for each question will be shuffled individually for each student when they start the exam."
                      : "All students will see options in the same order."}
                  </p>
                </div>
              </label>

              <div className="flex items-center space-x-4 pt-2 border-t">
                <Label htmlFor="maxAllowedViolations" className="w-48">Max Allowed Violations:</Label>
                <select
                  id="maxAllowedViolations"
                  name="maxAllowedViolations"
                  value={formData.maxAllowedViolations}
                  onChange={handleInputChange}
                  className="px-3 py-2 border border-gray-300 rounded-md"
                >
                  {[1, 2, 3, 4, 5].map(num => (
                    <option key={num} value={num.toString()}>{num}</option>
                  ))}
                </select>
              </div>

              {formData.enableAutoSubmission && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start space-x-2">
                  <AlertTriangle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> When auto-submission is enabled, the exam will automatically be submitted 
                    if the student exceeds the maximum allowed violations ({formData.maxAllowedViolations}).
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center justify-end space-x-4 pb-6">
          <Button
            variant="outline"
            onClick={saveDraft}
            className="flex items-center space-x-2"
            disabled={isSubmitting}
          >
            <Save className="w-4 h-4" />
            <span>Save as Draft</span>
          </Button>
          <Button
            onClick={handlePublish}
            disabled={isSubmitting}
            className="flex items-center space-x-2"
            style={{ 
              background: 'linear-gradient(135deg, #2563EB 0%, #1d4ed8 100%)',
              opacity: isSubmitting ? 0.7 : 1
            }}
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Publishing...</span>
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                <span>Publish Exam</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

