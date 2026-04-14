import { render, screen, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FirebaseProvider, useFirebase } from '../FirebaseContext';
import { onAuthStateChanged, signInWithPopup } from '../../firebase';
import { syncUserProfile, subscribeToUserProfile } from '../../services/firestoreService';

// Mock Firebase
vi.mock('../../firebase', () => ({
  auth: { currentUser: null, signOut: vi.fn() },
  onAuthStateChanged: vi.fn(),
  signInWithPopup: vi.fn(),
  googleProvider: {},
}));

// Mock Firestore Service
vi.mock('../../services/firestoreService', () => ({
  syncUserProfile: vi.fn(),
  subscribeToUserProfile: vi.fn(() => vi.fn()), // Returns an unsubscribe function
  subscribeToInventory: vi.fn(() => vi.fn()),
  subscribeToEvents: vi.fn(() => vi.fn()),
  subscribeToSettings: vi.fn(() => vi.fn()),
  subscribeToUsers: vi.fn(() => vi.fn()),
  subscribeToAuthorizedEmails: vi.fn(() => vi.fn()),
  subscribeToAuditLogs: vi.fn(() => vi.fn()),
  subscribeToNotifications: vi.fn(() => vi.fn()),
}));

// Helper component to access the context
const TestConsumer = () => {
  const { user, loading, isAuthorized } = useFirebase();
  if (loading) return <div>Loading...</div>;
  return (
    <div>
      <div data-testid="user-id">{user?.uid || 'no-user'}</div>
      <div data-testid="is-authorized">{isAuthorized.toString()}</div>
    </div>
  );
};

describe('FirebaseContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading initially and then shows no-user state', async () => {
    let triggerAuth: any;
    (onAuthStateChanged as any).mockImplementation((auth: any, callback: any) => {
      triggerAuth = () => callback(null);
      return vi.fn();
    });

    render(
      <FirebaseProvider>
        <TestConsumer />
      </FirebaseProvider>
    );

    // Initial state should be loading
    expect(screen.getByText(/Loading.../i)).toBeInTheDocument();

    // Now trigger the auth change
    await act(async () => {
      triggerAuth();
    });

    await waitFor(() => {
      expect(screen.queryByText(/Loading.../i)).not.toBeInTheDocument();
    });

    expect(screen.getByTestId('user-id')).toHaveTextContent('no-user');
  });

  it('syncs user profile and sets user when logged in', async () => {
    const mockUser = { uid: 'user-123', email: 'test@example.com' };
    (onAuthStateChanged as any).mockImplementation((auth: any, callback: any) => {
      callback(mockUser);
      return vi.fn();
    });
    (syncUserProfile as any).mockResolvedValueOnce({});

    render(
      <FirebaseProvider>
        <TestConsumer />
      </FirebaseProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-id')).toHaveTextContent('user-123');
    });

    expect(syncUserProfile).toHaveBeenCalledWith(mockUser);
    expect(screen.getByTestId('is-authorized')).toHaveTextContent('true');
  });

  it('sets isAuthorized to false when syncUserProfile throws NOT_AUTHORIZED', async () => {
    const mockUser = { uid: 'unauthorized-user' };
    (onAuthStateChanged as any).mockImplementation((auth: any, callback: any) => {
      callback(mockUser);
      return vi.fn();
    });
    (syncUserProfile as any).mockRejectedValueOnce(new Error('NOT_AUTHORIZED'));

    render(
      <FirebaseProvider>
        <TestConsumer />
      </FirebaseProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('is-authorized')).toHaveTextContent('false');
    });
  });

  it('calls signInWithPopup when login is called', async () => {
    // Set up a mock consumer that exposes the login function
    let contextValue: any;
    const LoginConsumer = () => {
      contextValue = useFirebase();
      return null;
    };

    render(
      <FirebaseProvider>
        <LoginConsumer />
      </FirebaseProvider>
    );

    await act(async () => {
      await contextValue.login();
    });

    expect(signInWithPopup).toHaveBeenCalled();
  });
});
