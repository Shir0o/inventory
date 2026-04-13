import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, onAuthStateChanged, User, signInWithPopup, googleProvider } from '../firebase';
import { 
  subscribeToInventory, 
  subscribeToEvents, 
  subscribeToSettings, 
  subscribeToUsers,
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
  settings: any;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  updateUserRole: (userId: string, role: 'admin' | 'user') => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [inventory, setInventory] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});
  const [currentUserProfile, setCurrentUserProfile] = useState<any | null>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        await syncUserProfile(user);
      }
      setUser(user);
      setLoading(false);
      setIsAuthReady(true);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (isAuthReady && user) {
      const unsubInventory = subscribeToInventory(setInventory);
      const unsubEvents = subscribeToEvents(setEvents);
      const unsubSettings = subscribeToSettings(setSettings);
      const unsubUsers = subscribeToUsers((allUsers) => {
        setUsers(allUsers);
        const profile = allUsers.find(u => u.id === user.uid);
        setCurrentUserProfile(profile || null);
      });

      return () => {
        unsubInventory();
        unsubEvents();
        unsubSettings();
        unsubUsers();
      };
    } else {
      setInventory([]);
      setEvents([]);
      setUsers([]);
      setSettings({});
      setCurrentUserProfile(null);
    }
  }, [isAuthReady, user]);

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

  const updateUserRoleHandler = async (userId: string, role: 'admin' | 'user') => {
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
      settings,
      login,
      logout,
      updateUserRole: updateUserRoleHandler
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
