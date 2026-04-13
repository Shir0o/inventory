import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, onAuthStateChanged, User, signInWithPopup, googleProvider } from '../firebase';
import { subscribeToInventory, subscribeToEvents, subscribeToSettings } from '../services/firestoreService';

interface FirebaseContextType {
  user: User | null;
  loading: boolean;
  isAuthReady: boolean;
  inventory: any[];
  events: any[];
  settings: any;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextType | undefined>(undefined);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [inventory, setInventory] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>({});

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
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

      return () => {
        unsubInventory();
        unsubEvents();
        unsubSettings();
      };
    } else {
      setInventory([]);
      setEvents([]);
      setSettings({});
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

  return (
    <FirebaseContext.Provider value={{ 
      user, 
      loading, 
      isAuthReady, 
      inventory, 
      events, 
      settings,
      login,
      logout
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
