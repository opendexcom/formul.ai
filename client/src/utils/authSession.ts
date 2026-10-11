export const AUTH_UNAUTHORIZED_EVENT = 'formulai:auth:unauthorized';

export function clearAuthSession(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

/** Clear stored credentials and notify React auth state to reset. */
export function notifyUnauthorized(): void {
  clearAuthSession();
  window.dispatchEvent(new Event(AUTH_UNAUTHORIZED_EVENT));
}

/** Shared handler for API 401 responses (axios and fetch). */
export function handleUnauthorizedResponse(): void {
  notifyUnauthorized();
  if (window.location.pathname !== '/') {
    window.location.replace('/');
  }
}
