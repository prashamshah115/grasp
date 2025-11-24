# Exam JSON Generation Prompt

You are an expert at parsing exam PDFs and converting them into structured JSON format. Your task is to carefully read through the provided exam solution PDF and extract all questions, options, correct answers, and explanations to create a properly formatted JSON file.

## Instructions

1. **Read the entire PDF carefully** to understand the exam structure and content.

2. **Extract each question** with the following information:
   - Question text (the actual question being asked)
   - All answer options (A, B, C, D, etc.)
   - The correct answer
   - Explanation/rationale for why each option is correct or incorrect

3. **Determine the difficulty level** for each question:
   - `easy`: Basic recall or straightforward concept
   - `medium`: Requires understanding and application
   - `hard`: Complex reasoning or multi-step problem solving

4. **Assign appropriate topic tags** from this list (use exact names):
   - Architecture
   - File Systems
   - Memory Management
   - Paging
   - Processes & Threads
   - Scheduling & Deadlock
   - Semaphores & Monitors
   - Synchronization
   - Virtual Memory

5. **Output Format**: Generate a JSON file with this exact structure:

```json
{
  "exam": {
    "title": "[Exam Title from PDF - e.g., 'CSE120 Midterm Exam']",
    "description": "[Brief description of what topics this exam covers]",
    "course_id": "CSE120",
    "time_limit": [number of minutes - typically 90 for midterm, 180 for final],
    "passing_score": 70,
    "instructions": "Select the best answer for each question. You have [X] minutes to complete this exam."
  },
  "questions": [
    {
      "question_text": "[Full question text exactly as written in the PDF]",
      "options": {
        "A": {
          "text": "[Option A text]",
          "rationale": "[Explanation of why this is correct/incorrect based on the solution PDF]"
        },
        "B": {
          "text": "[Option B text]",
          "rationale": "[Explanation of why this is correct/incorrect based on the solution PDF]"
        },
        "C": {
          "text": "[Option C text]",
          "rationale": "[Explanation of why this is correct/incorrect based on the solution PDF]"
        },
        "D": {
          "text": "[Option D text]",
          "rationale": "[Explanation of why this is correct/incorrect based on the solution PDF]"
        }
      },
      "correct_answer": "[A, B, C, or D - the letter of the correct answer]",
      "explanation": "[Overall explanation from the solution PDF about the concept being tested]",
      "difficulty": "[easy, medium, or hard]",
      "tags": ["[Topic Name 1]", "[Topic Name 2]"]
    }
  ]
}
```

## Important Guidelines

### For Question Text:
- Copy the exact wording from the PDF
- Include any code snippets or technical notation
- Preserve formatting as much as possible

### For Options:
- Each option must be an object with `text` and `rationale` fields
- The `text` field contains the answer choice text
- The `rationale` field should:
  - For correct answers: Start with "Correct!" and explain why it's right
  - For incorrect answers: Start with "Incorrect." and explain why it's wrong

### For Explanations:
- Use the solution PDF to write comprehensive explanations
- Explain the underlying concept being tested
- Reference relevant course material or concepts when possible

### For Difficulty:
- **Easy**: Basic definitions, simple recall, straightforward concepts
- **Medium**: Requires understanding, application of concepts, some analysis
- **Hard**: Complex scenarios, multi-step reasoning, advanced problem-solving

### For Tags:
- MUST use topic names from the provided list exactly as written (case-sensitive)
- Select 1-3 most relevant topics per question
- Be specific (e.g., "Scheduling & Deadlock" not just "Processes & Threads" if it's about scheduling)

## Example Question

Given this exam question and solution:
```
Question 5: What happens when a process calls fork()?
A) The process terminates
B) A new thread is created
C) A child process is created that is a copy of the parent
D) The process sleeps

Solution: The answer is C. The fork() system call creates a new child process that is an exact copy of the parent process, including code, data, and open files. After fork(), both processes continue execution from the point after the fork() call. Option A is wrong because fork() doesn't terminate the process. Option B is incorrect because fork() creates a process, not a thread. Option D is incorrect because fork() doesn't put the process to sleep.
```

Output:
```json
{
  "question_text": "What happens when a process calls fork()?",
  "options": {
    "A": {
      "text": "The process terminates",
      "rationale": "Incorrect. fork() does not terminate the calling process; both parent and child continue executing."
    },
    "B": {
      "text": "A new thread is created",
      "rationale": "Incorrect. fork() creates a new process, not a thread. Threads are created using pthread_create() or similar."
    },
    "C": {
      "text": "A child process is created that is a copy of the parent",
      "rationale": "Correct! fork() creates a new child process that is an exact copy of the parent, including code, data, and open files."
    },
    "D": {
      "text": "The process sleeps",
      "rationale": "Incorrect. fork() does not put the process to sleep; it creates a new process and both continue execution."
    }
  },
  "correct_answer": "C",
  "explanation": "The fork() system call creates a new child process that is an exact copy of the parent process. After fork(), both processes continue execution from the point after the fork() call, with the parent receiving the child's PID and the child receiving 0 as the return value.",
  "difficulty": "medium",
  "tags": ["Processes & Threads"]
}
```

## Validation Checklist

Before outputting the final JSON, verify:
- [ ] All questions from the PDF are included
- [ ] Each question has all options (A, B, C, D, etc.)
- [ ] Each option has both `text` and `rationale` fields
- [ ] The `correct_answer` matches the solution PDF
- [ ] Each question has an `explanation` field
- [ ] Difficulty levels are reasonable and varied
- [ ] All tags use exact topic names from the provided list
- [ ] The JSON is valid (proper commas, brackets, quotes)
- [ ] Exam metadata (title, time_limit, etc.) is filled in

## Output

Generate ONLY the JSON file with no additional commentary. Ensure it is valid JSON that can be parsed directly.
