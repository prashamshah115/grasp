/**
 * Finals Stress-Test Component
 * 
 * 20-minute adaptive test that aggressively selects questions from weakest topics
 * Uses KSV to pick questions, shows heatmap at end, updates KSV with results
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Clock, Target, TrendingUp, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useKnowledgeState, useTriggerKSVUpdate } from '@/hooks/useKnowledgeState';
import { useStartSession, useSubmitAnswer, useEndSession } from '@/hooks/useSessions';
import { useUpdateMastery } from '@/hooks/useMastery';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/auth/AuthProvider';
import LoadingScreen from '@/components/LoadingScreen';
import { QuestionCard } from '@/components/shared/QuestionCard';

interface FinalsStressTestProps {
  courseId: string;
}

interface TestQuestion {
  id: string;
  prompt: string;
  options?: string[];
  topic_id: string;
  topic_name: string;
  difficulty: number;
}

interface TestResult {
  questionsAnswered: number;
  correctAnswers: number;
  accuracy: number;
  strongTopics: string[];
  weakTopics: string[];
  timeSpent: number;
}

export function FinalsStressTest({ courseId }: FinalsStressTestProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [isStarted, setIsStarted] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(20 * 60); // 20 minutes in seconds
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  const { data: ksvData } = useKnowledgeState(courseId);
  const startSession = useStartSession();
  const submitAnswerMutation = useSubmitAnswer();
  const endSessionMutation = useEndSession();
  const updateMasteryMutation = useUpdateMastery();
  const triggerKSVUpdate = useTriggerKSVUpdate();

  // Fetch adaptive questions based on KSV
  const { isLoading: questionsLoading } = useQuery({
    queryKey: ['stress-test-questions', courseId],
    queryFn: async (): Promise<TestQuestion[]> => {
      if (!ksvData || ksvData.length === 0) return [];

      // Get weakest topics (prioritize lowest knowledge_strength)
      const sortedTopics = [...ksvData]
        .sort((a, b) => a.knowledge_strength - b.knowledge_strength)
        .slice(0, 10); // Top 10 weakest topics

      const questions: TestQuestion[] = [];

      // Get 1-2 questions per weak topic (aggressively biased toward weaknesses)
      for (const topic of sortedTopics) {
        const questionCount = topic.knowledge_strength < 0.3 ? 2 : 1;

        const { data: topicQuestions, error } = await supabase
          .from('questions')
          .select('id, prompt, options, topic_id, difficulty')
          .eq('course_id', courseId)
          .eq('topic_id', topic.topic_id)
          .in('difficulty', [2, 3]) // Medium to hard
          .limit(questionCount);

        if (!error && topicQuestions) {
          for (const q of topicQuestions) {
            questions.push({
              id: q.id,
              prompt: q.prompt,
              options: q.options as string[] | undefined,
              topic_id: q.topic_id,
              topic_name: topic.topic_name || 'Unknown',
              difficulty: q.difficulty || 2,
            });
          }
        }

        if (questions.length >= 15) break; // Max 15 questions for 20 min
      }

      // Shuffle questions
      return questions.sort(() => Math.random() - 0.5);
    },
    enabled: !!courseId && !!ksvData && ksvData.length > 0 && !isStarted,
  });

  // Timer countdown
  useEffect(() => {
    if (!isStarted || isCompleted || timeRemaining <= 0) return;

    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          handleComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isStarted, isCompleted, timeRemaining]);

  const handleStart = async () => {
    if (!user || questions.length === 0) return;

    try {
      // Create a practice session for stress test
      const session = await startSession.mutateAsync({
        user_id: user.id,
        course_id: courseId,
        mode: 'practice',
      });

      setSessionId(session.id);
      setIsStarted(true);
    } catch (error) {
      console.error('Failed to start stress test:', error);
    }
  };

  const handleAnswer = async (questionId: string, answer: string) => {
    if (!sessionId || !user) return;

    setAnswers(prev => ({ ...prev, [questionId]: answer }));

    // Submit answer immediately
    try {
      const result = await submitAnswerMutation.mutateAsync({
        session_id: sessionId,
        question_id: questionId,
        user_id: user.id,
        answer,
        time_taken_sec: 60, // Estimate
      });

      setResults(prev => ({ ...prev, [questionId]: result.is_correct }));
    } catch (error) {
      console.error('Error submitting answer:', error);
      setResults(prev => ({ ...prev, [questionId]: false }));
    }

    // Move to next question or complete
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      await handleComplete();
    }
  };

  const handleComplete = async () => {
    if (!sessionId || isCompleted) return;

    setIsCompleted(true);

    // Update mastery
    await updateMasteryMutation.mutateAsync({
      session_id: sessionId,
    });

    // End session
    await endSessionMutation.mutateAsync({
      session_id: sessionId,
    });

    // Trigger KSV update
    triggerKSVUpdate.mutate(courseId);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentQuestion = questions[currentIndex];
  const correctCount = Object.values(results).filter(Boolean).length;
  const accuracy = questions.length > 0 ? (correctCount / questions.length) * 100 : 0;

  // Group results by topic
  const topicResults = new Map<string, { correct: number; total: number }>();
  for (const question of questions) {
    const isCorrect = results[question.id] || false;
    const existing = topicResults.get(question.topic_id) || { correct: 0, total: 0 };
    topicResults.set(question.topic_id, {
      correct: existing.correct + (isCorrect ? 1 : 0),
      total: existing.total + 1,
    });
  }

  const strongTopics: string[] = [];
  const weakTopics: string[] = [];

  for (const [topicId, stats] of topicResults) {
    const topicName = questions.find(q => q.topic_id === topicId)?.topic_name || 'Unknown';
    const topicAccuracy = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;

    if (topicAccuracy >= 70) {
      strongTopics.push(topicName);
    } else {
      weakTopics.push(topicName);
    }
  }

  if (questionsLoading) {
    return <LoadingScreen message="Preparing adaptive stress test..." />;
  }

  if (!isStarted && questions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            Finals Stress Test
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            A 20-minute adaptive test that focuses on your weakest topics. Questions are selected
            based on your knowledge state to maximize learning.
          </p>
          <div className="p-4 bg-red-50 rounded-lg border border-red-200">
            <p className="text-sm font-medium text-red-900 mb-1">Test Details</p>
            <ul className="text-xs text-red-800 space-y-1">
              <li>• 20 minutes total</li>
              <li>• 10-15 questions from your weakest topics</li>
              <li>• Adaptive question selection</li>
              <li>• Results update your knowledge state</li>
            </ul>
          </div>
          <Button onClick={handleStart} className="w-full" size="lg" disabled={questions.length === 0}>
            <AlertTriangle className="w-4 h-4 mr-2" />
            Start Stress Test
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isCompleted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-green-600" />
            Test Complete
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center">
            <div className="text-4xl font-bold mb-2">{correctCount}/{questions.length}</div>
            <div className="text-lg text-muted-foreground mb-4">
              {accuracy.toFixed(0)}% Accuracy
            </div>
            <Progress value={accuracy} className="h-3" />
          </div>

          {/* Heatmap */}
          <div className="grid grid-cols-2 gap-4">
            {strongTopics.length > 0 && (
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <p className="font-semibold text-sm text-green-900">Strong Topics</p>
                </div>
                <div className="space-y-1">
                  {strongTopics.map(topic => (
                    <p key={topic} className="text-xs text-green-800">{topic}</p>
                  ))}
                </div>
              </div>
            )}

            {weakTopics.length > 0 && (
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center gap-2 mb-2">
                  <XCircle className="w-4 h-4 text-red-600" />
                  <p className="font-semibold text-sm text-red-900">Weak Topics</p>
                </div>
                <div className="space-y-1">
                  {weakTopics.map(topic => (
                    <p key={topic} className="text-xs text-red-800">{topic}</p>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Button
            onClick={() => {
              setIsStarted(false);
              setIsCompleted(false);
              setQuestions([]);
              setAnswers({});
              setResults({});
              setCurrentIndex(0);
              setTimeRemaining(20 * 60);
              setSessionId(null);
            }}
            className="w-full"
            variant="outline"
          >
            Take Another Test
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!currentQuestion) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-red-600" />
            Stress Test
          </span>
          <div className="flex items-center gap-2">
            <Badge variant="destructive">{formatTime(timeRemaining)}</Badge>
            <span className="text-sm text-muted-foreground">
              {currentIndex + 1} / {questions.length}
            </span>
          </div>
        </CardTitle>
        <Progress 
          value={((currentIndex + 1) / questions.length) * 100} 
          className="mt-2" 
        />
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Badge variant="outline" className="text-xs">
            {currentQuestion.topic_name}
          </Badge>
        </div>

        {currentQuestion.options ? (
          <QuestionCard
            questionNumber={currentIndex + 1}
            totalQuestions={questions.length}
            question={currentQuestion.prompt}
            options={currentQuestion.options.map((opt, idx) => ({
              id: String(idx),
              text: opt,
            }))}
            selectedAnswer={answers[currentQuestion.id] ? String(currentQuestion.options.indexOf(answers[currentQuestion.id])) : null}
            onSelectAnswer={(answerId) => {
              const selectedOption = currentQuestion.options?.[parseInt(answerId)];
              if (selectedOption) {
                handleAnswer(currentQuestion.id, selectedOption);
              }
            }}
            difficulty={currentQuestion.difficulty >= 3 ? 'hard' : currentQuestion.difficulty >= 2 ? 'medium' : 'easy'}
          />
        ) : (
          <div className="space-y-4">
            <p className="text-lg font-medium">{currentQuestion.prompt}</p>
            <textarea
              value={answers[currentQuestion.id] || ''}
              onChange={(e) => setAnswers(prev => ({ ...prev, [currentQuestion.id]: e.target.value }))}
              placeholder="Type your answer..."
              className="w-full min-h-32 p-3 border rounded-lg"
            />
            <Button
              onClick={() => handleAnswer(currentQuestion.id, answers[currentQuestion.id] || '')}
              disabled={!answers[currentQuestion.id]?.trim()}
              className="w-full"
            >
              Submit Answer
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

