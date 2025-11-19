import { BookOpen, Brain, FileText } from 'lucide-react';

type Pillar = 'practice' | 'compression' | 'exam';

interface NavBarProps {
  currentPillar: Pillar;
  onPillarChange: (pillar: Pillar) => void;
}

export function NavBar({ currentPillar, onPillarChange }: NavBarProps) {
  const pillars = [
    { id: 'practice' as Pillar, icon: Brain, label: 'Practice' },
    { id: 'compression' as Pillar, icon: BookOpen, label: 'Compression' },
    { id: 'exam' as Pillar, icon: FileText, label: 'Exam' }
  ];

  return (
    <nav className="border-b border-[#E5E7EB] bg-white">
      <div className="max-w-7xl mx-auto px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="text-xl tracking-tight">grasp.ai</div>

          {/* 3-Pillar Navigation */}
          <div className="flex gap-1">
            {pillars.map((pillar) => {
              const Icon = pillar.icon;
              const isActive = currentPillar === pillar.id;
              
              return (
                <button
                  key={pillar.id}
                  onClick={() => onPillarChange(pillar.id)}
                  className={`flex items-center gap-2 px-6 py-2 rounded-[10px] transition-all duration-200 ${
                    isActive
                      ? 'bg-[#4F46E5] text-white'
                      : 'text-[#6B7280] hover:text-[#111827] hover:bg-[#F9FAFB]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium">{pillar.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right side spacer for balance */}
          <div className="w-20"></div>
        </div>
      </div>
    </nav>
  );
}
