// Mock exam questions for simulation
export const mockExamQuestions = [
  {
    id: 'q1',
    question: 'What is the primary difference between a process and a thread?',
    options: [
      { id: 'a', text: 'Processes share memory, threads do not' },
      { id: 'b', text: 'Threads share memory within a process, processes have separate memory' },
      { id: 'c', text: 'Processes are faster to create than threads' },
      { id: 'd', text: 'There is no difference' }
    ],
    correctAnswer: 'b',
    explanation: 'Threads exist within a process and share the same memory space, making them lighter weight than processes which have completely separate memory spaces.',
    difficulty: 'easy' as const
  },
  {
    id: 'q2',
    question: 'In the context of synchronization, what is a critical section?',
    options: [
      { id: 'a', text: 'Code that handles errors' },
      { id: 'b', text: 'Code that accesses shared resources and must not be executed concurrently' },
      { id: 'c', text: 'Code that runs with highest priority' },
      { id: 'd', text: 'Code that is time-sensitive' }
    ],
    correctAnswer: 'b',
    explanation: 'A critical section is a part of code that accesses shared resources (like variables, data structures) and must not be executed by more than one process/thread at a time to prevent race conditions.',
    difficulty: 'medium' as const
  },
  {
    id: 'q3',
    question: 'What scheduling algorithm can lead to starvation?',
    options: [
      { id: 'a', text: 'Round Robin' },
      { id: 'b', text: 'First Come First Serve' },
      { id: 'c', text: 'Priority Scheduling' },
      { id: 'd', text: 'Shortest Job First' }
    ],
    correctAnswer: 'c',
    explanation: 'Priority scheduling can lead to starvation when high-priority processes continuously arrive, preventing low-priority processes from ever executing.',
    difficulty: 'medium' as const
  },
  {
    id: 'q4',
    question: 'What is the purpose of virtual memory?',
    options: [
      { id: 'a', text: 'To make programs run faster' },
      { id: 'b', text: 'To allow execution of programs larger than physical RAM' },
      { id: 'c', text: 'To protect the kernel' },
      { id: 'd', text: 'To enable multi-threading' }
    ],
    correctAnswer: 'b',
    explanation: 'Virtual memory allows the system to use disk storage to extend physical RAM, enabling execution of programs that require more memory than is physically available.',
    difficulty: 'easy' as const
  },
  {
    id: 'q5',
    question: 'Which page replacement algorithm is optimal but impractical?',
    options: [
      { id: 'a', text: 'FIFO' },
      { id: 'b', text: 'LRU' },
      { id: 'c', text: 'Optimal (MIN)' },
      { id: 'd', text: 'Clock' }
    ],
    correctAnswer: 'c',
    explanation: 'The optimal algorithm replaces the page that will not be used for the longest time in the future. While it produces the best results, it\'s impractical because it requires future knowledge.',
    difficulty: 'hard' as const
  },
  {
    id: 'q6',
    question: 'What is a deadlock?',
    options: [
      { id: 'a', text: 'When a program crashes' },
      { id: 'b', text: 'When processes wait indefinitely for resources held by each other' },
      { id: 'c', text: 'When the CPU is idle' },
      { id: 'd', text: 'When memory is full' }
    ],
    correctAnswer: 'b',
    explanation: 'A deadlock occurs when two or more processes are waiting indefinitely for resources that are held by each other, creating a circular wait condition.',
    difficulty: 'easy' as const
  },
  {
    id: 'q7',
    question: 'Which is NOT a condition for deadlock?',
    options: [
      { id: 'a', text: 'Mutual exclusion' },
      { id: 'b', text: 'Hold and wait' },
      { id: 'c', text: 'Preemption allowed' },
      { id: 'd', text: 'Circular wait' }
    ],
    correctAnswer: 'c',
    explanation: 'The four conditions for deadlock are mutual exclusion, hold and wait, NO preemption, and circular wait. If preemption is allowed, deadlock cannot occur.',
    difficulty: 'medium' as const
  },
  {
    id: 'q8',
    question: 'What does the fork() system call return to the parent process?',
    options: [
      { id: 'a', text: '0' },
      { id: 'b', text: '-1' },
      { id: 'c', text: 'The child process ID' },
      { id: 'd', text: 'The parent process ID' }
    ],
    correctAnswer: 'c',
    explanation: 'fork() returns the child\'s PID to the parent process, 0 to the child process, and -1 if the fork failed.',
    difficulty: 'medium' as const
  },
  {
    id: 'q9',
    question: 'What is thrashing in the context of virtual memory?',
    options: [
      { id: 'a', text: 'Fast context switching' },
      { id: 'b', text: 'Excessive page faults causing performance degradation' },
      { id: 'c', text: 'Running too many threads' },
      { id: 'd', text: 'Disk fragmentation' }
    ],
    correctAnswer: 'b',
    explanation: 'Thrashing occurs when a system spends more time swapping pages in and out of memory than executing actual processes, severely degrading performance.',
    difficulty: 'hard' as const
  },
  {
    id: 'q10',
    question: 'Which file system structure keeps track of free disk blocks?',
    options: [
      { id: 'a', text: 'Inode table' },
      { id: 'b', text: 'Directory structure' },
      { id: 'c', text: 'Free block list or bitmap' },
      { id: 'd', text: 'File allocation table' }
    ],
    correctAnswer: 'c',
    explanation: 'File systems use either a free block list or a bitmap to track which disk blocks are available for allocation.',
    difficulty: 'medium' as const
  }
];
