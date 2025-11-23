import React, { useState, useRef, useEffect } from 'react';
import { GeneratedForm } from '../../services/aiService';

interface Message {
  id: string;
  type: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

interface ProcessingStepData {
  progress?: number;
  formData?: GeneratedForm;
  error?: string;
  [key: string]: unknown;
}

interface ProcessingStep {
  step: string;
  message: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  data?: ProcessingStepData;
}

interface AIFormChatProps {
  currentForm?: GeneratedForm;
  onFormGenerated: (form: GeneratedForm) => void;
}

const AIFormChat: React.FC<AIFormChatProps> = ({ currentForm, onFormGenerated }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: 'Hi! I\'m your FormulAI assistant. Describe the form you want to create, and I\'ll build it step by step. For example: "I want to collect feedback about our software development process"',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingSteps, setProcessingSteps] = useState<ProcessingStep[]>([]);
  const [lastPrompt, setLastPrompt] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, processingSteps]);

  const getStepIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'in-progress':
        return (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
        );
      case 'error':
        return (
          <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <div className="w-4 h-4 border-2 border-gray-300 rounded-full"></div>
        );
    }
  };

  const sendPrompt = async (promptText: string) => {
    if (!promptText.trim() || isProcessing) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: promptText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setLastPrompt(promptText);
    setInput('');
    setIsProcessing(true);
    setProcessingSteps([]);
    setErrorMessage(null);

    try {
      const token = localStorage.getItem('token');
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api';
      
      const isRefine = !!(currentForm && (currentForm.questions?.length || 0) > 0);
      const response = await fetch(`${API_BASE_URL}/ai/generate-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          prompt: promptText,
          mode: isRefine ? 'refine' : 'generate',
          currentForm,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate form');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response stream');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            
            try {
              const step: ProcessingStep = JSON.parse(data);
              if (step.status === 'error') {
                setErrorMessage(step.message || 'An error occurred');
              }
              setProcessingSteps(prev => {
                const existing = prev.findIndex(s => s.step === step.step);
                if (existing >= 0) {
                  const updated = [...prev];
                  updated[existing] = step;
                  return updated;
                }
                return [...prev, step];
              });

              // If this is the final step with the form data
              if (step.step === 'generate' && step.status === 'completed' && step.data) {
                onFormGenerated(step.data);
                
                setMessages(prev => [...prev, {
                  id: Date.now().toString(),
                  type: 'assistant',
                  content: `✅ Form "${step.data.title}" has been generated successfully! You can now edit it in the canvas.`,
                  timestamp: new Date(),
                }]);
              }
            } catch (e) {
              console.error('Failed to parse step:', e);
            }
          }
        }
      }

    } catch (error) {
      console.error('Error generating form:', error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: 'system',
        content: '❌ Failed to generate form. Please try again.',
        timestamp: new Date(),
      }]);
      setErrorMessage('Failed to generate form.');
    } finally {
      setIsProcessing(false);
      setTimeout(() => setProcessingSteps([]), 2000);
    }
  };

  const handleSend = async () => {
    await sendPrompt(input);
  };

  const handleRetry = async () => {
    if (!lastPrompt) return;
    await sendPrompt(lastPrompt);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.type === 'user'
                  ? 'bg-blue-600 text-white'
                  : message.type === 'system'
                  ? 'bg-red-50 text-red-900 border border-red-200'
                  : 'bg-white text-gray-900 border border-gray-200'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              <span className="text-xs opacity-70 mt-1 block">
                {message.timestamp.toLocaleTimeString()}
              </span>
            </div>
          </div>
        ))}

        {/* Processing Steps */}
        {isProcessing && processingSteps.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="space-y-2">
              {processingSteps.map((step) => (
                <div key={step.step} className="flex items-start gap-3">
                  <div className="mt-0.5">{getStepIcon(step.status)}</div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-900">{step.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error Notice and Retry */}
      {errorMessage && !isProcessing && (
        <div className="border-t border-gray-200 bg-white p-3 flex items-center justify-between">
          <span className="text-sm text-red-600 truncate">{errorMessage}</span>
          <button
            onClick={handleRetry}
            className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
          >
            Retry
          </button>
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-gray-200 bg-white p-4">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the form you want to create or how to modify it..."
            className="flex-1 resize-none border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={2}
            disabled={isProcessing}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isProcessing}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isProcessing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Processing...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Generate</span>
              </>
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
};

export default AIFormChat;
