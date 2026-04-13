import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, onAuthStateChanged, User, signInWithPopup, googleProvider } from '../firebase';
import { 
  subscribeToInventory, 
  subscribeToEvents, 
  subscribeToSettings, 
  subscribeToUsers,
  subscribeToUserProfile,
  subscribeToAuthorizedEmails,
  syncUserProfile 
} from '../services/firestoreService';

interface FirebaseContextType {
  user: User | null;
  currentUserProfile: any | null;
  loading: boolean;
  isAuthReady: boolean;
  inventory: any[];
  events: any[];
  users: any[];
  authorizedEmails: string[];
  settings: any;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  updateUserRole: (userId: string, role: 'admin' | 'user' | 'guest') => Promise<void>;
  isAuthorized: boolean;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [inventory, setInventory] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [authorizedEmails, setAuthorizedEmails] = useState<string[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [currentUserProfile, setCurrentUserProfile] = useState<any | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          await syncUserProfile(user);
          setIsAuthorized(true);
        } catch (error: any) {
          if (error.message === "NOT_AUTHORIZED") {
            setIsAuthorized(false);
          }
        }
      }
      setUser(user);
      setLoading(false);
      setIsAuthReady(true);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (isAuthReady && user) {
      // 1. Always subscribe to the user's own profile to get their role
      const unsubProfile = subscribeToUserProfile(user.uid, (profile) => {
        setCurrentUserProfile(profile);
      });

      let unsubInventory = () => {};
      let unsubEvents = () => {};
      let unsubSettings = () => {};
      let unsubUsers = () => {};
      let unsubAuthEmails = () => {};

      // 2. Only subscribe to data if the user is approved (admin or user)
      if (currentUserProfile && (currentUserProfile.role === 'admin' || currentUserProfile.role === 'user')) {
        unsubInventory = subscribeToInventory(setInventory);
        unsubEvents = subscribeToEvents(setEvents);
        unsubSettings = subscribeToSettings(setSettings);
      } else {
        setInventory([]);
        setEvents([]);
        setSettings({});
      }

      // 3. Only subscribe to full user list if admin
      if (currentUserProfile?.role === 'admin') {
        unsubUsers = subscribeToUsers(setUsers);
        unsubAuthEmails = subscribeToAuthorizedEmails(setAuthorizedEmails);
      } else {
        setUsers([]);
        setAuthorizedEmails([]);
      }

      return () => {
        unsubProfile();
        unsubInventory();
        unsubEvents();
        unsubSettings();
        unsubUsers();
        unsubAuthEmails();
      };
    } else {
      setInventory([]);
      setEvents([]);
      setUsers([]);
      setAuthorizedEmails([]);
      setSettings({});
      setCurrentUserProfile(null);
      setIsAuthorized(true);
    }
  }, [isAuthReady, user, currentUserProfile?.role]);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
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
      inventory, 
      events, 
      users,
      authorizedEmails,
      settings,
      login,
      logout,
      updateUserRole: updateUserRoleHandler,
      isAuthorized
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
