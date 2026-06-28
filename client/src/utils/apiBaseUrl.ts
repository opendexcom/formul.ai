/**
 * Resolve API base URL consistently across OSS + EE dev/prod setups.
 * Prefer same-origin /api (Vite proxy) over cross-origin localhost:3001.
 */
export function resolveApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const eeBase = (window as Window & { __FORMULAI_API_BASE_URL__?: string })
      .__FORMULAI_API_BASE_URL__;
    if (eeBase && typeof eeBase === 'string') {
      return eeBase.replace(/\/$/, '');
    }
  }

  const configured = import.meta.env.VITE_API_BASE_URL;
  if (configured) {
    if (configured.startsWith('/')) {
      return configured.replace(/\/$/, '');
    }
    return configured.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined') {
    return `${window.location.origin}/api`;
  }

  return 'http://localhost:3001/api';
}
