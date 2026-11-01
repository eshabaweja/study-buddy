import { createContext, useContext, useState, useEffect, useLayoutEffect, useCallback } from 'react';
import {
  SESSION_RELOGIN_MESSAGE,
  clearStoredSessionMessage,
  readStoredSessionMessage,
  registerSessionExpiredHandler,
  resetSessionAuthState,
} from '../utils/sessionAuth';
import { showSessionExpiredToast } from '../utils/toast';

const AuthContext = createContext(undefined);

function readStoredAuth() {
  const email = localStorage.getItem('userEmail');
  const name = localStorage.getItem('userName');
  const token = localStorage.getItem('token');
  if (!email || !name || !token) {
    return {
      isAuthenticated: false,
      userEmail: null,
      userName: null,
      isInstructor: false,
      isAdmin: false,
    };
  }
  return {
    isAuthenticated: true,
    userEmail: email,
    userName: name,
    isInstructor: localStorage.getItem('isInstructor') === 'true',
    isAdmin: localStorage.getItem('isAdmin') === 'true',
  };
}

function clearStoredAuth() {
  localStorage.removeItem('userEmail');
  localStorage.removeItem('userName');
  localStorage.removeItem('isInstructor');
  localStorage.removeItem('isAdmin');
  localStorage.removeItem('token');
}

function preparePendingSessionToast() {
  const email = localStorage.getItem('userEmail');
  const name = localStorage.getItem('userName');
  const token = localStorage.getItem('token');
  if (email && name && !token) {
    sessionStorage.setItem('baSessionMessage', SESSION_RELOGIN_MESSAGE);
    clearStoredAuth();
  }
  return readStoredSessionMessage() || null;
}

export const AuthProvider = ({ children }) => {
  const [storedAuth, setStoredAuth] = useState(readStoredAuth);
  const [pendingSessionToast, setPendingSessionToast] = useState(preparePendingSessionToast);
  const {
    isAuthenticated,
    userEmail,
    userName,
    isInstructor,
    isAdmin,
  } = storedAuth;

  const logout = useCallback(() => {
    clearStoredAuth();
    setStoredAuth(readStoredAuth());
  }, []);

  useLayoutEffect(() => {
    return registerSessionExpiredHandler(() => {
      clearStoredAuth();
      setStoredAuth(readStoredAuth());
      setPendingSessionToast(readStoredSessionMessage() || SESSION_RELOGIN_MESSAGE);
    });
  }, []);

  useEffect(() => {
    const syncFromStorage = () => setStoredAuth(readStoredAuth());
    syncFromStorage();
    window.addEventListener('storage', syncFromStorage);
    return () => window.removeEventListener('storage', syncFromStorage);
  }, []);

  useEffect(() => {
    if (!pendingSessionToast) return undefined;

    const timer = window.setTimeout(() => {
      showSessionExpiredToast(pendingSessionToast);
      clearStoredSessionMessage();
      setPendingSessionToast(null);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [pendingSessionToast]);

  const login = (email, name, isInstructor, token, isAdmin = false) => {
    resetSessionAuthState();
    setPendingSessionToast(null);
    localStorage.setItem('userEmail', email);
    localStorage.setItem('userName', name);
    localStorage.setItem('isInstructor', isInstructor.toString());
    localStorage.setItem('isAdmin', isAdmin.toString());
    if (token) {
      localStorage.setItem('token', token);
    }
    setStoredAuth({
      isAuthenticated: Boolean(token),
      userEmail: email,
      userName: name,
      isInstructor,
      isAdmin,
    });
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        userEmail,
        userName,
        isInstructor,
        isAdmin,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
