import { useCallback, useEffect, useState } from 'react';
import type { PluginSlotApi } from './types';

const POLL_MS = 100;

export function usePluginSlot(slotName: string): {
  slotActive: boolean;
  api: PluginSlotApi | undefined;
  refresh: () => void;
} {
  const [slotActive, setSlotActive] = useState(false);
  const [api, setApi] = useState<PluginSlotApi | undefined>();

  const refresh = useCallback(() => {
    const slotApi = window.__FORMULAI_SLOT_APIS__?.[slotName];
    setApi(slotApi);
    setSlotActive(!!window.__FORMULAI_UI__?.slots?.[slotName]);
  }, [slotName]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  return { slotActive, api, refresh };
}
