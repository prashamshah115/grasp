import { ArrowLeft, FileText, Image as ImageIcon } from 'lucide-react';

interface NotesViewerProps {
  courseId: string;
  onBack: () => void;
}

export function NotesViewer({ courseId, onBack }: NotesViewerProps) {
  // Mock notes data
  const notes = [
    {
      id: 1,
      type: 'diagram',
      title: 'Process State Diagram',
      topic: 'Process Management',
      preview: 'State transitions: New → Ready → Running → Waiting → Terminated'
    },
    {
      id: 2,
      type: 'summary',
      title: 'Scheduling Algorithms',
      topic: 'CPU Scheduling',
      preview: 'FCFS, SJF, Priority, Round Robin — comparison and use cases'
    },
    {
      id: 3,
      type: 'diagram',
      title: 'Memory Hierarchy',
      topic: 'Memory Management',
      preview: 'Registers → Cache → RAM → Disk — speed vs. capacity trade-offs'
    },
    {
      id: 4,
      type: 'summary',
      title: 'Deadlock Conditions',
      topic: 'Synchronization',
      preview: 'Mutual exclusion, Hold & wait, No preemption, Circular wait'
    },
    {
      id: 5,
      type: 'diagram',
      title: 'Page Replacement Flow',
      topic: 'Virtual Memory',
      preview: 'FIFO, LRU, Optimal — algorithm visualization'
    },
    {
      id: 6,
      type: 'summary',
      title: 'File System Structure',
      topic: 'File Systems',
      preview: 'Inodes, directories, blocks — how data is organized on disk'
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="px-8 py-6 border-b border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-[#6B7280] hover:text-[#111827] transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <h1 className="text-xl tracking-tight">novalo.io</h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-8 py-16">
        <div className="mb-16">
          <h1 className="text-5xl mb-4 tracking-tight">
            Notes & Diagrams
          </h1>
          <p className="text-lg text-[#6B7280]">
            Visual summaries and auto-generated notes
          </p>
        </div>

        {/* Notes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {notes.map((note) => (
            <button
              key={note.id}
              className="bg-white border border-[#E5E7EB] rounded-[14px] p-6 text-left hover:border-[#4F46E5] hover:shadow-sm transition-all duration-200"
            >
              {/* Icon & Type */}
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-[10px] bg-[#F5F3FF] flex items-center justify-center">
                  {note.type === 'diagram' ? (
                    <ImageIcon className="w-5 h-5 text-[#4F46E5]" />
                  ) : (
                    <FileText className="w-5 h-5 text-[#4F46E5]" />
                  )}
                </div>
                <span className="text-xs text-[#6B7280] bg-[#F9FAFB] px-2 py-1 rounded-md">
                  {note.topic}
                </span>
              </div>

              {/* Title */}
              <h3 className="text-xl mb-2">{note.title}</h3>

              {/* Preview */}
              <p className="text-sm text-[#6B7280] leading-relaxed">{note.preview}</p>

              {/* View Link */}
              <div className="text-sm text-[#4F46E5] mt-4">
                View {note.type} →
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
