import { toast as reactToastify } from 'react-toastify';
import {
  hasSessionExpired,
  isSessionReloginMessage,
  SESSION_RELOGIN_MESSAGE,
} from './sessionAuth';

const SESSION_TOAST_ID = 'app-session-expired';

/** One combined toast for session expiry (deduped by toastId). */
export function showSessionExpiredToast(message = SESSION_RELOGIN_MESSAGE) {
  reactToastify.info(message, { toastId: SESSION_TOAST_ID });
}

export const toast = {
  ...reactToastify,
  error(message, options) {
    if (isSessionReloginMessage(message)) {
      showSessionExpiredToast(message);
      return;
    }
    if (hasSessionExpired()) return;
    return reactToastify.error(message, options);
  },
};
