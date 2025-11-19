import { FileText, Sparkles, Upload, Download } from 'lucide-react';
import { useState } from 'react';
import { Course } from '../../data/courses';
import { AIAssistant } from '../shared/AIAssistant';

interface CompressionViewProps {
  course: Course;
}

export function CompressionView({ course }: CompressionViewProps) {
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  // Mock topics for now
  const topics = [
    { id: '1', name: 'Processes & Threads', hasNotes: true },
    { id: '2', name: 'Synchronization', hasNotes: true },
    { id: '3', name: 'Memory Management', hasNotes: true },
    { id: '4', name: 'File Systems', hasNotes: false },
    { id: '5', name: 'Virtual Memory', hasNotes: false },
  ];

  // Mock note content
  const noteContent = `# Processes & Threads

## Key Concepts

**Process**: An instance of a program in execution
- Has its own memory space
- Independent execution context
- Heavy-weight resource

**Thread**: Lightweight unit of execution within a process
- Shares memory with other threads
- Lower overhead for creation/switching
- Common use: concurrent operations

## Critical Differences

| Aspect | Process | Thread |
|--------|---------|--------|
| Memory | Separate address space | Shared address space |
| Communication | IPC required | Direct memory access |
| Creation time | Slower (~10x) | Faster |
| Context switch | Expensive | Lightweight |

## Common Patterns

1. **Single-threaded process**: Traditional sequential execution
2. **Multi-threaded process**: Web servers, GUI applications
3. **Process pool**: Pre-forked workers (Apache MPM)

## Exam Tips

- Know when to use threads vs processes
- Understand race conditions and critical sections
- Be able to explain context switching overhead`;

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Topics List - Left Pane */}
      <div className="w-80 border-r border-[#E5E7EB] bg-[#FAFAFA] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-sm text-[#9CA3AF] mb-1">{course.code}</div>
              <h2 className="text-xl font-medium">Topics</h2>
            </div>
            <button className="p-2 hover:bg-white rounded-[8px] transition-colors">
              <Upload className="w-4 h-4 text-[#6B7280]" />
            </button>
          </div>

          <div className="space-y-2">
            {topics.map((topic) => (
              <button
                key={topic.id}
                onClick={() => setSelectedTopic(topic.id)}
                className={`w-full text-left p-4 rounded-[12px] transition-all ${
                  selectedTopic === topic.id
                    ? 'bg-white border border-[#10B981] shadow-sm'
                    : 'bg-white border border-transparent hover:border-[#E5E7EB]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="font-medium">{topic.name}</div>
                  {topic.hasNotes && (
                    <div className="w-2 h-2 rounded-full bg-[#10B981]"></div>
                  )}
                </div>
                <div className="text-xs text-[#6B7280]">
                  {topic.hasNotes ? 'Compression ready' : 'No notes yet'}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Notes Viewer - Right Pane */}
      <div className="flex-1 overflow-y-auto bg-white">
        {selectedTopic ? (
          <div className="max-w-3xl mx-auto px-8 py-12">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <div className="text-sm text-[#9CA3AF] mb-2">AI-Generated Compression</div>
                <h1 className="text-4xl tracking-tight">Processes & Threads</h1>
              </div>
              <div className="flex gap-2">
                <button className="flex items-center gap-2 px-4 py-2 rounded-[10px] border border-[#E5E7EB] text-[#6B7280] hover:border-[#10B981] hover:text-[#10B981] transition-all">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-sm">Regenerate</span>
                </button>
                <button className="flex items-center gap-2 px-4 py-2 rounded-[10px] bg-[#10B981] text-white hover:bg-[#059669] transition-all">
                  <Download className="w-4 h-4" />
                  <span className="text-sm">Download</span>
                </button>
              </div>
            </div>

            {/* Note Content */}
            <div className="prose prose-lg max-w-none">
              <div className="whitespace-pre-wrap text-[#374151] leading-relaxed">
                {noteContent}
              </div>
            </div>
          </div>
        ) : (
          // Empty State
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 rounded-[16px] bg-[#D1FAE5] flex items-center justify-center mx-auto mb-4">
                <FileText className="w-8 h-8 text-[#10B981]" />
              </div>
              <h3 className="text-2xl mb-2">Select a Topic</h3>
              <p className="text-[#6B7280]">
                Choose a topic from the left to view AI-generated study notes
              </p>
            </div>
          </div>
        )}
      </div>
      
      {/* AI Assistant */}
      <AIAssistant context={`Course: ${course.code} - Compression Mode - Topic: ${selectedTopic ? 'Processes & Threads' : 'None selected'}`} />
    </div>
  );
}