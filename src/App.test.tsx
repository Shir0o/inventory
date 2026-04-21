
import { render, screen } from '@testing-library/react';
import App from './App';
import { FirebaseProvider } from './context/FirebaseContext';
import { vi, describe, it, expect } from 'vitest';
import React from 'react';

// Mock Firebase and other dependencies
vi.mock('./firebase', () => ({
  onAuthStateChanged: vi.fn((_auth, cb) => {
    cb({ uid: '123', displayName: 'Admin' });
    return () => {};
  }),
  auth: {
    currentUser: { uid: '123' },
  },
  db: {},
}));

vi.mock('./services/firestoreService', () => ({
  subscribeToInventory: vi.fn(() => () => {}),
  subscribeToEvents: vi.fn(() => () => {}),
  subscribeToNotifications: vi.fn(() => () => {}),
  subscribeToSettings: vi.fn(() => () => {}),
  subscribeToUserProfile: vi.fn(() => () => {}),
}));

describe('App Navigation', () => {
  it('renders navigation links', () => {
    render(
      <FirebaseProvider>
        <App />
      </FirebaseProvider>
    );
    expect(screen.getByText(/BIBLES/i)).toBeDefined();
    expect(screen.getByText(/TRACTS/i)).toBeDefined();
    expect(screen.getByText(/BOOKLETS/i)).toBeDefined();
  });
});
