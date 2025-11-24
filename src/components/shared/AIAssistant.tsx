import { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Minimize2, Maximize2, Loader2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthProvider';
import { useRAGChat } from '@/hooks/useRAGChat';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  citations?: string[];
  pages?: Array<{ doc_title: string; page_number: number }>;
}

interface AIAssistantProps {
  context?: string; // Current question or topic context (for display only)
  topicId?: string; // Topic ID for RAG context
  courseId?: string; // Course ID for RAG context
  questionId?: string; // Question ID for RAG context (practice/exam questions)
  mode?: 'practice' | 'exam' | 'compression' | 'general'; // Current app mode for context-aware prompts
  placeholder?: string;
}

export function AIAssistant({ 
  context, 
  topicId, 
  courseId,
  questionId,
  mode = 'general',
  placeholder 
}: AIAssistantProps) {
  const { courseId: urlCourseId } = useParams<{ courseId?: string }>();
  const { user } = useAuth();
  const chatMutation = useRAGChat();
  
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  
  // Context-aware initial greeting
  const getInitialGreeting = () => {
    switch (mode) {
      case 'practice':
        return '👋 Hi! I\'m here to help with your practice questions. I can explain concepts, break down problems step-by-step, or give you hints without spoiling the answer. What would you like help with?';
      case 'exam':
        return '👋 Exam mode! I can help clarify concepts and guide your thinking, but I\'ll let you work through the problems yourself. What would you like to understand better?';
      case 'compression':
        return '👋 Ready to help you understand the compression notes! I can explain concepts in detail, clarify confusing parts, or help you connect ideas. What would you like to explore?';
      default:
        return '👋 Hi! I\'m your AI study assistant. I can help explain concepts, break down problems, or guide you through solutions. What would you like to know?';
    }
  };
  
  // Context-aware placeholder
  const getPlaceholder = () => {
    if (placeholder) return placeholder;
    switch (mode) {
      case 'practice':
        return 'Ask about this question or concept...';
      case 'exam':
        return 'Ask for clarification (I won\'t give answers)...';
      case 'compression':
        return 'Ask me to explain any concept in detail...';
      default:
        return 'Ask me anything about this material...';
    }
  };
  
  // Context-aware prompt suggestions
  const getPromptSuggestions = () => {
    const basePrompts = [
      { text: 'Explain this step by step', icon: '💡' },
      { text: 'What am I missing?', icon: '🤔' },
      { text: 'Give me a hint', icon: '🎯' },
    ];
    
    switch (mode) {
      case 'practice':
        return [
          { text: 'Explain this concept from the ground up', icon: '📚' },
          { text: 'Walk me through solving this step-by-step', icon: '🔍' },
          { text: 'What\'s the key insight here?', icon: '💡' },
          { text: 'Give me a hint without the answer', icon: '🎯' },
        ];
      case 'exam':
        return [
          { text: 'Clarify this concept', icon: '📖' },
          { text: 'What should I remember here?', icon: '🧠' },
          { text: 'Explain the underlying principle', icon: '🔬' },
        ];
      case 'compression':
        return [
          { text: 'Explain this concept in detail', icon: '📖' },
          { text: 'How does this relate to other topics?', icon: '🔗' },
          { text: 'Give me examples of this', icon: '💡' },
          { text: 'What are common mistakes here?', icon: '⚠️' },
        ];
      default:
        return basePrompts;
    }
  };
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: getInitialGreeting(),
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const promptSuggestions = getPromptSuggestions();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || !user) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const messageText = inputValue;
    setInputValue('');

    // Call real RAG API with full context
    try {
      const response = await chatMutation.mutateAsync({
        user_id: user.id,
        topic_id: topicId || '',
        course_id: courseId || urlCourseId || '',
        question_id: questionId || '',
        message: messageText,
      });

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.answer,
        citations: response.citations,
        pages: response.pages,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('RAG chat error:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your message. Please try again.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
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
              {message.citations && message.citations.length > 0 && (
                <div className="mt-2 pt-2 border-t border-[#E5E7EB]">
                  <div className="text-xs text-[#6B7280] font-medium mb-1">Sources:</div>
                  <div className="text-xs text-[#9CA3AF] space-y-1">
                    {message.citations.map((citation, idx) => (
                      <div key={idx}>{citation}</div>
                    ))}
                  </div>
                </div>
              )}
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
            placeholder={getPlaceholder()}
            className="flex-1 px-4 py-3 border border-[#E5E7EB] rounded-[12px] text-sm focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent"
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || chatMutation.isPending}
            className="w-12 h-12 bg-[#4F46E5] text-white rounded-[12px] flex items-center justify-center hover:bg-[#4338CA] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {chatMutation.isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
        <div className="mt-3 flex gap-2 flex-wrap">
          {promptSuggestions.slice(0, 3).map((prompt, idx) => (
            <button
              key={idx}
              onClick={() => setInputValue(prompt.text)}
              className="text-xs px-3 py-1.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-full hover:bg-[#F3F4F6] transition-colors"
            >
              {prompt.icon} {prompt.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
