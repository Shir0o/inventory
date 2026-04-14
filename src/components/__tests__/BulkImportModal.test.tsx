import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import BulkImportModal from '../BulkImportModal';
import { parseInventoryData } from '../../services/aiService';
import { addInventoryItem } from '../../services/firestoreService';

// Mock dependencies
vi.mock('../../services/aiService', () => ({
  parseInventoryData: vi.fn(),
}));

vi.mock('../../services/firestoreService', () => ({
  addInventoryItem: vi.fn(),
}));

// Mock motion (framer-motion/motion.react) to avoid animation issues in tests
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('BulkImportModal', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when isOpen is false', () => {
    render(<BulkImportModal isOpen={false} onClose={mockOnClose} />);
    expect(screen.queryByText(/Bulk Inventory Import/i)).not.toBeInTheDocument();
  });

  it('renders the upload step initially', () => {
    render(<BulkImportModal isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText(/Bulk Inventory Import/i)).toBeInTheDocument();
    expect(screen.getByText(/Upload your data/i)).toBeInTheDocument();
  });

  it('handles file upload and transitions to review step', async () => {
    const mockParsedItems = [
      { sku: 'SKU1', title: 'Test Item', category: 'Bibles', stockLevel: 10, status: 'Healthy' }
    ];
    (parseInventoryData as any).mockResolvedValueOnce(mockParsedItems);

    render(<BulkImportModal isOpen={true} onClose={mockOnClose} />);

    const file = new File(['sku,title\nSKU1,Test Item'], 'test.csv', { type: 'text/csv' });
    
    // The input is hidden, so we select it directly or by container
    const hiddenInput = document.querySelector('input[type="file"]')!;
    fireEvent.change(hiddenInput, { target: { files: [file] } });

    // Should show parsing state (though it might be too fast, so we check for the final state)
    await waitFor(() => {
      expect(screen.getByText(/Review Proposed Changes/i)).toBeInTheDocument();
    });

    expect(screen.getByText('SKU1')).toBeInTheDocument();
    expect(screen.getByText('Test Item')).toBeInTheDocument();
  });

  it('performs import and shows success state', async () => {
    const mockParsedItems = [
      { sku: 'SKU1', title: 'Test Item', category: 'Bibles', stockLevel: 10, status: 'Healthy' }
    ];
    (parseInventoryData as any).mockResolvedValueOnce(mockParsedItems);
    (addInventoryItem as any).mockResolvedValueOnce({ id: 'new-id' });

    render(<BulkImportModal isOpen={true} onClose={mockOnClose} />);

    // Fast-forward to review step
    const hiddenInput = document.querySelector('input[type="file"]')!;
    fireEvent.change(hiddenInput, { target: { files: [new File([''], 'test.csv')] } });

    await waitFor(() => {
      expect(screen.getByText(/Confirm & Import All/i)).toBeInTheDocument();
    });

    // Click Import
    fireEvent.click(screen.getByText(/Confirm & Import All/i));

    await waitFor(() => {
      expect(screen.getByText(/Import Complete!/i)).toBeInTheDocument();
    });

    expect(addInventoryItem).toHaveBeenCalledWith(mockParsedItems[0]);
  });

  it('shows error if parsing fails', async () => {
    (parseInventoryData as any).mockRejectedValueOnce(new Error('Failed to parse data with AI. Please check your format.'));

    render(<BulkImportModal isOpen={true} onClose={mockOnClose} />);

    const hiddenInput = document.querySelector('input[type="file"]')!;
    fireEvent.change(hiddenInput, { target: { files: [new File([''], 'test.csv')] } });

    await waitFor(() => {
      expect(screen.getByText(/Failed to parse data with AI/i)).toBeInTheDocument();
    });
  });
});
