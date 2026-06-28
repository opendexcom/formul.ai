import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { GeneratedForm } from '../../services/aiService';
import PluginSlot from '../../plugins/PluginSlot';
import { usePluginSlot } from '../../plugins/usePluginSlot';
import type { DocumentSlotApi } from '../../plugins/types';
import { FORMULAI_SLOT_API_UPDATED_EVENT } from '../../plugins/types';
import { useUsageLimits } from '../../hooks/useUsageLimits';
import { parseQuotaErrorFromResponse } from '../../utils/quotaErrors';
import { resolveApiBaseUrl } from '../../utils/apiBaseUrl';

const DOCUMENT_ATTACH_SLOT = 'formEditor.aiChat.documentAttach';

const getLiveDocumentApi = (): DocumentSlotApi | undefined =>
  window.__FORMULAI_SLOT_APIS__?.[DOCUMENT_ATTACH_SLOT] as DocumentSlotApi | undefined;

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
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [attachmentRevision, setAttachmentRevision] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { slotActive: documentSlotActive, refresh: refreshDocumentSlot } =
    usePluginSlot(DOCUMENT_ATTACH_SLOT);
  const { tokensExceeded, loading: limitsLoading } = useUsageLimits();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, processingSteps]);

  useEffect(() => {
    const onSlotApiUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ slotName?: string }>).detail;
      if (detail?.slotName !== DOCUMENT_ATTACH_SLOT) return;
      setAttachmentRevision((value) => value + 1);
    };
    window.addEventListener(FORMULAI_SLOT_API_UPDATED_EVENT, onSlotApiUpdated);
    return () => window.removeEventListener(FORMULAI_SLOT_API_UPDATED_EVENT, onSlotApiUpdated);
  }, []);

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

  const sendPrompt = async (promptText: string, file: File | null = null) => {
    const hasText = promptText.trim().length > 0;
    const hasFile = !!file;
    if ((!hasText && !hasFile) || isProcessing || tokensExceeded) return;

    const effectivePrompt = hasText ? promptText.trim() : 'Create a form based on this document.';
    const userMessageContent = hasFile
      ? (hasText ? `📎 ${file.name}\n\n${promptText.trim()}` : `📎 ${file.name}`)
      : promptText;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: userMessageContent,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setLastPrompt(effectivePrompt);
    setLastFile(file);
    setInput('');
    getLiveDocumentApi()?.clearAttachedFile?.();
    setIsProcessing(true);
    setProcessingSteps([]);
    setErrorMessage(null);

    try {
      const token = localStorage.getItem('token');
      const API_BASE_URL = resolveApiBaseUrl();
      const isRefine = !!(currentForm && (currentForm.questions?.length || 0) > 0);

      let response: Response;
      if (hasFile) {
        const liveDocApi = getLiveDocumentApi();
        if (!liveDocApi?.submitWithDocument) {
          throw new Error('Document upload is not available in this edition.');
        }
        response = await liveDocApi.submitWithDocument({
          prompt: effectivePrompt,
          file,
          mode: isRefine ? 'refine' : 'generate',
          currentForm,
          token,
          apiBaseUrl: API_BASE_URL,
        });
      } else {
        response = await fetch(`${API_BASE_URL}/ai/generate-stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            prompt: effectivePrompt,
            mode: isRefine ? 'refine' : 'generate',
            currentForm,
          }),
        });
      }

      if (!response.ok) {
        const quotaMessage = await parseQuotaErrorFromResponse(response);
        throw new Error(quotaMessage || 'Failed to generate form');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No response stream');

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

              if (step.step === 'generate' && step.status === 'completed' && step.data) {
                const formData = step.data as unknown as GeneratedForm;
                onFormGenerated(formData);

                setMessages(prev => [...prev, {
                  id: Date.now().toString(),
                  type: 'assistant',
                  content: `✅ Form "${formData.title}" has been generated successfully! You can now edit it in the canvas.`,
                  timestamp: new Date(),
                }]);
                
                setTimeout(() => setProcessingSteps([]), 2000);
              }
            } catch (e) {
              console.error('Failed to parse step:', e);
            }
          }
        }
      }

    } catch (error) {
      console.error('Error generating form:', error);
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to generate form. Please try again.';
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        type: 'system',
        content: `❌ ${message}`,
        timestamp: new Date(),
      }]);
      setErrorMessage(message);
    } finally {
      setIsProcessing(false);
    }
  };

  const attachedFile = getLiveDocumentApi()?.getAttachedFile?.() ?? null;
  void attachmentRevision;

  const getAttachedFile = (): File | null => attachedFile;

  const handleSend = async () => {
    refreshDocumentSlot();
    await sendPrompt(input, getAttachedFile());
  };

  const handleRetry = async () => {
    if (!lastPrompt) return;
    await sendPrompt(lastPrompt, lastFile);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (limitsLoading) {
    return (
      <div className="flex flex-col h-full bg-gray-50 items-center justify-center p-6">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (tokensExceeded) {
    return (
      <div className="flex flex-col h-full bg-gray-50 items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-4">
          <Sparkles className="w-6 h-6 text-amber-600" />
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-2">
          AI chat unavailable
        </h3>
        <p className="text-sm text-gray-600 max-w-[240px] mb-6 leading-relaxed">
          You&apos;ve used all tokens for this billing period. Upgrade your plan to continue using AI, or wait until your quota resets.
        </p>
        <Link
          to="/settings/billing"
          className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          View plan &amp; usage
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] rounded-lg px-4 py-2 ${message.type === 'user'
                ? 'bg-blue-600 text-white'
                : message.type === 'system'
                  ? 'bg-red-50 text-red-900 border border-red-200'
                  : 'bg-white text-gray-900 border border-gray-200'
                }`}>
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              <span className="text-xs opacity-70 mt-1 block">
                {message.timestamp.toLocaleTimeString()}
              </span>
            </div>
          </div>
        ))}

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

      <div className="border-t border-gray-200 bg-white p-4">
        {getAttachedFile() && (
          <div className="flex items-center gap-2 mb-2 text-sm">
            <span className="text-gray-600 truncate flex-1 min-w-0" title={getAttachedFile()!.name}>
              📎 {getAttachedFile()!.name}
            </span>
            <button
              type="button"
              onClick={() => getLiveDocumentApi()?.clearAttachedFile?.()}
              className="shrink-0 text-gray-500 hover:text-red-600 p-0.5 rounded"
              aria-label="Remove attachment"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="flex items-end gap-2 w-full">
          {documentSlotActive && <PluginSlot name="formEditor.aiChat.documentAttach" />}
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the form you want to create or how to modify it..."
            className="flex-1 min-w-0 resize-none border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={2}
            disabled={isProcessing}
          />

          <button
            onClick={handleSend}
            disabled={(!input.trim() && !getAttachedFile()) || isProcessing}
            className="h-10 w-10 shrink-0 flex items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            aria-label="Send message"
          >
            {isProcessing ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 12h14M12 5l7 7-7 7"
                />
              </svg>
            )}
          </button>
        </div>

        <p className="text-xs text-gray-500 mt-2">
          Press Enter to send, Shift+Enter for new line.
          {documentSlotActive ? ' Attach a PDF to create a form from a document.' : ''}
        </p>
      </div>
    </div>
  );
};

export default AIFormChat;