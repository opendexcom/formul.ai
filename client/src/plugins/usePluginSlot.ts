import { useEffect, useState } from 'react';
import {
  FORMULAI_UI_READY_EVENT,
  getFormulaiUiManifest,
  type PluginSlotApi,
} from './types';

export function usePluginSlot(slotName: string) {
  const [slotActive, setSlotActive] = useState(
    () => Boolean(getFormulaiUiManifest()?.slots?.[slotName]),
  );
  const [api, setApi] = useState<PluginSlotApi | undefined>(
    () => window.__FORMULAI_SLOT_APIS__?.[slotName],
  );

  const refresh = () => {
    setSlotActive(Boolean(getFormulaiUiManifest()?.slots?.[slotName]));
    setApi(window.__FORMULAI_SLOT_APIS__?.[slotName]);
  };

  useEffect(() => {
    refresh();
    const onReady = () => refresh();
    window.addEventListener(FORMULAI_UI_READY_EVENT, onReady);
    return () => window.removeEventListener(FORMULAI_UI_READY_EVENT, onReady);
  }, [slotName]);

  return { slotActive, api, refresh };
}
