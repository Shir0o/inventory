import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock Firebase
vi.mock('../firebase', () => ({
  auth: {
    currentUser: null,
    signOut: vi.fn(),
  },
  db: {},
  googleProvider: {},
  signInWithPopup: vi.fn(),
  onAuthStateChanged: vi.fn((auth, callback) => {
    // Default: no user
    callback(null);
    return () => {};
  }),
}));

// Mock Firestore Service
vi.mock('../services/firestoreService', () => ({
  subscribeToInventory: vi.fn(() => () => {}),
  subscribeToEvents: vi.fn(() => () => {}),
  subscribeToSettings: vi.fn(() => () => {}),
  subscribeToUsers: vi.fn(() => () => {}),
  subscribeToUserProfile: vi.fn((uid, callback) => {
    callback(null);
    return () => {};
  }),
  subscribeToAuthorizedEmails: vi.fn(() => () => {}),
  subscribeToAuditLogs: vi.fn(() => () => {}),
  subscribeToNotifications: vi.fn(() => () => {}),
  syncUserProfile: vi.fn(),
  updateUserRole: vi.fn(),
}));
