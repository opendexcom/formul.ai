import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
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

  useLayoutEffect(() => {
    const field = inputRef.current;
    if (!field) return;
    if (!field.value) {
      field.style.height = '';
      field.style.overflowY = 'hidden';
      return;
    }
    field.style.height = 'auto';
    const next = Math.min(field.scrollHeight, 160);
    field.style.height = `${next}px`;
    field.style.overflowY = field.scrollHeight > 160 ? 'auto' : 'hidden';
  }, [input, limitsLoading, tokensExceeded]);

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
    <div className="flex h-full flex-col bg-gray-50">
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`flex max-w-[85%] flex-col gap-1 rounded-xl p-3 ${
                message.type === 'user'
                  ? 'bg-blue-600 text-white'
                  : message.type === 'system'
                    ? 'border border-red-200 bg-red-50 text-red-900'
                    : 'w-[230px] max-w-full bg-white text-gray-900'
              }`}
            >
              <p className="whitespace-pre-wrap text-[13px] leading-[18px]">{message.content}</p>
              <span
                className={`text-[10px] leading-3 ${
                  message.type === 'user' ? 'text-white/70' : 'text-gray-400'
                }`}
              >
                {message.timestamp.toLocaleTimeString()}
              </span>
            </div>
          </div>
        ))}

        {isProcessing && processingSteps.length > 0 && (
          <div className="rounded-xl bg-white p-3">
            <div className="space-y-2">
              {processingSteps.map((step) => (
                <div key={step.step} className="flex items-start gap-3">
                  <div className="mt-0.5">{getStepIcon(step.status)}</div>
                  <div className="flex-1">
                    <p className="text-[13px] leading-[18px] text-gray-900">{step.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {errorMessage && !isProcessing && (
        <div className="flex items-center justify-between bg-white p-3">
          <span className="truncate text-sm text-red-600">{errorMessage}</span>
          <button
            onClick={handleRetry}
            className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      <div className="p-3">
        {getAttachedFile() && (
          <div className="mb-2 flex items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate text-gray-600" title={getAttachedFile()!.name}>
              {getAttachedFile()!.name}
            </span>
            <button
              type="button"
              onClick={() => getLiveDocumentApi()?.clearAttachedFile?.()}
              className="shrink-0 rounded p-0.5 text-gray-500 hover:text-red-600"
              aria-label="Remove attachment"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        <div className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 focus-within:border-gray-300">
          <textarea
            ref={inputRef}
            value={input}
            rows={1}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the form you want to create..."
            className="max-h-40 w-full resize-none overflow-hidden bg-transparent px-1 py-1 text-sm leading-5 text-gray-900 outline-none placeholder:text-gray-400"
            disabled={isProcessing}
          />
          <div className="flex h-7 items-center justify-between">
            {documentSlotActive ? (
              <PluginSlot name="formEditor.aiChat.documentAttach" />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center text-lg leading-none text-gray-400" aria-hidden>
                +
              </span>
            )}
            <button
              type="button"
              onClick={handleSend}
              disabled={(!input.trim() && !getAttachedFile()) || isProcessing}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
              aria-label="Send message"
            >
              {isProcessing ? (
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-b-2 border-current"></div>
              ) : (
                <span className="text-base font-bold leading-none">↑</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIFormChat;