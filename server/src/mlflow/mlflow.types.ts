export type CacheMode = 'exact' | 'semantic';
export type CacheScope = 'global' | 'form' | 'user' | 'user_document' | 'none';

export interface CachePolicy {
  enabled: boolean;
  mode: CacheMode;
  scope: CacheScope;
  ttl_seconds?: number;
  similarity?: number;
}

export interface FlowDefinition {
  prompt: string;
  system_prompt?: string;
  allowed_variables?: string[];
  cache?: Partial<CachePolicy>;
}

export interface FlowsConfig {
  version: number;
  defaults?: {
    prompt_alias?: string;
    model_config?: Record<string, string>;
  };
  flows: Record<string, Record<string, FlowDefinition>>;
}

export interface LoadedPrompt {
  name: string;
  version: string;
  template: string;
  alias: string;
}

export interface FormattedFlowPrompt {
  prompt: string;
  systemPrompt?: string;
  loaded: LoadedPrompt;
  systemLoaded?: LoadedPrompt;
}

export type FlowKey = string;

export interface InvokeFlowOptions {
  skipValidation?: boolean;
  useJsonFormat?: boolean;
  structuredOutput?: boolean;
  maxTokens?: number;
  timeoutMs?: number;
  document?: { base64: string; mimetype: string; filename?: string };
  cacheScopeId?: string;
  sessionId?: string;
  userId?: string;
  formId?: string;
  documentHash?: string;
}

export interface CacheContext {
  flowKey: FlowKey;
  scopeId: string;
  promptVersion: string;
  model: string;
  useJsonFormat: boolean;
}
