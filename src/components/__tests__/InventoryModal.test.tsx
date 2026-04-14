import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import InventoryModal from '../InventoryModal';
import { addInventoryItem, updateInventoryItem } from '../../services/firestoreService';

// Mock services
vi.mock('../../services/firestoreService', () => ({
  addInventoryItem: vi.fn(),
  updateInventoryItem: vi.fn(),
  deleteInventoryItem: vi.fn(),
}));

// Mock motion
vi.mock('motion/react', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('InventoryModal', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders "Add New Resource" when no item is provided', () => {
    render(<InventoryModal isOpen={true} onClose={mockOnClose} />);
    expect(screen.getByText(/Add New Resource/i)).toBeInTheDocument();
  });

  it('renders "Edit Inventory Item" when an item is provided', () => {
    const item = { id: '1', sku: 'B001', title: 'Test Bible', stockLevel: 10 };
    render(<InventoryModal isOpen={true} onClose={mockOnClose} item={item} />);
    expect(screen.getByText(/Edit Inventory Item/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('B001')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test Bible')).toBeInTheDocument();
  });

  it('submits correctly for a new item', async () => {
    render(<InventoryModal isOpen={true} onClose={mockOnClose} />);

    fireEvent.change(screen.getByPlaceholderText(/e.g. B-EN-001/i), { target: { value: 'NEW-SKU' } });
    fireEvent.change(screen.getByPlaceholderText(/e.g. The Great Controversy/i), { target: { value: 'New Title' } });
    
    // Find Stock Level by its numeric value or by searching for the input after the label
    const stockInput = screen.getByDisplayValue('0');
    fireEvent.change(stockInput, { target: { value: '50' } });

    fireEvent.click(screen.getByText(/Add to Ledger/i));

    await waitFor(() => {
      expect(addInventoryItem).toHaveBeenCalledWith(expect.objectContaining({
        sku: 'NEW-SKU',
        title: 'New Title',
        stockLevel: 50
      }));
    });

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('submits correctly for editing an existing item', async () => {
    const item = { id: '1', sku: 'B001', title: 'Test Bible', stockLevel: 10 };
    render(<InventoryModal isOpen={true} onClose={mockOnClose} item={item} />);

    const stockInput = screen.getByDisplayValue('10');
    fireEvent.change(stockInput, { target: { value: '100' } });
    fireEvent.click(screen.getByText(/Update Ledger/i));

    await waitFor(() => {
      expect(updateInventoryItem).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({ stockLevel: 100 }),
        expect.anything()
      );
    });

    expect(mockOnClose).toHaveBeenCalled();
  });
});
