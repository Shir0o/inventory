import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, onAuthStateChanged, User, signInWithPopup, googleProvider } from '../firebase';
import { 
  subscribeToInventory, 
  subscribeToEvents, 
  subscribeToSettings, 
  subscribeToUsers,
  subscribeToUserProfile,
  subscribeToAuthorizedEmails,
  subscribeToAuditLogs,
  subscribeToNotifications,
  subscribeToOrders,
  syncUserProfile 
} from '../services/firestoreService';

interface FirebaseContextType {
  user: User | null;
  currentUserProfile: any | null;
  loading: boolean;
  isAuthReady: boolean;
  isLoggingIn: boolean;
  loginStage: 'idle' | 'opening' | 'authenticating' | 'syncing' | 'success' | 'error';
  loginStatusMessage: string;
  loginError: string | null;
  dismissLoginError: () => void;
  inventory: any[];
  events: any[];
  orders: any[];
  users: any[];
  authorizedEmails: string[];
  auditLogs: any[];
  notifications: any[];
  settings: any;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  updateUserRole: (userId: string, role: 'admin' | 'user' | 'guest') => Promise<void>;
  isAuthorized: boolean;
  isAdmin: boolean;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginStage, setLoginStage] = useState<'idle' | 'opening' | 'authenticating' | 'syncing' | 'success' | 'error'>('idle');
  const [loginStatusMessage, setLoginStatusMessage] = useState<string>('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [inventory, setInventory] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [authorizedEmails, setAuthorizedEmails] = useState<string[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [currentUserProfile, setCurrentUserProfile] = useState<any | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(true);

  const dismissLoginError = () => {
    setLoginError(null);
    setLoginStage('idle');
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setLoginStage('syncing');
        setLoginStatusMessage('Syncing inventory roles & records...');
        try {
          await syncUserProfile(user);
          setIsAuthorized(true);
        } catch (error: any) {
          if (error.message === "NOT_AUTHORIZED") {
            setIsAuthorized(false);
          } else {
            console.warn("User profile sync deferred (offline or reconnecting):", error?.message || error);
            setIsAuthorized(true);
          }
        }
        setLoginStage('success');
        setLoginStatusMessage(`Connected as ${user.displayName || user.email}!`);
        // Smoothly dismiss login transition mask
        setTimeout(() => {
          setIsLoggingIn(false);
          setLoginStage('idle');
          setLoginStatusMessage('');
        }, 900);
      } else {
        setIsLoggingIn(false);
        setLoginStage('idle');
        setLoginStatusMessage('');
      }
      setUser(user);
      setLoading(false);
      setIsAuthReady(true);
    });

    return () => unsubscribeAuth();
  }, []);

  const isPrimaryAdmin = user?.email?.toLowerCase() === 'yilongwang05@gmail.com';
  const role = currentUserProfile?.role || (isPrimaryAdmin ? 'admin' : undefined);
  const isAllowed = isPrimaryAdmin || role === 'admin' || role === 'user';
  const isAdmin = isPrimaryAdmin || role === 'admin';

  useEffect(() => {
    if (isAuthReady && user) {
      // 1. Always subscribe to the user's own profile to get their role
      const unsubProfile = subscribeToUserProfile(user.uid, (profile) => {
        setCurrentUserProfile(profile);
      });

      let unsubInventory = () => {};
      let unsubEvents = () => {};
      let unsubOrders = () => {};
      let unsubSettings = () => {};
      let unsubUsers = () => {};
      let unsubAuthEmails = () => {};
      let unsubAuditLogs = () => {};
      let unsubNotifications = () => {};

      // 2. Subscribe to data if authorized
      if (isAllowed) {
        unsubInventory = subscribeToInventory(setInventory);
        unsubEvents = subscribeToEvents(setEvents);
        unsubOrders = subscribeToOrders(setOrders);
        unsubSettings = subscribeToSettings(setSettings);
        unsubNotifications = subscribeToNotifications(setNotifications);
      } else {
        setInventory([]);
        setEvents([]);
        setOrders([]);
        setSettings({});
        setNotifications([]);
      }

      // 3. Only subscribe to full user list & logs if admin
      if (isAdmin) {
        unsubUsers = subscribeToUsers(setUsers);
        unsubAuthEmails = subscribeToAuthorizedEmails(setAuthorizedEmails);
        unsubAuditLogs = subscribeToAuditLogs(setAuditLogs);
      } else {
        setUsers([]);
        setAuthorizedEmails([]);
        setAuditLogs([]);
      }

      return () => {
        unsubProfile();
        unsubInventory();
        unsubEvents();
        unsubOrders();
        unsubSettings();
        unsubUsers();
        unsubAuthEmails();
        unsubAuditLogs();
        unsubNotifications();
      };
    } else {
      setInventory([]);
      setEvents([]);
      setOrders([]);
      setUsers([]);
      setAuthorizedEmails([]);
      setAuditLogs([]);
      setNotifications([]);
      setSettings({});
      setCurrentUserProfile(null);
      setIsAuthorized(true);
    }
  }, [isAuthReady, user?.uid, isAllowed, isAdmin]);

  const login = async () => {
    setIsLoggingIn(true);
    setLoginError(null);
    setLoginStage('opening');
    setLoginStatusMessage('Opening Google secure sign-in window...');

    // Dynamic reassurance timers to mask popup & network delay
    const t1 = setTimeout(() => {
      setLoginStage('authenticating');
      setLoginStatusMessage('Connecting with Google authentication...');
    }, 1200);

    const t2 = setTimeout(() => {
      setLoginStatusMessage('Awaiting authorization in Google pop-up window...');
    }, 2800);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      clearTimeout(t1);
      clearTimeout(t2);
      setLoginStage('syncing');
      setLoginStatusMessage(`Signed in as ${result.user.displayName || result.user.email || 'user'}. Synchronizing inventory permissions...`);
    } catch (error: any) {
      clearTimeout(t1);
      clearTimeout(t2);
      if (error?.code === 'auth/popup-closed-by-user' || error?.message?.includes('closed-by-user')) {
        console.info('Google sign-in popup was closed by user.');
        setLoginStage('idle');
        setLoginStatusMessage('');
        setIsLoggingIn(false);
      } else if (error?.code === 'auth/popup-blocked') {
        setLoginStage('error');
        setLoginError('The Google sign-in pop-up was blocked by your browser. Please allow popups for this site and try again.');
        setIsLoggingIn(false);
      } else if (error?.code === 'auth/cancelled-popup-request') {
        setLoginStage('idle');
        setIsLoggingIn(false);
      } else {
        console.error('Login failed:', error);
        setLoginStage('error');
        setLoginError(error?.message || 'Login was not completed. Please try again.');
        setIsLoggingIn(false);
      }
    }
  };

  const logout = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const updateUserRoleHandler = async (userId: string, role: 'admin' | 'user' | 'guest') => {
    try {
      const { updateUserRole: updateRole } = await import('../services/firestoreService');
      await updateRole(userId, role);
    } catch (error) {
      console.error("Failed to update role", error);
    }
  };

  return (
    <FirebaseContext.Provider value={{ 
      user, 
      currentUserProfile,
      loading, 
      isAuthReady, 
      isLoggingIn,
      loginStage,
      loginStatusMessage,
      loginError,
      dismissLoginError,
      inventory, 
      events, 
      orders,
      users,
      authorizedEmails,
      auditLogs,
      notifications,
      settings,
      login,
      logout,
      updateUserRole: updateUserRoleHandler,
      isAuthorized,
      isAdmin
    }}>
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (context === undefined) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};
