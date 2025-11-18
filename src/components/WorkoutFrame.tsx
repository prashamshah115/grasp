import { X, FileText } from 'lucide-react';
import { ReactNode, useState } from 'react';
import { SourceSnippet } from './SourceSnippet';

interface WorkoutFrameProps {
  blockNumber: number;
  blockName: string;
  children: ReactNode;
  onExit: () => void;
}

export function WorkoutFrame({ blockNumber, blockName, children, onExit }: WorkoutFrameProps) {
  const progress = (blockNumber / 5) * 100;
  const [showSource, setShowSource] = useState(false);

  // Sample source material - in production would be dynamic
  const sourceContent = `Virtual memory is a memory management technique that provides an abstraction layer between physical and logical memory. Each process has its own virtual address space, which is mapped to physical memory through page tables.

The Translation Lookaside Buffer (TLB) is a hardware cache that stores recent virtual-to-physical address translations. When the CPU needs to access memory, it first checks the TLB. On a TLB hit, the physical address is immediately available. On a TLB miss, the page table must be accessed.

A page fault occurs when a program attempts to access a page that is not currently in physical memory. The CPU triggers a page fault exception, and the operating system's page fault handler loads the required page from disk into memory, updates the page table, and restarts the instruction.`;

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-[#E5E7EB] px-6 py-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg">Block {blockNumber} of 5 — {blockName}</h3>
          <button
            onClick={onExit}
            className="text-[#6B7280] hover:text-[#111827] transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        {/* Progress Bar */}
        <div className="w-full h-2 bg-[#E5E7EB] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#4F46E5] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-3xl">
          {children}
        </div>
      </div>

      {/* View Source Button */}
      <div className="px-6 pb-6 flex justify-center">
        <button
          onClick={() => setShowSource(true)}
          className="flex items-center gap-2 text-sm text-[#6B7280] hover:text-[#4F46E5] transition-colors"
        >
          <FileText className="w-4 h-4" />
          View Source Snippet
        </button>
      </div>

      {/* Source Modal */}
      <SourceSnippet
        show={showSource}
        onClose={() => setShowSource(false)}
        source={sourceContent}
        reference="Operating Systems: Three Easy Pieces, Chapter 18"
      />
    </div>
  );
}