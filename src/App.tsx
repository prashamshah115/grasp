import { useState } from 'react';
import { LandingPage } from './components/LandingPage';
import { CourseCatalog } from './components/CourseCatalog';
import { NavBar } from './components/navigation/NavBar';
import { SideBar } from './components/navigation/SideBar';
import { PracticeView } from './components/practice/PracticeView';
import { CompressionView } from './components/compression/CompressionView';
import { ExamView } from './components/exam/ExamView';
import { PracticeSession } from './components/PracticeSession';
import { MultiStepExamSimulation } from './components/exam/MultiStepExamSimulation';
import { courses } from './data/courses';
import { multiStepExamQuestions } from './data/multiStepExamQuestions';

type Pillar = 'practice' | 'compression' | 'exam';
type AppState = 'landing' | 'catalog' | 'course' | 'practice-session' | 'exam-session';

export default function App() {
  const [appState, setAppState] = useState<AppState>('landing');
  const [currentPillar, setCurrentPillar] = useState<Pillar>('practice');
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  const selectedCourse = courses.find(c => c.id === selectedCourseId);

  // Navigation handlers
  const handleStart = () => {
    setAppState('catalog');
  };

  const handleViewCourse = (courseId: string) => {
    setSelectedCourseId(courseId);
    setAppState('course');
    setCurrentPillar('practice'); // Default to practice when entering course
  };

  const handleBackToCatalog = () => {
    setAppState('catalog');
    setSelectedCourseId(null);
  };

  const handleSelectCourse = (courseId: string) => {
    setSelectedCourseId(courseId);
  };

  const handlePillarChange = (pillar: Pillar) => {
    setCurrentPillar(pillar);
  };

  const handleStartPracticeSession = () => {
    setAppState('practice-session');
  };

  const handleStartExamSession = () => {
    setAppState('exam-session');
  };

  const handleExitSession = () => {
    setAppState('course');
  };

  const handleUploadCourse = () => {
    alert('Upload functionality: Select PDFs, lecture notes, or past exams');
  };

  // Landing Page
  if (appState === 'landing') {
    return <LandingPage onStart={handleStart} />;
  }

  // Course Catalog
  if (appState === 'catalog') {
    return (
      <CourseCatalog
        courses={courses}
        onViewCourse={handleViewCourse}
        onUploadCourse={handleUploadCourse}
      />
    );
  }

  // Practice Session (fullscreen)
  if (appState === 'practice-session' && selectedCourse) {
    return (
      <PracticeSession
        mode="weak-spots"
        course={selectedCourse}
        onComplete={handleExitSession}
        onExit={handleExitSession}
      />
    );
  }

  // Exam Session (fullscreen)
  if (appState === 'exam-session' && selectedCourse) {
    return (
      <MultiStepExamSimulation
        examTitle={`${selectedCourse.code} Finals Practice`}
        durationMinutes={120}
        questions={multiStepExamQuestions}
        onComplete={(answers) => {
          console.log('Exam answers:', answers);
          alert('Exam complete! Review your answers.');
          handleExitSession();
        }}
        onExit={handleExitSession}
      />
    );
  }

  // Course View (3-pillar layout)
  if (appState === 'course' && selectedCourse) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        {/* Top Navigation */}
        <NavBar currentPillar={currentPillar} onPillarChange={handlePillarChange} />

        {/* Main Content Area */}
        <div className="flex flex-1">
          {/* Left Sidebar */}
          <SideBar
            courses={courses}
            selectedCourseId={selectedCourseId}
            onSelectCourse={handleSelectCourse}
            onBackToCatalog={handleBackToCatalog}
          />

          {/* Content Area */}
          <>
            {currentPillar === 'practice' && (
              <PracticeView
                course={selectedCourse}
                onStartSession={handleStartPracticeSession}
              />
            )}
            {currentPillar === 'compression' && (
              <CompressionView course={selectedCourse} />
            )}
            {currentPillar === 'exam' && (
              <ExamView
                course={selectedCourse}
                onStartExam={handleStartExamSession}
              />
            )}
          </>
        </div>
      </div>
    );
  }

  return null;
}
