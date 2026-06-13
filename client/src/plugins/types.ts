export type PluginRouteDefinition = {
  path: string;
  public?: boolean;
  requiresRole?: string;
  requiresFeature?: string;
  mount: (el: HTMLElement) => () => void;
};

export type PluginNavItem = {
  id: string;
  label: string;
  path: string;
  location: 'header-link' | 'apps-menu';
  requiresFeature?: string;
  requiresRole?: string;
  external?: boolean;
};

export type PluginSlotDefinition = {
  mount: (el: HTMLElement) => { unmount: () => void };
};

export type DocumentUploadParams = {
  prompt: string;
  file: File;
  mode: 'generate' | 'refine';
  currentForm?: unknown;
  token?: string | null;
  apiBaseUrl: string;
};

export type SignupSlotApi = {
  getValues?: () => { acceptedTerms?: boolean };
  isValid?: () => boolean;
};

export type DocumentSlotApi = {
  getValues?: () => Record<string, unknown>;
  isValid?: () => boolean;
  getAttachedFile?: () => File | null;
  clearAttachedFile?: () => void;
  supportsDocumentUpload?: () => boolean;
  submitWithDocument?: (params: DocumentUploadParams) => Promise<Response>;
};

export type PluginSlotApi = SignupSlotApi | DocumentSlotApi;

export type FormulaiUiManifest = {
  routes?: PluginRouteDefinition[];
  nav?: PluginNavItem[];
  slots?: Record<string, PluginSlotDefinition>;
};

export const FORMULAI_UI_READY_EVENT = 'formulai:ui-ready';

export function getFormulaiUiManifest(): FormulaiUiManifest | undefined {
  return typeof window !== 'undefined' ? window.__FORMULAI_UI__ : undefined;
}

export function dispatchFormulaiUiReady(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(FORMULAI_UI_READY_EVENT));
}
