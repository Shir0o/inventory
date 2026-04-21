
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import App from '../App';
import { FirebaseProvider } from './FirebaseContext';
import { onAuthStateChanged, auth } from '../firebase';
import { syncUserProfile, subscribeToUserProfile } from '../services/firestoreService';

// Re-mocking for specific control
vi.mock('../firebase', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../firebase')>();
  return {
    ...actual,
    onAuthStateChanged: vi.fn(),
    auth: {
      ...actual.auth,
      signOut: vi.fn(),
      currentUser: null,
    },
  };
});

vi.mock('../services/firestoreService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/firestoreService')>();
  return {
    ...actual,
    syncUserProfile: vi.fn(),
    subscribeToUserProfile: vi.fn(),
    subscribeToInventory: vi.fn(() => () => {}),
    subscribeToEvents: vi.fn(() => () => {}),
    subscribeToSettings: vi.fn(() => () => {}),
    subscribeToNotifications: vi.fn(() => () => {}),
    subscribeToAuditLogs: vi.fn(() => () => {}),
    subscribeToUsers: vi.fn(() => () => {}),
    subscribeToAuthorizedEmails: vi.fn(() => () => {}),
  };
});

describe('Authentication Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (auth as any).currentUser = null;
  });

  it('shows login page when not authenticated', () => {
    (onAuthStateChanged as any).mockImplementation((auth, callback) => {
      callback(null);
      return () => {};
    });

    render(
      <FirebaseProvider>
        <App />
      </FirebaseProvider>
    );

    expect(screen.getByText(/AUTHENTICATE WITH GOOGLE/i)).toBeInTheDocument();
  });

  it('blocks unauthorized users and signs them out', async () => {
    const mockUser = { uid: 'unauthorized-id', email: 'random@gmail.com' };
    
    // Initial state: authenticated but not checked yet
    (onAuthStateChanged as any).mockImplementationOnce((auth, callback) => {
      callback(mockUser);
      return () => {};
    });

    (syncUserProfile as any).mockRejectedValue(new Error('NOT_AUTHORIZED'));
    
    // Mock signOut to trigger a second onAuthStateChanged call with null
    (auth.signOut as any).mockImplementationOnce(() => {
      (onAuthStateChanged as any).mockImplementationOnce((auth, callback) => {
        callback(null);
        return () => {};
      });
      (auth as any).currentUser = null;
      return Promise.resolve();
    });

    render(
      <FirebaseProvider>
        <App />
      </FirebaseProvider>
    );

    await waitFor(() => {
      expect(syncUserProfile).toHaveBeenCalledWith(mockUser);
    });

    await waitFor(() => {
      expect(auth.signOut).toHaveBeenCalled();
    });

    // Verify we are still on login page
    expect(screen.getByText(/AUTHENTICATE WITH GOOGLE/i)).toBeInTheDocument();
  });

  it('allows authorized users and shows dashboard', async () => {
    const mockUser = { uid: 'authorized-id', email: 'admin@gmail.com' };
    const mockProfile = { role: 'admin', email: 'admin@gmail.com' };

    (onAuthStateChanged as any).mockImplementation((auth, callback) => {
      callback(mockUser);
      return () => {};
    });

    (auth as any).currentUser = mockUser;
    (syncUserProfile as any).mockResolvedValue(mockProfile);
    (subscribeToUserProfile as any).mockImplementation((uid, cb) => {
      cb(mockProfile);
      return () => {};
    });

    render(
      <FirebaseProvider>
        <App />
      </FirebaseProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Invo/i)).toBeInTheDocument();
    });
    
    expect(screen.queryByText(/AUTHENTICATE WITH GOOGLE/i)).not.toBeInTheDocument();
  });

  it('hides Users tab for non-admin users', async () => {
    const mockUser = { uid: 'user-id', email: 'user@gmail.com' };
    const mockProfile = { role: 'user', email: 'user@gmail.com' };

    (onAuthStateChanged as any).mockImplementation((auth, callback) => {
      callback(mockUser);
      return () => {};
    });

    (auth as any).currentUser = mockUser;
    (syncUserProfile as any).mockResolvedValue(mockProfile);
    (subscribeToUserProfile as any).mockImplementation((uid, cb) => {
      cb(mockProfile);
      return () => {};
    });

    render(
      <FirebaseProvider>
        <App />
      </FirebaseProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Invo/i)).toBeInTheDocument();
    });
    
    expect(screen.queryByText(/Users/i)).not.toBeInTheDocument();
  });
});
