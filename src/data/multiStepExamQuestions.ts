// Multi-step exam questions with text inputs
export const multiStepExamQuestions = [
  {
    id: 'q1',
    question: 'Consider a system with 3 processes (P1, P2, P3) competing for 3 resource types (A, B, C). Analyze the following deadlock scenario:',
    difficulty: 'hard' as const,
    steps: [
      {
        id: 'step1',
        prompt: 'Given the allocation matrix below, what resources does each process currently hold?',
        type: 'text' as const,
        placeholder: 'e.g., P1 holds: 1 unit of A, 0 units of B...'
      },
      {
        id: 'step2',
        prompt: 'If the maximum need matrix shows P1 needs (3,2,2) total, what is P1\'s remaining need?',
        type: 'text' as const,
        placeholder: 'Calculate: Max - Allocation = Need'
      },
      {
        id: 'step3',
        prompt: 'Is the system in a safe state? Why or why not?',
        type: 'multiple-choice' as const,
        options: [
          { id: 'a', text: 'Yes, there exists a safe sequence' },
          { id: 'b', text: 'No, circular wait exists' },
          { id: 'c', text: 'Cannot determine without available resources' },
          { id: 'd', text: 'No, hold-and-wait condition is violated' }
        ]
      },
      {
        id: 'step4',
        prompt: 'Explain your reasoning for the previous answer:',
        type: 'text' as const,
        placeholder: 'Describe the safe sequence if one exists, or explain why the system is unsafe...'
      }
    ]
  },
  {
    id: 'q2',
    question: 'A system uses paging with a page size of 4KB. The logical address space is 64KB and physical memory is 32KB.',
    difficulty: 'medium' as const,
    steps: [
      {
        id: 'step1',
        prompt: 'How many bits are needed for the page offset?',
        type: 'text' as const,
        placeholder: 'Show your calculation...'
      },
      {
        id: 'step2',
        prompt: 'How many pages are in the logical address space?',
        type: 'text' as const,
        placeholder: 'Total pages = Address space / Page size'
      },
      {
        id: 'step3',
        prompt: 'How many page frames are in physical memory?',
        type: 'text' as const,
        placeholder: 'Calculate number of frames...'
      },
      {
        id: 'step4',
        prompt: 'Given logical address 0x3A5C, what are the page number and offset?',
        type: 'text' as const,
        placeholder: 'Convert to binary and extract page/offset bits...'
      }
    ]
  },
  {
    id: 'q3',
    question: 'Consider a CPU scheduling scenario with 4 processes arriving at different times:',
    difficulty: 'medium' as const,
    steps: [
      {
        id: 'step1',
        prompt: 'Using First-Come-First-Serve (FCFS), draw the Gantt chart for: P1(arrival=0, burst=8), P2(arrival=1, burst=4), P3(arrival=2, burst=2), P4(arrival=3, burst=1)',
        type: 'text' as const,
        placeholder: 'List the order and time ranges...'
      },
      {
        id: 'step2',
        prompt: 'Calculate the average waiting time for FCFS:',
        type: 'text' as const,
        placeholder: 'Show calculation for each process...'
      },
      {
        id: 'step3',
        prompt: 'Which scheduling algorithm would give the best average waiting time for this scenario?',
        type: 'multiple-choice' as const,
        options: [
          { id: 'a', text: 'FCFS (First Come First Serve)' },
          { id: 'b', text: 'SJF (Shortest Job First)' },
          { id: 'c', text: 'Round Robin with quantum=2' },
          { id: 'd', text: 'Priority Scheduling' }
        ]
      },
      {
        id: 'step4',
        prompt: 'Explain why that algorithm performs better:',
        type: 'text' as const,
        placeholder: 'Discuss how it minimizes waiting time in this case...'
      }
    ]
  },
  {
    id: 'q4',
    question: 'A file system uses indexed allocation with a block size of 512 bytes. Each index block can hold 128 pointers.',
    difficulty: 'hard' as const,
    steps: [
      {
        id: 'step1',
        prompt: 'What is the maximum file size with a single-level index?',
        type: 'text' as const,
        placeholder: 'Show your calculation...'
      },
      {
        id: 'step2',
        prompt: 'If we use a two-level index, what is the new maximum file size?',
        type: 'text' as const,
        placeholder: 'Calculate: (pointers per block)^2 × block size'
      },
      {
        id: 'step3',
        prompt: 'How many disk accesses are needed to read a byte from the middle of a file using two-level indexing?',
        type: 'multiple-choice' as const,
        options: [
          { id: 'a', text: '1 (data block only)' },
          { id: 'b', text: '2 (index + data)' },
          { id: 'c', text: '3 (master index + second-level index + data)' },
          { id: 'd', text: '4 (includes directory entry)' }
        ]
      },
      {
        id: 'step4',
        prompt: 'Describe the trade-offs of using multi-level indexing:',
        type: 'text' as const,
        placeholder: 'Discuss advantages (file size) vs disadvantages (access time)...'
      }
    ]
  },
  {
    id: 'q5',
    question: 'Analyze the following producer-consumer synchronization problem using semaphores:',
    difficulty: 'hard' as const,
    steps: [
      {
        id: 'step1',
        prompt: 'What semaphores are needed for a bounded buffer with N slots?',
        type: 'text' as const,
        placeholder: 'List the semaphores and their initial values...'
      },
      {
        id: 'step2',
        prompt: 'Write pseudocode for the producer process:',
        type: 'text' as const,
        placeholder: 'Use wait() and signal() operations...'
      },
      {
        id: 'step3',
        prompt: 'What happens if we remove the mutex semaphore?',
        type: 'multiple-choice' as const,
        options: [
          { id: 'a', text: 'Deadlock will occur' },
          { id: 'b', text: 'Race conditions on buffer access' },
          { id: 'c', text: 'Nothing - mutex is optional' },
          { id: 'd', text: 'Starvation of consumers' }
        ]
      },
      {
        id: 'step4',
        prompt: 'Explain a scenario where the race condition would manifest:',
        type: 'text' as const,
        placeholder: 'Describe the interleaving of operations that causes the problem...'
      }
    ]
  }
];
