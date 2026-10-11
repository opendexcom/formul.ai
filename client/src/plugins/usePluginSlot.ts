import { useCallback, useEffect, useState } from 'react';
import {
  FORMULAI_UI_READY_EVENT,
  FORMULAI_SLOT_API_UPDATED_EVENT,
  getFormulaiUiManifest,
  type PluginSlotApi,
} from './types';

export function usePluginSlot(name: string): {
  slotActive: boolean;
  api: PluginSlotApi | undefined;
  refresh: () => void;
} {
  const [slotActive, setSlotActive] = useState(() => !!getFormulaiUiManifest()?.slots?.[name]);
  const [api, setApi] = useState<PluginSlotApi | undefined>(
    () => window.__FORMULAI_SLOT_APIS__?.[name],
  );
  const [, setRevision] = useState(0);

  const refresh = useCallback(() => {
    setSlotActive(!!getFormulaiUiManifest()?.slots?.[name]);
    setApi(window.__FORMULAI_SLOT_APIS__?.[name]);
    setRevision((value) => value + 1);
  }, [name]);

  useEffect(() => {
    const sync = () => refresh();
    sync();
    window.addEventListener(FORMULAI_UI_READY_EVENT, sync);
    window.addEventListener(FORMULAI_SLOT_API_UPDATED_EVENT, sync);
    return () => {
      window.removeEventListener(FORMULAI_UI_READY_EVENT, sync);
      window.removeEventListener(FORMULAI_SLOT_API_UPDATED_EVENT, sync);
    };
  }, [refresh]);

  return { slotActive, api, refresh };
}
