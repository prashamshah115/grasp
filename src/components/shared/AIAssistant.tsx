import { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Minimize2, Maximize2 } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface AIAssistantProps {
  context?: string; // Current question or topic context
  placeholder?: string;
}

export function AIAssistant({ context, placeholder = 'Ask me anything about this material...' }: AIAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: '👋 Hi! I\'m your AI study assistant. I can help explain concepts, break down problems, or guide you through solutions. What would you like to know?',
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages([...messages, userMessage]);

    // Simulate AI response
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: generateAIResponse(inputValue, context),
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMessage]);
    }, 800);

    setInputValue('');
  };

  const generateAIResponse = (question: string, ctx?: string): string => {
    // Mock AI responses - in production, this would call an actual AI API
    const responses = [
      'Great question! Let me break this down for you step by step...',
      'Here\'s a helpful way to think about this concept...',
      'This is a common area of confusion. The key insight is...',
      'Let me explain this using a real-world analogy...',
      'To solve this type of problem, try this approach...'
    ];
    
    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
    
    if (ctx) {
      return `${randomResponse}\n\nContext: ${ctx}\n\nBased on your question about "${question}", here's what you need to know:\n\n1. First, understand the core concept\n2. Then, apply it to the specific problem\n3. Finally, verify your solution makes sense\n\nWould you like me to elaborate on any of these steps?`;
    }
    
    return `${randomResponse}\n\nRegarding "${question}":\n\nThis involves understanding the fundamental principles and applying them systematically. Let me know if you'd like more detail on any part!`;
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] rounded-full shadow-2xl hover:scale-110 transition-transform flex items-center justify-center group z-50"
      >
        <Sparkles className="w-7 h-7 text-white" />
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#10B981] rounded-full animate-pulse"></div>
      </button>
    );
  }

  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className="bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] rounded-[16px] px-5 py-3 shadow-2xl hover:scale-105 transition-transform flex items-center gap-3"
        >
          <Sparkles className="w-5 h-5 text-white" />
          <span className="text-white font-medium">AI Assistant</span>
          <Maximize2 className="w-4 h-4 text-white/70" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-[400px] h-[600px] bg-white rounded-[20px] shadow-2xl border border-[#E5E7EB] flex flex-col z-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] rounded-t-[20px] p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-[10px] flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-medium text-white">AI Assistant</h3>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-[#10B981] rounded-full"></div>
              <span className="text-xs text-white/80">Always here to help</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(true)}
            className="p-2 hover:bg-white/10 rounded-[8px] transition-colors"
          >
            <Minimize2 className="w-4 h-4 text-white/70" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 hover:bg-white/10 rounded-[8px] transition-colors"
          >
            <X className="w-4 h-4 text-white/70" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-[16px] px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-[#4F46E5] text-white'
                  : 'bg-[#F9FAFB] text-[#374151] border border-[#E5E7EB]'
              }`}
            >
              {message.role === 'assistant' && (
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-3.5 h-3.5 text-[#4F46E5]" />
                  <span className="text-xs font-medium text-[#6B7280]">AI</span>
                </div>
              )}
              <div className="text-sm leading-relaxed whitespace-pre-wrap">
                {message.content}
              </div>
              <div className={`text-xs mt-2 ${
                message.role === 'user' ? 'text-white/60' : 'text-[#9CA3AF]'
              }`}>
                {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-[#E5E7EB] p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder={placeholder}
            className="flex-1 px-4 py-3 border border-[#E5E7EB] rounded-[12px] text-sm focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent"
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className="w-12 h-12 bg-[#4F46E5] text-white rounded-[12px] flex items-center justify-center hover:bg-[#4338CA] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <div className="mt-3 flex gap-2 flex-wrap">
          <button
            onClick={() => setInputValue('Explain this step by step')}
            className="text-xs px-3 py-1.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-full hover:bg-[#F3F4F6] transition-colors"
          >
            💡 Explain step by step
          </button>
          <button
            onClick={() => setInputValue('What am I missing?')}
            className="text-xs px-3 py-1.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-full hover:bg-[#F3F4F6] transition-colors"
          >
            🤔 What am I missing?
          </button>
          <button
            onClick={() => setInputValue('Give me a hint')}
            className="text-xs px-3 py-1.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-full hover:bg-[#F3F4F6] transition-colors"
          >
            🎯 Give me a hint
          </button>
        </div>
      </div>
    </div>
  );
}
