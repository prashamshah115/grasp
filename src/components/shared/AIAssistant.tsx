import { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Minimize2, Maximize2, Loader2, MessageSquare, RotateCcw } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/components/auth/AuthProvider';
import { useChat } from '@/hooks/useChat';
import type { UIMessage, ChatCitation } from '@/types/chat';

interface AIAssistantProps {
  context?: string; // Current question or topic context (for display only)
  topicId?: string; // Topic ID for RAG context
  courseId?: string; // Course ID for RAG context
  questionId?: string; // Question ID for RAG context (practice/exam questions)
  mode?: 'practice' | 'exam' | 'compression' | 'general'; // Current app mode for context-aware prompts
  placeholder?: string;
  compressionNotes?: string; // Compression notes content for context
}

export function AIAssistant({ 
  context, 
  topicId, 
  courseId,
  questionId,
  mode = 'general',
  placeholder,
  compressionNotes
}: AIAssistantProps) {
  const { courseId: urlCourseId } = useParams<{ courseId?: string }>();
  const { user } = useAuth();
  
  // Use the new persistent chat hook
  const {
    thread,
    messages: chatMessages,
    isLoading,
    isSending,
    error: chatError,
    sendMessage,
    clearChat,
  } = useChat({
    topicId: topicId || undefined,
    courseId: courseId || urlCourseId || undefined,
    questionId: questionId || undefined,
    compressionNotes: compressionNotes || undefined,
  });
  
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Context-aware initial greeting
  const getInitialGreeting = () => {
    const hasQuestionContext = questionId && context
    const questionContextNote = hasQuestionContext 
      ? ' I can see the current question you\'re working on.'
      : ''
    
    switch (mode) {
      case 'practice':
        return `👋 Hi! I'm here to help with your practice questions.${questionContextNote} I can explain concepts, break down problems step-by-step, or give you hints without spoiling the answer. What would you like help with?`;
      case 'exam':
        return `👋 Exam mode!${questionContextNote} I can help clarify concepts and guide your thinking, but I'll let you work through the problems yourself. What would you like to understand better?`;
      case 'compression':
        return '👋 Ready to help you understand the compression notes! I can explain concepts in detail, clarify confusing parts, or help you connect ideas. What would you like to explore?';
      default:
        return `👋 Hi! I'm your AI study assistant.${questionContextNote} I can help explain concepts, break down problems, or guide you through solutions. What would you like to know?`;
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
        return [
          { text: 'Explain this step by step', icon: '💡' },
          { text: 'What am I missing?', icon: '🤔' },
          { text: 'Give me a hint', icon: '🎯' },
        ];
    }
  };

  // Build display messages (combine greeting with chat history)
  const displayMessages: UIMessage[] = [
    // Initial greeting
    {
      id: 'greeting',
      thread_id: thread?.id || '',
      user_id: null,
      role: 'assistant',
      content: getInitialGreeting(),
      token_count: null,
      model_used: null,
      raw_response: null,
      created_at: new Date().toISOString(),
    },
    // Chat messages from database/state
    ...chatMessages,
  ];

  const promptSuggestions = getPromptSuggestions();

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayMessages.length]);

  const handleSend = async () => {
    if (!inputValue.trim() || !user || isSending) return;

    const messageText = inputValue;
    setInputValue('');
    
    await sendMessage(messageText);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearChat = () => {
    clearChat();
  };

  // Render a single message
  const renderMessage = (message: UIMessage) => {
    const isUser = message.role === 'user';
    const hasError = !!message.error;
    
    return (
      <div
        key={message.id}
        className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
      >
        <div
          className={`max-w-[85%] rounded-[16px] px-4 py-3 ${
            isUser
              ? 'bg-[#4F46E5] text-white'
              : hasError
              ? 'bg-red-50 text-red-700 border border-red-200'
              : 'bg-[#F9FAFB] text-[#374151] border border-[#E5E7EB]'
          }`}
        >
          {!isUser && (
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className={`w-3.5 h-3.5 ${hasError ? 'text-red-500' : 'text-[#4F46E5]'}`} />
              <span className="text-xs font-medium text-[#6B7280]">AI</span>
            </div>
          )}
          <div className="text-sm leading-relaxed whitespace-pre-wrap">
            {message.content}
          </div>
{/* Sources hidden for cleaner UI */}
          <div className={`text-xs mt-2 ${
            isUser ? 'text-white/60' : 'text-[#9CA3AF]'
          }`}>
            {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>
    );
  };

  // Closed state - floating button
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] rounded-full shadow-2xl hover:scale-110 transition-transform flex items-center justify-center group z-50"
      >
        <Sparkles className="w-7 h-7 text-white" />
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-[#10B981] rounded-full animate-pulse"></div>
        {/* Show message count badge if there are messages */}
        {chatMessages.length > 0 && (
          <div className="absolute -top-1 -left-1 w-5 h-5 bg-[#4F46E5] rounded-full flex items-center justify-center">
            <span className="text-xs text-white font-medium">{chatMessages.length}</span>
          </div>
        )}
      </button>
    );
  }

  // Minimized state
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className="bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] rounded-[16px] px-5 py-3 shadow-2xl hover:scale-105 transition-transform flex items-center gap-3"
        >
          <Sparkles className="w-5 h-5 text-white" />
          <span className="text-white font-medium">AI Assistant</span>
          {chatMessages.length > 0 && (
            <span className="text-white/70 text-sm">({chatMessages.length})</span>
          )}
          <Maximize2 className="w-4 h-4 text-white/70" />
        </button>
      </div>
    );
  }

  // Full chat interface
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
              <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-yellow-400 animate-pulse' : 'bg-[#10B981]'}`}></div>
              <span className="text-xs text-white/80">
                {isLoading ? 'Loading...' : isSending ? 'Thinking...' : 'Ready to help'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {chatMessages.length > 0 && (
            <button
              onClick={handleClearChat}
              className="p-2 hover:bg-white/10 rounded-[8px] transition-colors"
              title="Clear chat"
            >
              <RotateCcw className="w-4 h-4 text-white/70" />
            </button>
          )}
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

      {/* Thread indicator */}
      {thread && (
        <div className="px-4 py-2 bg-[#F9FAFB] border-b border-[#E5E7EB] flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-[#6B7280]" />
          <span className="text-xs text-[#6B7280]">
            {chatMessages.length} message{chatMessages.length !== 1 ? 's' : ''} in this conversation
          </span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {displayMessages.map(renderMessage)}
        
        {/* Loading indicator */}
        {isSending && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-[16px] px-4 py-3 bg-[#F9FAFB] text-[#374151] border border-[#E5E7EB]">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-[#4F46E5] animate-spin" />
                <span className="text-sm text-[#6B7280]">Thinking...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Error display */}
      {chatError && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-200">
          <p className="text-xs text-red-600">{chatError}</p>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-[#E5E7EB] p-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={getPlaceholder()}
            disabled={isSending || isLoading}
            className="flex-1 px-4 py-3 border border-[#E5E7EB] rounded-[12px] text-sm focus:outline-none focus:ring-2 focus:ring-[#4F46E5] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isSending || isLoading}
            className="w-12 h-12 bg-[#4F46E5] text-white rounded-[12px] flex items-center justify-center hover:bg-[#4338CA] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? (
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
              disabled={isSending || isLoading}
              className="text-xs px-3 py-1.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-full hover:bg-[#F3F4F6] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {prompt.icon} {prompt.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
