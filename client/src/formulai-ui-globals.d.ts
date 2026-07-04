/// <reference types="vite/client" />

import type { DocumentSlotApi, FormulaiUiManifest } from './plugins/types';

declare global {
  interface Window {
    __FORMULAI_UI__?: FormulaiUiManifest;
    __FORMULAI_EE__?: boolean;
    __FORMULAI_SLOT_APIS__?: Record<string, PluginSlotApi>;
    __FORMULAI_API_BASE_URL__?: string;
  }
}

export {};
