// Sample course data for grasp.ai

export interface Course {
  id: string;
  code: string;
  title: string;
  masteryPercentage: number;
  totalTopics: number;
  weakSpots: number;
  reviewsDue: number;
  examInDays: number | null;
}

export const courses: Course[] = [
  {
    id: 'cse120',
    code: 'CSE 120',
    title: 'Operating Systems',
    masteryPercentage: 65,
    totalTopics: 24,
    weakSpots: 3,
    reviewsDue: 12,
    examInDays: 6,
  },
  {
    id: 'cse101',
    code: 'CSE 101',
    title: 'Data Structures',
    masteryPercentage: 82,
    totalTopics: 18,
    weakSpots: 1,
    reviewsDue: 5,
    examInDays: 14,
  },
  {
    id: 'math20c',
    code: 'MATH 20C',
    title: 'Calculus III',
    masteryPercentage: 45,
    totalTopics: 32,
    weakSpots: 7,
    reviewsDue: 18,
    examInDays: 3,
  },
  {
    id: 'cse140',
    code: 'CSE 140',
    title: 'Computer Architecture',
    masteryPercentage: 71,
    totalTopics: 20,
    weakSpots: 2,
    reviewsDue: 8,
    examInDays: null,
  },
];

// Cheatsheet concept structure
export interface ConceptNode {
  name: string;
  keyPoints: string[];
  commonMistake?: string;
  visualAid?: string;
  masteryLevel?: number;
}

export const cse120Concepts: ConceptNode[] = [
  {
    name: 'Page Fault Handling',
    keyPoints: [
      'CPU triggers page fault exception when accessing unmapped page',
      'OS handles by loading page from disk into RAM',
      'Page table updated with new physical address',
      'Instruction restarted after page is loaded',
    ],
    commonMistake: 'Forgetting that the instruction must be restarted after the page is loaded',
    visualAid: 'Access 0x4000 → TLB miss → Page table: not present → Page fault → OS loads from disk',
    masteryLevel: 45,
  },
  {
    name: 'Context Switch',
    keyPoints: [
      'Save current process registers and PC to PCB',
      'Update process state (running → ready/blocked)',
      'Select next process from scheduler',
      'Load new process registers and PC from its PCB',
    ],
    commonMistake: 'Not accounting for the overhead cost of context switches',
    visualAid: 'Process A running → timer interrupt → save A\'s state → load Process B → B starts running',
    masteryLevel: 78,
  },
  {
    name: 'TLB (Translation Lookaside Buffer)',
    keyPoints: [
      'Small, fast cache in the MMU',
      'Stores recent page table entries',
      'TLB hit: translation found, fast access',
      'TLB miss: must access page table in memory',
    ],
    commonMistake: 'Confusing TLB with CPU cache (L1/L2)',
    visualAid: 'Access 0x2000 → TLB hit → physical address 0x8000 immediately available',
    masteryLevel: 62,
  },
  {
    name: 'Paging',
    keyPoints: [
      'Divide virtual memory into fixed-size pages',
      'Divide physical memory into frames (same size)',
      'Page table maps virtual pages to physical frames',
      'Enables non-contiguous allocation',
    ],
    commonMistake: 'Forgetting that pages and frames must be the same size',
    visualAid: 'Virtual pages [0,1,2,3] → Physical frames [5,2,9,1]',
    masteryLevel: 71,
  },
  {
    name: 'CPU Scheduling',
    keyPoints: [
      'FCFS: First-Come First-Served',
      'SJF: Shortest Job First (optimal average wait time)',
      'Round Robin: Time slicing with preemption',
      'Priority: Assign priority levels to processes',
    ],
    commonMistake: 'Thinking SJF is practical (requires knowing future execution time)',
    visualAid: 'Round Robin (q=10ms): A[10ms] → B[10ms] → C[10ms] → repeat',
    masteryLevel: 55,
  },
  {
    name: 'Deadlock Conditions',
    keyPoints: [
      'Mutual Exclusion: Resources cannot be shared',
      'Hold and Wait: Process holds resources while waiting for more',
      'No Preemption: Resources cannot be forcibly taken',
      'Circular Wait: Circular chain of processes waiting for resources',
    ],
    commonMistake: 'Thinking you need to prevent all four — preventing just one is enough',
    masteryLevel: 68,
  },
  {
    name: 'Virtual Memory',
    keyPoints: [
      'Illusion of large contiguous address space',
      'Programs reference virtual addresses',
      'MMU translates to physical addresses',
      'Enables protection and sharing',
    ],
    commonMistake: 'Confusing virtual addresses with physical addresses in calculations',
    masteryLevel: 72,
  },
];

// Practice questions
export interface Question {
  id: string;
  question: string;
  correctAnswer: string;
  hint?: string;
  explanation?: string;
  source?: string;
}

export const warmupQuestions: Question[] = [
  {
    id: 'w1',
    question: 'What does TLB stand for?',
    correctAnswer: 'Translation Lookaside Buffer',
    hint: 'Think about what hardware caches address translations',
    explanation: 'The TLB is a hardware cache that speeds up virtual-to-physical address translation by storing recent page table entries.',
  },
  {
    id: 'w2',
    question: 'What is the purpose of a page table?',
    correctAnswer: 'Map virtual addresses to physical addresses',
    hint: 'It connects virtual and physical memory',
    explanation: 'The page table is the data structure that maintains the mapping from virtual page numbers to physical frame numbers.',
  },
  {
    id: 'w3',
    question: 'What happens during a context switch?',
    correctAnswer: 'Save current process state, load new process state',
    hint: 'The CPU needs to switch between processes',
    explanation: 'A context switch saves the current process\'s registers and PC to its PCB, then loads the next process\'s state from its PCB.',
  },
  {
    id: 'w4',
    question: 'What triggers a page fault?',
    correctAnswer: 'Accessing a page not in physical memory',
    hint: 'It happens when the CPU tries to access something that isn\'t loaded',
    explanation: 'A page fault occurs when the program accesses a virtual page that is valid but not currently loaded in physical memory.',
  },
  {
    id: 'w5',
    question: 'What is the difference between a process and a thread?',
    correctAnswer: 'Threads share address space, processes have separate address spaces',
    hint: 'Think about memory isolation',
    explanation: 'Processes have isolated address spaces while threads within a process share the same address space and resources.',
  },
  {
    id: 'w6',
    question: 'What does the MMU do?',
    correctAnswer: 'Translates virtual addresses to physical addresses',
    hint: 'It\'s the hardware unit that handles address translation',
    explanation: 'The Memory Management Unit (MMU) is hardware that translates virtual addresses to physical addresses using the TLB and page tables.',
  },
  {
    id: 'w7',
    question: 'What is thrashing?',
    correctAnswer: 'Excessive paging that degrades performance',
    hint: 'It happens when the system spends more time paging than executing',
    explanation: 'Thrashing occurs when the system is constantly swapping pages in and out, causing performance to drop dramatically.',
  },
  {
    id: 'w8',
    question: 'What is a PCB?',
    correctAnswer: 'Process Control Block - stores process state',
    hint: 'It\'s the OS data structure for each process',
    explanation: 'The PCB stores all information about a process including registers, PC, state, and scheduling information.',
  },
];

export const examProblems: Question[] = [
  {
    id: 'e1',
    question: 'Consider a system with 4KB pages and a 32-bit virtual address space. How many entries are needed in a single-level page table? Then explain why a two-level page table might be preferable.',
    correctAnswer: '2^32 / 2^12 = 2^20 = 1,048,576 entries. Two-level saves space by allocating second-level tables on demand.',
    source: 'Finals — 2022 Q4',
    explanation: 'Single-level requires 1M entries × 4 bytes = 4MB per process. Two-level page table only allocates second-level tables when needed, so most processes use far less space.',
  },
  {
    id: 'e2',
    question: 'A TLB has 64 entries and uses LRU replacement. On a TLB miss, accessing the page table takes 100ns. On a TLB hit, translation is instant (0ns). Memory access takes 50ns. If the TLB hit rate is 95%, what is the effective memory access time?',
    correctAnswer: '55ns',
    source: 'Finals — 2023 Q2',
    explanation: 'TLB hit: 0ns + 50ns = 50ns. TLB miss: 100ns + 50ns = 150ns. EAT = 0.95 × 50 + 0.05 × 150 = 55ns',
  },
  {
    id: 'e3',
    question: 'Three processes arrive: P1 (burst=24), P2 (burst=3), P3 (burst=3). Calculate average waiting time for FCFS and SJF. Which is better?',
    correctAnswer: 'FCFS: (0+24+27)/3 = 17ms. SJF: (0+3+6)/3 = 3ms. SJF is better.',
    source: 'Midterm — 2023 Q3',
    explanation: 'SJF minimizes average waiting time by running shortest jobs first. FCFS suffers from convoy effect when long process runs first.',
  },
];

export const mistakeQuestions: Question[] = [
  {
    id: 'm1',
    question: 'Explain what happens when a page fault occurs.',
    correctAnswer: 'CPU triggers exception → OS loads page from disk → page table updated → instruction restarted',
    hint: 'Don\'t forget the restart step',
    explanation: 'Many students forget that after loading the page, the instruction that caused the fault must be restarted.',
  },
  {
    id: 'm2',
    question: 'Why is TLB important for performance?',
    correctAnswer: 'Caches address translations to avoid slow page table lookups',
    hint: 'It doesn\'t cache data, it caches translations',
    explanation: 'TLB caches virtual-to-physical address translations, not memory data. Without it, every memory access requires a page table lookup.',
  },
];
