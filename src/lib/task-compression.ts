/**
 * Task Compression Engine
 * 
 * "I have X minutes. What should I do?"
 * 
 * Generates an optimized sequence of study tasks based on:
 * - Time budget
 * - Topic mastery levels
 * - Recent task history
 * - Knowledge graph prerequisites
 */

export type TaskType = 
  | 'weak_topic_drill'
  | 'mixed_recall'
  | 'concept_sheet'
  | 'mini_mock'
  | 'formula_recall'
  | 'flashcard';

export interface TopicMastery {
  topic_id: string;
  topic_name: string;
  mastery_level: 'weak' | 'moderate' | 'strong' | null;
  num_attempts: number;
  num_correct: number;
  last_practiced_at: string | null;
}

export interface RecentTask {
  task_type: TaskType;
  topic_id: string | null;
  completed_at: string;
}

export interface StudyTask {
  id: string;
  task_type: TaskType;
  topic_id?: string;
  topic_name?: string;
  duration_minutes: number;
  priority: number;
  description: string;
  route: string; // Navigation route to start this task
}

export interface TaskCompressionInput {
  timeBudgetMinutes: number;
  courseId: string;
  topicMastery: TopicMastery[];
  recentTasks: RecentTask[];
  daysUntilFinal?: number;
}

// Task utility scores (higher = more impactful)
const TASK_UTILITY: Record<TaskType, number> = {
  weak_topic_drill: 1.0,
  mini_mock: 0.9,
  mixed_recall: 0.8,
  concept_sheet: 0.75,
  formula_recall: 0.7,
  flashcard: 0.5,
};

// Task durations in minutes
const TASK_DURATIONS: Record<TaskType, number> = {
  weak_topic_drill: 8,
  mini_mock: 15,
  mixed_recall: 6,
  concept_sheet: 5,
  formula_recall: 4,
  flashcard: 3,
};

// Task descriptions
const TASK_DESCRIPTIONS: Record<TaskType, string> = {
  weak_topic_drill: 'Practice weak topic',
  mini_mock: 'Mini mock exam',
  mixed_recall: 'Mixed recall questions',
  concept_sheet: 'Review concept sheet',
  formula_recall: 'Formula drill',
  flashcard: 'Quick flashcards',
};

/**
 * Calculate mastery gap (0-1, higher = weaker)
 */
function getMasteryGap(mastery: TopicMastery): number {
  if (mastery.num_attempts === 0) return 0.8; // Untried topics have high gap
  
  const accuracy = mastery.num_correct / mastery.num_attempts;
  
  switch (mastery.mastery_level) {
    case 'weak': return 1.0;
    case 'moderate': return 0.5;
    case 'strong': return 0.2;
    default: return 1 - accuracy;
  }
}

/**
 * Calculate recency penalty (0-1, higher = recently done)
 */
function getRecencyPenalty(
  taskType: TaskType,
  topicId: string | undefined,
  recentTasks: RecentTask[]
): number {
  const now = Date.now();
  const hourMs = 60 * 60 * 1000;
  
  // Find matching recent tasks
  const matches = recentTasks.filter(t => {
    if (t.task_type !== taskType) return false;
    if (topicId && t.topic_id !== topicId) return false;
    return true;
  });
  
  if (matches.length === 0) return 0;
  
  // Most recent match
  const mostRecent = new Date(matches[0].completed_at).getTime();
  const hoursAgo = (now - mostRecent) / hourMs;
  
  // Decay penalty over 24 hours
  return Math.max(0, 1 - (hoursAgo / 24));
}

/**
 * Score a potential task
 */
function scoreTask(
  taskType: TaskType,
  topic: TopicMastery | undefined,
  recentTasks: RecentTask[],
  daysUntilFinal?: number
): number {
  const baseUtility = TASK_UTILITY[taskType];
  const masteryGap = topic ? getMasteryGap(topic) : 0.5;
  const recencyPenalty = getRecencyPenalty(taskType, topic?.topic_id, recentTasks);
  
  // Urgency multiplier based on days until final
  let urgencyMultiplier = 1;
  if (daysUntilFinal !== undefined) {
    if (daysUntilFinal <= 3) urgencyMultiplier = 1.5;
    else if (daysUntilFinal <= 7) urgencyMultiplier = 1.25;
    else if (daysUntilFinal <= 14) urgencyMultiplier = 1.1;
  }
  
  // Final score
  return baseUtility * masteryGap * (1 - recencyPenalty * 0.5) * urgencyMultiplier;
}

/**
 * Generate candidate tasks for a topic
 */
function generateTopicTasks(
  topic: TopicMastery,
  courseId: string
): Omit<StudyTask, 'priority'>[] {
  const tasks: Omit<StudyTask, 'priority'>[] = [];
  
  // Weak topic drill - only for weak/moderate topics
  if (topic.mastery_level !== 'strong') {
    tasks.push({
      id: `weak_drill_${topic.topic_id}`,
      task_type: 'weak_topic_drill',
      topic_id: topic.topic_id,
      topic_name: topic.topic_name,
      duration_minutes: TASK_DURATIONS.weak_topic_drill,
      description: `${TASK_DESCRIPTIONS.weak_topic_drill}: ${topic.topic_name}`,
      route: `/course/${courseId}/practice?topic=${topic.topic_id}`,
    });
  }
  
  // Formula recall
  tasks.push({
    id: `formula_${topic.topic_id}`,
    task_type: 'formula_recall',
    topic_id: topic.topic_id,
    topic_name: topic.topic_name,
    duration_minutes: TASK_DURATIONS.formula_recall,
    description: `${TASK_DESCRIPTIONS.formula_recall}: ${topic.topic_name}`,
    route: `/course/${courseId}/compression?topic=${topic.topic_id}`,
  });
  
  // Concept sheet
  tasks.push({
    id: `concept_${topic.topic_id}`,
    task_type: 'concept_sheet',
    topic_id: topic.topic_id,
    topic_name: topic.topic_name,
    duration_minutes: TASK_DURATIONS.concept_sheet,
    description: `${TASK_DESCRIPTIONS.concept_sheet}: ${topic.topic_name}`,
    route: `/course/${courseId}/compression?topic=${topic.topic_id}`,
  });
  
  return tasks;
}

/**
 * Generate global tasks (not topic-specific)
 */
function generateGlobalTasks(courseId: string): Omit<StudyTask, 'priority'>[] {
  return [
    {
      id: `mini_mock_${courseId}`,
      task_type: 'mini_mock',
      duration_minutes: TASK_DURATIONS.mini_mock,
      description: TASK_DESCRIPTIONS.mini_mock,
      route: `/course/${courseId}/exam`,
    },
    {
      id: `mixed_recall_${courseId}`,
      task_type: 'mixed_recall',
      duration_minutes: TASK_DURATIONS.mixed_recall,
      description: TASK_DESCRIPTIONS.mixed_recall,
      route: `/course/${courseId}/practice`,
    },
    {
      id: `flashcard_${courseId}`,
      task_type: 'flashcard',
      duration_minutes: TASK_DURATIONS.flashcard,
      description: TASK_DESCRIPTIONS.flashcard,
      route: `/course/${courseId}/practice`,
    },
  ];
}

/**
 * Main compression algorithm
 * 
 * Uses greedy selection to maximize learning value per minute
 */
export function compressTasks(input: TaskCompressionInput): StudyTask[] {
  const { timeBudgetMinutes, courseId, topicMastery, recentTasks, daysUntilFinal } = input;
  
  // Generate all candidate tasks
  const allCandidates: StudyTask[] = [];
  
  // Topic-specific tasks
  for (const topic of topicMastery) {
    const topicTasks = generateTopicTasks(topic, courseId);
    for (const task of topicTasks) {
      const score = scoreTask(task.task_type, topic, recentTasks, daysUntilFinal);
      allCandidates.push({ ...task, priority: score });
    }
  }
  
  // Global tasks
  const globalTasks = generateGlobalTasks(courseId);
  for (const task of globalTasks) {
    const score = scoreTask(task.task_type, undefined, recentTasks, daysUntilFinal);
    allCandidates.push({ ...task, priority: score });
  }
  
  // Sort by priority (highest first)
  allCandidates.sort((a, b) => b.priority - a.priority);
  
  // Greedy selection
  const selectedTasks: StudyTask[] = [];
  let remainingTime = timeBudgetMinutes;
  const usedTaskTypes = new Set<string>();
  
  for (const task of allCandidates) {
    // Skip if no time left
    if (task.duration_minutes > remainingTime) continue;
    
    // Avoid repeating same task type for same topic
    const taskKey = `${task.task_type}_${task.topic_id || 'global'}`;
    if (usedTaskTypes.has(taskKey)) continue;
    
    // Select this task
    selectedTasks.push(task);
    remainingTime -= task.duration_minutes;
    usedTaskTypes.add(taskKey);
    
    // Stop if we have enough variety (max 6 tasks)
    if (selectedTasks.length >= 6) break;
  }
  
  return selectedTasks;
}

/**
 * Format time budget for display
 */
export function formatTimeBudget(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Calculate total duration of selected tasks
 */
export function getTotalDuration(tasks: StudyTask[]): number {
  return tasks.reduce((sum, task) => sum + task.duration_minutes, 0);
}


