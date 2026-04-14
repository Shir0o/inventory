import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from '../App';
import { useFirebase } from '../context/FirebaseContext';

// Mock useFirebase
vi.mock('../context/FirebaseContext', () => ({
  useFirebase: vi.fn(),
}));

// Mock framer-motion/motion.react
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    aside: ({ children, ...props }: any) => <aside {...props}>{children}</aside>,
    header: ({ children, ...props }: any) => <header {...props}>{children}</header>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('App Integration', () => {
  const mockInventory = [
    { id: '1', sku: 'B001', title: 'Bible 1', category: 'Bibles', stockLevel: 500, status: 'Healthy' },
    { id: '2', sku: 'T001', title: 'Tract 1', category: 'Tracts', stockLevel: 50, status: 'Low' },
  ];

  const mockContext = {
    user: { uid: '123', displayName: 'Test User', email: 'test@example.com' },
    loading: false,
    inventory: mockInventory,
    events: [],
    notifications: [],
    logout: vi.fn(),
    isAuthorized: true,
    currentUserProfile: { role: 'admin' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useFirebase as any).mockReturnValue(mockContext);
  });

  it('renders the dashboard with correct counts', () => {
    render(<App />);
    
    // Check total catalog items count in the ledger card
    // We look for the text "Total Catalog Items" then its sibling or parent container
    expect(screen.getByText(/Total Catalog Items/i)).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument(); // 2 items in mockInventory
    
    // Check critical stock alerts
    expect(screen.getByText(/Critical Stock Alerts/i)).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument(); // 1 item has status 'Low'
  });

  it('switches to inventory tab and filters data', async () => {
    render(<App />);
    
    // Find and click Inventory tab in Sidebar
    const inventoryTab = screen.getByRole('button', { name: /inventory/i });
    fireEvent.click(inventoryTab);
    
    // Should see "Inventory Matrix" heading
    expect(screen.getByText(/Inventory Matrix/i)).toBeInTheDocument();
    
    // Test local search in InventoryView
    const searchInput = screen.getByPlaceholderText(/SEARCH SYSTEM.../i);
    fireEvent.change(searchInput, { target: { value: 'Tract' } });
    
    expect(screen.getByText('Tract 1')).toBeInTheDocument();
    // In the actual App, Bible 1 might be filtered out
  });

  it('opens Bulk Import modal when button is clicked', async () => {
    render(<App />);
    
    // Switch to Inventory tab
    fireEvent.click(screen.getByRole('button', { name: /inventory/i }));
    
    // Click Bulk Import button
    const importBtn = screen.getByRole('button', { name: /bulk import/i });
    fireEvent.click(importBtn);
    
    // Modal should appear
    expect(screen.getByText(/Bulk Inventory Import/i)).toBeInTheDocument();
  });

  it('shows unauthorized state if not authorized', () => {
    (useFirebase as any).mockReturnValue({
      ...mockContext,
      isAuthorized: false,
    });
    
    render(<App />);
    // The actual text in the DOM was "Access Denied"
    expect(screen.getByText(/Access Denied/i)).toBeInTheDocument();
  });

  it('hides admin tabs for non-admin users', () => {
    (useFirebase as any).mockReturnValue({
      ...mockContext,
      currentUserProfile: { role: 'user' },
    });

    render(<App />);

    // Should see standard tabs
    expect(screen.getByRole('button', { name: /inventory/i })).toBeInTheDocument();
    
    // Should NOT see admin-only tabs
    expect(screen.queryByRole('button', { name: /users/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /logs/i })).not.toBeInTheDocument();
  });
});
