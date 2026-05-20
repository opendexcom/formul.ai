import React, { useEffect, useRef } from 'react';
import type { PluginSlotMountResult } from './types';

const POLL_MS = 100;
const MAX_POLL_MS = 15_000;

type PluginSlotProps = {
  name: string;
  className?: string;
};

/**
 * Mounts an EE (or other plugin) UI fragment into a host form.
 */
const PluginSlot: React.FC<PluginSlotProps> = ({ name, className }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountResultRef = useRef<PluginSlotMountResult | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let interval: ReturnType<typeof setInterval> | null = null;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const tryMount = () => {
      const slot = window.__FORMULAI_UI__?.slots?.[name];
      if (!slot?.mount || mountResultRef.current) return false;
      mountResultRef.current = slot.mount(container);
      return true;
    };

    if (tryMount()) {
      return () => {
        mountResultRef.current?.unmount();
        mountResultRef.current = null;
      };
    }

    interval = setInterval(() => {
      if (tryMount() && interval) {
        clearInterval(interval);
        interval = null;
      }
    }, POLL_MS);

    timeout = setTimeout(() => {
      if (interval) clearInterval(interval);
    }, MAX_POLL_MS);

    return () => {
      if (interval) clearInterval(interval);
      if (timeout) clearTimeout(timeout);
      mountResultRef.current?.unmount();
      mountResultRef.current = null;
    };
  }, [name]);

  return <div ref={containerRef} className={className} data-plugin-slot={name} />;
};

export default PluginSlot;
