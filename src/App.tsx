import { useState } from 'react';
import { LandingPage } from './components/LandingPage';
import { CourseCatalog } from './components/CourseCatalog';
import { CourseHome } from './components/CourseHome';
import { PracticeModeSelector } from './components/PracticeModeSelector';
import { PracticeSession } from './components/PracticeSession';
import { Cheatsheet } from './components/Cheatsheet';
import { NotesViewer } from './components/NotesViewer';
import { 
  courses, 
  cse120Concepts, 
  warmupQuestions, 
  examProblems, 
  mistakeQuestions 
} from './data/courses';

type Screen = 
  | 'landing' 
  | 'catalog' 
  | 'course-home' 
  | 'mode-selector'
  | 'practice'
  | 'cheatsheet'
  | 'notes';

type PracticeMode = 
  | 'quick-recall' 
  | 'weak-spots' 
  | 'exam-problems' 
  | 'mistake-replay' 
  | 'compression';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('landing');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [masteryMode, setMasteryMode] = useState<'pass' | 'a-level' | 'deep'>('a-level');
  const [currentPracticeMode, setCurrentPracticeMode] = useState<PracticeMode | null>(null);
  const [userCheatsheet, setUserCheatsheet] = useState(cse120Concepts);

  const selectedCourse = courses.find(c => c.id === selectedCourseId);

  // Navigation handlers
  const handleStart = () => {
    setCurrentScreen('catalog');
  };

  const handleViewCourse = (courseId: string) => {
    setSelectedCourseId(courseId);
    setCurrentScreen('course-home');
  };

  const handleStartPractice = (mode?: PracticeMode) => {
    if (mode) {
      setCurrentPracticeMode(mode);
      setCurrentScreen('practice');
    } else {
      setCurrentScreen('mode-selector');
    }
  };

  const handleSelectPracticeMode = (mode: PracticeMode) => {
    setCurrentPracticeMode(mode);
    setCurrentScreen('practice');
  };

  const handleBackToCourseHome = () => {
    setCurrentScreen('course-home');
    setCurrentPracticeMode(null);
  };

  const handleBackToCatalog = () => {
    setCurrentScreen('catalog');
    setSelectedCourseId(null);
  };

  const handleUploadCourse = () => {
    alert('Upload functionality: Select PDFs, lecture notes, or past exams');
  };

  const handleViewCheatsheet = () => {
    setCurrentScreen('cheatsheet');
  };

  const handleViewNotes = () => {
    setCurrentScreen('notes');
  };

  // Render current screen
  if (currentScreen === 'landing') {
    return <LandingPage onStart={handleStart} />;
  }

  if (currentScreen === 'catalog') {
    return (
      <CourseCatalog
        courses={courses}
        onViewCourse={handleViewCourse}
        onUploadCourse={handleUploadCourse}
      />
    );
  }

  if (currentScreen === 'course-home' && selectedCourse) {
    return (
      <CourseHome
        course={selectedCourse}
        onBack={handleBackToCatalog}
        onStartPractice={handleStartPractice}
        onViewCheatsheet={handleViewCheatsheet}
        onViewNotes={handleViewNotes}
        masteryMode={masteryMode}
        onMasteryModeChange={setMasteryMode}
      />
    );
  }

  if (currentScreen === 'mode-selector') {
    return (
      <PracticeModeSelector
        onSelectMode={handleSelectPracticeMode}
        onBack={handleBackToCourseHome}
      />
    );
  }

  if (currentScreen === 'practice' && currentPracticeMode) {
    return (
      <PracticeSession
        mode={currentPracticeMode}
        course={selectedCourse!}
        onComplete={handleBackToCourseHome}
        onExit={handleBackToCourseHome}
      />
    );
  }

  if (currentScreen === 'cheatsheet') {
    return (
      <Cheatsheet
        concepts={userCheatsheet}
        onBack={handleBackToCourseHome}
      />
    );
  }

  if (currentScreen === 'notes') {
    return (
      <NotesViewer
        courseId={selectedCourseId!}
        onBack={handleBackToCourseHome}
      />
    );
  }

  return null;
}
