import React, { useEffect, useRef } from 'react';
import { FORMULAI_UI_READY_EVENT, getFormulaiUiManifest } from './types';

type PluginSlotProps = {
  name: string;
  className?: string;
};

const PluginSlot: React.FC<PluginSlotProps> = ({ name, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const unmountRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const mountSlot = () => {
      const container = containerRef.current;
      const slot = getFormulaiUiManifest()?.slots?.[name];
      if (!container || !slot || unmountRef.current) return;

      const handle = slot.mount(container);
      unmountRef.current = handle.unmount;
    };

    mountSlot();
    const onReady = () => mountSlot();
    window.addEventListener(FORMULAI_UI_READY_EVENT, onReady);
    return () => {
      window.removeEventListener(FORMULAI_UI_READY_EVENT, onReady);
      unmountRef.current?.();
      unmountRef.current = null;
    };
  }, [name]);

  return <div ref={containerRef} className={className} />;
};

export default PluginSlot;
