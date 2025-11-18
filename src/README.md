# grasp.ai - Exam-Focused Study Assistant

A modern, minimal web application designed to help students ace their exams through structured workout sessions, mastery tracking, and auto-generated cheatsheets.

## Features

### 🎯 Core Screens

1. **Landing Page** - Clean, minimal entry point with clear call-to-action
2. **Course Catalog** - Grid view of all courses with mastery rings and quick stats
3. **Course Home** - Central hub showing mastery level, weak spots, reviews due, and exam countdown
4. **Workout Flow** - 5-block structured learning sessions
5. **Cheatsheet** - Auto-generated study guide from completed sessions

### 🏋️ 5-Block Workout System

Each workout session consists of 5 sequential blocks designed to maximize retention:

1. **Warmup** - Quick recall prompts to activate prior knowledge
2. **Kill Zone (Weak Spots)** - Focused practice on concepts with low mastery
3. **Exam Simulation** - Real past exam problems with side-by-side solution comparison
4. **Mistake Replay** - Retry previous errors with improved answers
5. **Compression** - Create 4-bullet summaries for long-term retention

### 🎨 Design System

Built with a calm, high-trust aesthetic inspired by Notion, Linear, and Vercel:

- **Colors**: Indigo primary (#4F46E5), semantic colors for success/warning/danger
- **Typography**: Inter font family with consistent weight hierarchy
- **Components**: 12px radius, subtle shadows, generous whitespace
- **Mastery Rings**: Visual progress indicators (Green >75%, Yellow 40-75%, Red <40%)

### 📊 Sample Content

Includes complete CSE 120 (Operating Systems) course data:
- 5 core concepts with definitions, examples, and common mistakes
- 10 warmup questions
- 2 realistic exam problems
- Past mistake examples
- Auto-generated cheatsheet entries

## Technology Stack

- **React** - Component-based UI
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Lucide React** - Clean, consistent icons

## Project Structure

```
/
├── App.tsx                          # Main app with routing logic
├── data/
│   └── courses.ts                   # Sample course data and types
├── components/
│   ├── LandingPage.tsx             # Screen 1: Landing
│   ├── CourseCatalog.tsx           # Screen 2: Course grid
│   ├── CourseHome.tsx              # Screen 3: Course dashboard
│   ├── WorkoutFrame.tsx            # Workout wrapper with progress
│   ├── WorkoutComplete.tsx         # Success screen
│   ├── Cheatsheet.tsx              # Auto-generated study guide
│   ├── MasteryRing.tsx             # Reusable progress indicator
│   ├── CourseCard.tsx              # Course grid item
│   ├── SourceSnippet.tsx           # Modal for viewing source material
│   └── blocks/
│       ├── Warmup.tsx              # Block 1
│       ├── KillZone.tsx            # Block 2
│       ├── ExamSimulation.tsx      # Block 3
│       ├── MistakeReplay.tsx       # Block 4
│       └── Compression.tsx         # Block 5
└── styles/
    └── globals.css                  # Design system tokens
```

## Key Interactions

- **Mastery Mode Toggle**: Choose between Pass, A-level, or Deep mastery targets
- **Workout Progression**: Auto-advances through 5 blocks with progress tracking
- **Instant Feedback**: Real-time validation on warmup questions
- **Comparison View**: Side-by-side student vs. model solutions
- **Floating Actions**: Quick access to cheatsheet from course home

## Future Enhancements

- Backend integration with Supabase for persistence
- Real AI-powered feedback on open-ended responses
- Course upload functionality with PDF parsing
- Spaced repetition scheduling
- Progress analytics and insights
- Multi-course support with cross-referencing

## Development

This is a production-ready prototype built with Figma Make. All styling follows the exact design specification provided, with careful attention to:

- Consistent 12px border radius
- Exact color palette (#4F46E5, #22C55E, #FACC15, #EF4444)
- Inter font family
- Minimal, calm aesthetic
- High whitespace
- Intuitive single-action flows

---

Built with Figma Make
