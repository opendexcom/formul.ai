export type SignupSlotValues = {
  acceptedTerms?: boolean;
};

export type DocumentAttachSlotValues = {
  attachedFile?: File | null;
};

export type PluginSlotApi = {
  getValues(): SignupSlotValues | DocumentAttachSlotValues;
  isValid(): boolean;
  getAttachedFile?(): File | null;
  clearAttachedFile?(): void;
  supportsDocumentUpload?(): boolean;
};

export type PluginSlotMountResult = {
  unmount: () => void;
  getApi?: () => PluginSlotApi | undefined;
};

export type PluginSlotDefinition = {
  mount: (el: HTMLElement) => PluginSlotMountResult;
};

export type PluginRouteDefinition = {
  path: string;
  public?: boolean;
  mount: (el: HTMLElement) => () => void;
};

export type FormulaiUiManifest = {
  routes?: PluginRouteDefinition[];
  slots?: Record<string, PluginSlotDefinition>;
};

declare global {
  interface Window {
    __FORMULAI_UI__?: FormulaiUiManifest;
    __FORMULAI_SLOT_APIS__?: Record<string, PluginSlotApi>;
  }
}

export {};
