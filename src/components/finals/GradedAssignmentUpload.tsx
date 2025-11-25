/**
 * Graded Assignment Upload
 * 
 * Upload graded midterms, homework, quizzes for AI analysis.
 * Features:
 * - PDF upload
 * - Quick form for question details (optional)
 * - AI-powered error analysis
 * - Mastery tracking integration
 */

import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Upload, 
  FileText, 
  Plus, 
  Trash2, 
  AlertCircle,
  CheckCircle,
  Loader2,
  ArrowLeft,
  X,
  Sparkles,
  GraduationCap
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCourse, useTopics } from '@/hooks';
import { useAuth } from '@/components/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import LoadingScreen from '@/components/LoadingScreen';

interface QuestionEntry {
  id: string;
  questionNumber: number;
  questionText: string;
  studentAnswer: string;
  correctAnswer: string;
  pointsEarned: number;
  pointsTotal: number;
  topicId: string;
}

type AssignmentType = 'midterm' | 'homework' | 'quiz' | 'other';

const ASSIGNMENT_TYPES = [
  { value: 'midterm', label: 'Midterm' },
  { value: 'homework', label: 'Homework' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'other', label: 'Other' },
];

export function GradedAssignmentUpload() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [assignmentType, setAssignmentType] = useState<AssignmentType>('midterm');
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [solutionFile, setSolutionFile] = useState<File | null>(null);
  const [questions, setQuestions] = useState<QuestionEntry[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { data: course, isLoading: courseLoading } = useCourse(courseId!);
  const { data: topics } = useTopics(courseId!);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>, type: 'main' | 'solution') => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (type === 'main') {
        setFile(selectedFile);
      } else {
        setSolutionFile(selectedFile);
      }
    }
  }, []);

  const addQuestion = () => {
    setQuestions(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        questionNumber: prev.length + 1,
        questionText: '',
        studentAnswer: '',
        correctAnswer: '',
        pointsEarned: 0,
        pointsTotal: 10,
        topicId: '',
      }
    ]);
  };

  const updateQuestion = (id: string, field: keyof QuestionEntry, value: string | number) => {
    setQuestions(prev => prev.map(q => 
      q.id === id ? { ...q, [field]: value } : q
    ));
  };

  const removeQuestion = (id: string) => {
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  const calculateTotalScore = () => {
    const earned = questions.reduce((sum, q) => sum + (q.pointsEarned || 0), 0);
    const total = questions.reduce((sum, q) => sum + (q.pointsTotal || 0), 0);
    return { earned, total, percentage: total > 0 ? Math.round((earned / total) * 100) : 0 };
  };

  const handleSubmit = async () => {
    if (!user || !courseId) return;

    setIsUploading(true);
    setError(null);
    setUploadProgress(10);

    try {
      // Upload main file if provided
      let storagePath = null;
      if (file) {
        const fileName = `${user.id}/${courseId}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('user-content')
          .upload(fileName, file);

        if (uploadError) throw uploadError;
        storagePath = fileName;
        setUploadProgress(30);
      }

      // Upload solution file if provided
      let solutionPath = null;
      if (solutionFile) {
        const fileName = `${user.id}/${courseId}/${Date.now()}_solution_${solutionFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('user-content')
          .upload(fileName, solutionFile);

        if (uploadError) throw uploadError;
        solutionPath = fileName;
        setUploadProgress(50);
      }

      // Create graded assignment record
      const score = calculateTotalScore();
      const { data: assignment, error: assignmentError } = await supabase
        .from('graded_assignments')
        .insert({
          user_id: user.id,
          course_id: courseId,
          assignment_type: assignmentType,
          title: title || `${assignmentType} - ${new Date().toLocaleDateString()}`,
          storage_path: storagePath,
          solution_path: solutionPath,
          total_score: score.earned,
          max_score: score.total,
        })
        .select()
        .single();

      if (assignmentError) throw assignmentError;
      setUploadProgress(70);

      // Insert questions if any
      if (questions.length > 0) {
        const questionRecords = questions.map(q => ({
          assignment_id: assignment.id,
          question_number: q.questionNumber,
          question_text: q.questionText || null,
          student_answer: q.studentAnswer || null,
          correct_answer: q.correctAnswer || null,
          points_earned: q.pointsEarned,
          points_total: q.pointsTotal,
          topic_id: q.topicId || null,
        }));

        const { error: questionsError } = await supabase
          .from('graded_assignment_questions')
          .insert(questionRecords);

        if (questionsError) throw questionsError;
      }
      setUploadProgress(90);

      // Trigger AI analysis (if edge function is available)
      try {
        await supabase.functions.invoke('analyze-graded-assignment', {
          body: { assignment_id: assignment.id }
        });
      } catch (analysisError) {
        // Don't fail the upload if analysis fails
        console.warn('AI analysis failed:', analysisError);
      }

      setUploadProgress(100);
      setSuccess(true);

      // Redirect after success
      setTimeout(() => {
        navigate(`/course/${courseId}`);
      }, 2000);

    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'Failed to upload assignment');
    } finally {
      setIsUploading(false);
    }
  };

  if (courseLoading) {
    return <LoadingScreen message="Loading..." />;
  }

  if (!course) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-[#6B7280]">Course not found</p>
      </div>
    );
  }

  const score = calculateTotalScore();

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(`/course/${courseId}`)}
            className="flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#111827] transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Course
          </button>
          
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-[12px] bg-gradient-to-br from-[#10B981] to-[#059669] flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl tracking-tight">Upload Graded Assignment</h1>
              <p className="text-sm text-[#9CA3AF]">{course.code} • {course.name}</p>
            </div>
          </div>
        </div>

        {success ? (
          <div className="bg-white border border-[#E5E7EB] rounded-[16px] overflow-hidden">
            <div className="py-16 text-center px-8">
              <div className="w-16 h-16 rounded-full bg-[#D1FAE5] flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-[#10B981]" />
              </div>
              <h3 className="text-xl tracking-tight mb-2">Upload Complete!</h3>
              <p className="text-[#6B7280] mb-6">
                Your assignment has been uploaded and is being analyzed.
              </p>
              <div className="max-w-xs mx-auto h-2 bg-[#F3F4F6] rounded-full overflow-hidden">
                <div className="h-full bg-[#10B981] rounded-full" style={{ width: '100%' }} />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Assignment Details Section */}
            <div className="bg-white border border-[#E5E7EB] rounded-[16px] overflow-hidden">
              <div className="px-6 py-4 border-b border-[#E5E7EB] bg-gradient-to-br from-[#FAFAFA] to-white">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#4F46E5]" />
                  <h3 className="text-base font-medium">Assignment Details</h3>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-[#6B7280] mb-2 block">Type</label>
                    <Select value={assignmentType} onValueChange={(v) => setAssignmentType(v as AssignmentType)}>
                      <SelectTrigger className="h-11 rounded-[10px] border-[#E5E7EB] focus:ring-[#4F46E5] focus:border-[#4F46E5]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ASSIGNMENT_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm text-[#6B7280] mb-2 block">Title (optional)</label>
                    <Input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g., Midterm 1"
                      className="h-11 rounded-[10px] border-[#E5E7EB] focus:ring-[#4F46E5] focus:border-[#4F46E5]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* File Upload Section */}
            <div className="bg-white border border-[#E5E7EB] rounded-[16px] overflow-hidden">
              <div className="px-6 py-4 border-b border-[#E5E7EB] bg-gradient-to-br from-[#FAFAFA] to-white">
                <div className="flex items-center gap-2">
                  <Upload className="w-4 h-4 text-[#4F46E5]" />
                  <h3 className="text-base font-medium">Upload Files (Optional)</h3>
                </div>
              </div>
              <div className="p-6 space-y-6">
                {/* Main Assignment PDF */}
                <div>
                  <label className="text-sm text-[#6B7280] mb-3 block">Graded Assignment PDF</label>
                  {file ? (
                    <div className="flex items-center gap-3 p-4 bg-[#F5F3FF] border border-[#4F46E5]/20 rounded-[12px]">
                      <div className="w-10 h-10 rounded-[10px] bg-[#4F46E5] flex items-center justify-center">
                        <FileText className="w-5 h-5 text-white" />
                      </div>
                      <span className="flex-1 truncate text-sm">{file.name}</span>
                      <button
                        onClick={() => setFile(null)}
                        className="p-2 hover:bg-white rounded-[8px] transition-colors"
                      >
                        <X className="w-4 h-4 text-[#6B7280]" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-[#E5E7EB] rounded-[12px] cursor-pointer hover:border-[#4F46E5] hover:bg-[#F5F3FF]/30 transition-all duration-200">
                      <div className="w-12 h-12 rounded-full bg-[#F5F3FF] flex items-center justify-center">
                        <Upload className="w-6 h-6 text-[#4F46E5]" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm text-[#111827]">Drop files or click to browse</p>
                        <p className="text-xs text-[#9CA3AF] mt-1">PDF files only</p>
                      </div>
                      <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={(e) => handleFileChange(e, 'main')}
                      />
                    </label>
                  )}
                </div>

                {/* Solution PDF */}
                <div>
                  <label className="text-sm text-[#6B7280] mb-3 block">Solution/Rubric PDF (Optional)</label>
                  {solutionFile ? (
                    <div className="flex items-center gap-3 p-4 bg-[#D1FAE5]/30 border border-[#10B981]/20 rounded-[12px]">
                      <div className="w-10 h-10 rounded-[10px] bg-[#10B981] flex items-center justify-center">
                        <FileText className="w-5 h-5 text-white" />
                      </div>
                      <span className="flex-1 truncate text-sm">{solutionFile.name}</span>
                      <button
                        onClick={() => setSolutionFile(null)}
                        className="p-2 hover:bg-white rounded-[8px] transition-colors"
                      >
                        <X className="w-4 h-4 text-[#6B7280]" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex items-center justify-center gap-3 p-6 border-2 border-dashed border-[#E5E7EB] rounded-[12px] cursor-pointer hover:border-[#10B981] hover:bg-[#D1FAE5]/10 transition-all duration-200">
                      <Upload className="w-5 h-5 text-[#9CA3AF]" />
                      <span className="text-sm text-[#9CA3AF]">Upload solution (optional)</span>
                      <input
                        type="file"
                        accept=".pdf"
                        className="hidden"
                        onChange={(e) => handleFileChange(e, 'solution')}
                      />
                    </label>
                  )}
                </div>
              </div>
            </div>

            {/* Questions Section */}
            <div className="bg-white border border-[#E5E7EB] rounded-[16px] overflow-hidden">
              <div className="px-6 py-4 border-b border-[#E5E7EB] bg-gradient-to-br from-[#FAFAFA] to-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#4F46E5]" />
                  <h3 className="text-base font-medium">Questions (Optional)</h3>
                </div>
                <button
                  onClick={addQuestion}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[#4F46E5] hover:bg-[#F5F3FF] rounded-[8px] transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add Question
                </button>
              </div>
              <div className="p-6">
                {questions.length === 0 ? (
                  <p className="text-sm text-[#9CA3AF] text-center py-6">
                    Add questions to get detailed AI feedback on each one
                  </p>
                ) : (
                  <div className="space-y-4">
                    {questions.map((q, index) => (
                      <div key={q.id} className="p-5 bg-[#FAFAFA] rounded-[12px] space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-[#111827]">Question {index + 1}</span>
                          <button
                            onClick={() => removeQuestion(q.id)}
                            className="p-1.5 hover:bg-white rounded-[6px] transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-[#EF4444]" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs text-[#6B7280] mb-1.5 block">Points Earned</label>
                            <Input
                              type="number"
                              value={q.pointsEarned}
                              onChange={(e) => updateQuestion(q.id, 'pointsEarned', Number(e.target.value))}
                              className="h-10 rounded-[8px] border-[#E5E7EB]"
                            />
                          </div>
                          <div>
                            <label className="text-xs text-[#6B7280] mb-1.5 block">Points Total</label>
                            <Input
                              type="number"
                              value={q.pointsTotal}
                              onChange={(e) => updateQuestion(q.id, 'pointsTotal', Number(e.target.value))}
                              className="h-10 rounded-[8px] border-[#E5E7EB]"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-xs text-[#6B7280] mb-1.5 block">Topic</label>
                          <Select
                            value={q.topicId}
                            onValueChange={(v) => updateQuestion(q.id, 'topicId', v)}
                          >
                            <SelectTrigger className="h-10 rounded-[8px] border-[#E5E7EB]">
                              <SelectValue placeholder="Select topic..." />
                            </SelectTrigger>
                            <SelectContent>
                              {topics?.map((topic) => (
                                <SelectItem key={topic.id} value={topic.id}>
                                  {topic.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <label className="text-xs text-[#6B7280] mb-1.5 block">Your Answer (optional)</label>
                          <Textarea
                            value={q.studentAnswer}
                            onChange={(e) => updateQuestion(q.id, 'studentAnswer', e.target.value)}
                            placeholder="What did you answer?"
                            rows={2}
                            className="rounded-[8px] border-[#E5E7EB] resize-none"
                          />
                        </div>
                      </div>
                    ))}

                    {/* Score Summary */}
                    <div className="p-4 bg-[#F5F3FF] border border-[#4F46E5]/10 rounded-[12px]">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-[#111827]">Total Score</span>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          score.percentage >= 70 
                            ? 'bg-[#D1FAE5] text-[#065F46]' 
                            : 'bg-[#FEE2E2] text-[#991B1B]'
                        }`}>
                          {score.earned} / {score.total} ({score.percentage}%)
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-3 p-4 bg-[#FEE2E2] border border-[#EF4444]/20 rounded-[12px]">
                <AlertCircle className="w-5 h-5 text-[#EF4444] flex-shrink-0" />
                <span className="text-sm text-[#991B1B]">{error}</span>
              </div>
            )}

            {/* Upload Progress */}
            {isUploading && (
              <div className="p-4 bg-[#F5F3FF] border border-[#4F46E5]/10 rounded-[12px] space-y-3">
                <div className="h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#4F46E5] rounded-full transition-all duration-300" 
                    style={{ width: `${uploadProgress}%` }} 
                  />
                </div>
                <p className="text-sm text-center text-[#6B7280]">
                  Uploading and analyzing...
                </p>
              </div>
            )}

            {/* Submit Button */}
            <button
              onClick={handleSubmit}
              disabled={isUploading || (!file && questions.length === 0)}
              className="w-full bg-gradient-to-r from-[#4F46E5] to-[#6366F1] hover:from-[#4338CA] hover:to-[#4F46E5] text-white px-6 py-4 rounded-[12px] transition-all duration-300 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="font-medium">Processing...</span>
                </>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  <span className="font-medium">Upload Assignment</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default GradedAssignmentUpload;
