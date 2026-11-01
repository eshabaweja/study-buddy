export const SESSION_RELOGIN_MESSAGE =
  'Your session expired. Please log in again.';

export const SESSION_EXPIRED_EVENT = 'ba:session-expired';
const SESSION_MESSAGE_KEY = 'baSessionMessage';

let sessionExpiredNotified = false;
let sessionExpiredHandler = null;

export function registerSessionExpiredHandler(handler) {
  sessionExpiredHandler = handler;
  return () => {
    if (sessionExpiredHandler === handler) {
      sessionExpiredHandler = null;
    }
  };
}

export function hasSessionExpired() {
  return sessionExpiredNotified;
}

export function isSessionReloginMessage(message) {
  return (
    typeof message === 'string' &&
    message.trim() === SESSION_RELOGIN_MESSAGE
  );
}

export class SessionExpiredError extends Error {
  constructor(message = SESSION_RELOGIN_MESSAGE) {
    super(message);
    this.name = 'SessionExpiredError';
  }
}

export function isSessionReloginError(err) {
  if (err instanceof SessionExpiredError) return true;
  const message = err instanceof Error ? err.message : String(err ?? '');
  return isSessionReloginMessage(message);
}

export function apiErrorMessage(err, fallback = 'Request failed') {
  if (isSessionReloginError(err)) return null;
  return err instanceof Error ? err.message : fallback;
}

export function notifySessionExpired(message = SESSION_RELOGIN_MESSAGE) {
  sessionStorage.setItem(SESSION_MESSAGE_KEY, message);
  if (sessionExpiredHandler) {
    sessionExpiredNotified = true;
    sessionExpiredHandler(message);
    return;
  }
  if (sessionExpiredNotified) return;
  sessionExpiredNotified = true;
  window.dispatchEvent(
    new CustomEvent(SESSION_EXPIRED_EVENT, { detail: { message } }),
  );
}

export function readStoredSessionMessage() {
  return sessionStorage.getItem(SESSION_MESSAGE_KEY) || '';
}

export function clearStoredSessionMessage() {
  sessionStorage.removeItem(SESSION_MESSAGE_KEY);
}

export function resetSessionAuthState() {
  sessionExpiredNotified = false;
  clearStoredSessionMessage();
}
