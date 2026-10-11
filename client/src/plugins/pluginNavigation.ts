import React, { useEffect } from 'react';
import { FORMULAI_UI_READY_EVENT, getFormulaiUiManifest } from './types';

export function usePluginNav() {
  const [nav, setNav] = React.useState(() => getFormulaiUiManifest()?.nav ?? []);

  useEffect(() => {
    const sync = () => setNav(getFormulaiUiManifest()?.nav ?? []);
    sync();
    window.addEventListener(FORMULAI_UI_READY_EVENT, sync);
    return () => window.removeEventListener(FORMULAI_UI_READY_EVENT, sync);
  }, []);

  return nav;
}
