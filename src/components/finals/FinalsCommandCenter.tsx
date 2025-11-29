/**
 * Finals Command Center
 * 
 * Dashboard showing:
 * - Countdown to finals
 * - Mastery overview per course
 * - Recommended tasks ("What should I do next?")
 * - Task compression ("I have X minutes")
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  Clock, 
  Target, 
  TrendingUp, 
  AlertTriangle,
  ChevronRight,
  Zap,
  Play,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { 
  useFinalsDashboard, 
  useUserFinalPreferences,
  useUpdateFinalPreferences,
  useWeakTopics,
  useRecentTasks,
  type FinalsDashboardData 
} from '@/hooks/useFinals';
import { useRecommendedTopics } from '@/hooks/useKnowledgeState';
import { compressTasks, formatTimeBudget, getTotalDuration, type StudyTask } from '@/lib/task-compression';
import { MasteryRing } from '@/components/MasteryRing';
import LoadingScreen from '@/components/LoadingScreen';
import { PredictionScoreWidget } from './PredictionScoreWidget';

interface FinalsCommandCenterProps {
  courseId?: string;
}

export function FinalsCommandCenter({ courseId }: FinalsCommandCenterProps) {
  const navigate = useNavigate();
  const [timeBudget, setTimeBudget] = useState(30);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>('');
  
  const { data: dashboard, isLoading: dashboardLoading } = useFinalsDashboard();
  const { data: preferences } = useUserFinalPreferences(courseId);
  const { mutate: updatePreferences } = useUpdateFinalPreferences();
  const { data: weakTopics } = useWeakTopics(courseId);
  const { data: recentTasks } = useRecentTasks(courseId);
  const { data: recommendedTopics, isLoading: recommendationsLoading } = useRecommendedTopics(courseId, 3);

  // Get current course data
  const currentCourse = courseId 
    ? dashboard?.find(c => c.course_id === courseId)
    : null;

  // Generate compressed tasks
  const compressedTasks: StudyTask[] = courseId && weakTopics
    ? compressTasks({
        timeBudgetMinutes: timeBudget,
        courseId,
        topicMastery: weakTopics,
        recentTasks: recentTasks?.map(t => ({
          task_type: t.task_type as any,
          topic_id: t.topic_id,
          completed_at: t.completed_at,
        })) || [],
        daysUntilFinal: currentCourse?.days_until_final ?? undefined,
      })
    : [];

  const handleSaveDate = () => {
    if (courseId && selectedDate) {
      updatePreferences({
        courseId,
        finalExamDate: new Date(selectedDate).toISOString(),
      });
      setShowSettings(false);
    }
  };

  const handleStartTask = (task: StudyTask) => {
    navigate(task.route);
  };

  if (dashboardLoading) {
    return <LoadingScreen message="Loading finals data..." />;
  }

  // Single course view
  if (courseId && currentCourse) {
    return (
      <div className="space-y-8">
        {/* Header with countdown */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight mb-2">Finals Command Center</h2>
            <p className="text-muted-foreground">
              {currentCourse.days_until_final !== null
                ? `${currentCourse.days_until_final} days until final`
                : 'Set your final exam date to get started'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <Card className="border-dashed">
            <CardContent className="pt-6">
              <div className="flex items-end gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Final Exam Date</label>
                  <input
                    type="date"
                    value={selectedDate || (preferences?.final_exam_date?.split('T')[0] ?? '')}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                  />
                </div>
                <Button onClick={handleSaveDate}>Save</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Days Left</p>
                  <p className="text-2xl font-bold">
                    {currentCourse.days_until_final ?? '—'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <MasteryRing percentage={currentCourse.mastery_percentage} size="sm" showLabel={false} />
                <div>
                  <p className="text-sm text-muted-foreground">Mastery</p>
                  <p className="text-2xl font-bold">{currentCourse.mastery_percentage}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Weak Topics</p>
                  <p className="text-2xl font-bold">{currentCourse.weak_topic_count}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Coverage</p>
                  <p className="text-2xl font-bold">{currentCourse.total_topic_count} topics</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Prediction Score Widget */}
        {courseId && <PredictionScoreWidget courseId={courseId} />}

        {/* What to Study Next - KSV-based recommendations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5 text-primary" />
              What to Study Next
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Personalized recommendations based on your knowledge state
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {recommendationsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="animate-pulse p-4 rounded-lg border bg-gray-50 h-20"></div>
                ))}
              </div>
            ) : recommendedTopics && recommendedTopics.length > 0 ? (
              <div className="space-y-3">
                {recommendedTopics.map((topic, index) => (
                  <div
                    key={topic.topic_id}
                    className="flex items-start gap-4 p-4 rounded-lg border bg-card hover:border-primary/50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium flex-shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-medium">{topic.topic_name}</p>
                        <Badge variant="outline" className="text-xs flex-shrink-0">
                          {(topic.recommendation_score * 100).toFixed(0)}% priority
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {topic.justification}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Strength: {(topic.knowledge_strength * 100).toFixed(0)}%</span>
                        {topic.weakness_score > 0.5 && (
                          <span className="text-orange-600">Needs review</span>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => navigate(`/course/${courseId}/practice?topic=${topic.topic_id}`)}
                      className="flex-shrink-0"
                    >
                      <Play className="w-4 h-4 mr-1" />
                      Study
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Complete some practice to get personalized recommendations</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Legacy Task Compression (keep for backward compatibility) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              Quick Study Plan (Time-based)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">I have time for:</label>
                <span className="text-sm font-bold text-primary">
                  {formatTimeBudget(timeBudget)}
                </span>
              </div>
              <Slider
                value={[timeBudget]}
                onValueChange={(value) => setTimeBudget(value[0])}
                min={10}
                max={120}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>10 min</span>
                <span>2 hours</span>
              </div>
            </div>

            {compressedTasks.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {compressedTasks.length} tasks • {getTotalDuration(compressedTasks)} min total
                  </span>
                </div>
                {compressedTasks.map((task, index) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:border-primary/50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{task.description}</p>
                      <p className="text-sm text-muted-foreground">
                        {task.duration_minutes} min
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleStartTask(task)}
                    >
                      <Play className="w-4 h-4 mr-1" />
                      Start
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No tasks available. Complete some practice first!</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-3 gap-4">
          <Button
            variant="outline"
            className="h-auto py-4 flex-col gap-2"
            onClick={() => navigate(`/course/${courseId}/finals/pack`)}
          >
            <Target className="w-6 h-6" />
            <span>Final Pack</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-4 flex-col gap-2"
            onClick={() => navigate(`/course/${courseId}/exam`)}
          >
            <Clock className="w-6 h-6" />
            <span>Mock Exam</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-4 flex-col gap-2"
            onClick={() => navigate(`/course/${courseId}/practice`)}
          >
            <Zap className="w-6 h-6" />
            <span>Quick Practice</span>
          </Button>
        </div>
      </div>
    );
  }

  // Multi-course dashboard view
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight mb-2">Finals Command Center</h2>
        <p className="text-muted-foreground">
          Your finals preparation overview across all courses
        </p>
      </div>

      {dashboard && dashboard.length > 0 ? (
        <div className="space-y-4">
          {dashboard.map((course) => (
            <Card 
              key={course.course_id}
              className="hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() => navigate(`/course/${course.course_id}`)}
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-6">
                  <MasteryRing 
                    percentage={course.mastery_percentage} 
                    size="md" 
                    showLabel={false} 
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-muted-foreground">{course.course_code}</span>
                      {course.days_until_final !== null && course.days_until_final <= 7 && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                          {course.days_until_final} days left
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-medium mb-2">{course.course_name}</h3>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{course.mastery_percentage}% mastery</span>
                      <span>•</span>
                      <span>{course.weak_topic_count} weak topics</span>
                      <span>•</span>
                      <span>{course.total_topic_count} total topics</span>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </div>
                <Progress 
                  value={course.mastery_percentage} 
                  className="mt-4 h-2"
                />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No courses enrolled</h3>
            <p className="text-muted-foreground mb-4">
              Enroll in courses to see your finals preparation dashboard
            </p>
            <Button onClick={() => navigate('/courses')}>
              Browse Courses
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default FinalsCommandCenter;



