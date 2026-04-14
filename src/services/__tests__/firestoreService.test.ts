import { describe, it, expect, vi, beforeEach } from 'vitest';
import { addInventoryItem, updateInventoryItem, checkoutItems } from '../firestoreService';
import { addDoc, updateDoc, runTransaction } from 'firebase/firestore';

// Mock Firebase
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(() => ({ type: 'collection' })),
  doc: vi.fn(() => ({ type: 'doc' })),
  addDoc: vi.fn(),
  updateDoc: vi.fn(),
  deleteDoc: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  onSnapshot: vi.fn(),
  Timestamp: { fromDate: vi.fn() },
  runTransaction: vi.fn(),
}));

// Mock firebase init file
vi.mock('../../firebase', () => ({
  db: {},
  auth: {
    currentUser: {
      uid: 'user-123',
      displayName: 'Test User',
      email: 'test@example.com',
      providerData: [],
    }
  }
}));

describe('firestoreService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('addInventoryItem', () => {
    it('successfully adds an item and logs the audit', async () => {
      const mockItem = { sku: 'SKU1', title: 'Test Item', stockLevel: 10 };
      const mockDocRef = { id: 'new-id' };
      
      (addDoc as any).mockResolvedValueOnce(mockDocRef); // For addDoc(collection(db, 'inventory'), ...)
      (addDoc as any).mockResolvedValueOnce({}); // For createAuditLog's addDoc(collection(db, 'audit_logs'), ...)

      const result = await addInventoryItem(mockItem);

      expect(result).toEqual(mockDocRef);
      expect(addDoc).toHaveBeenCalledTimes(2); // Item + Audit log
      
      // Verify first call (item)
      expect(addDoc).toHaveBeenNthCalledWith(1, expect.anything(), expect.objectContaining({
        sku: 'SKU1',
        title: 'Test Item',
        updatedAt: expect.any(String)
      }));
    });
  });

  describe('updateInventoryItem', () => {
    it('updates item and checks thresholds to create notifications', async () => {
      const mockId = 'item-123';
      const mockItem = { sku: 'SKU1', title: 'Test Item', stockLevel: 5 };
      const thresholds = { warning: 10, critical: 2 };

      (updateDoc as any).mockResolvedValueOnce({}); // For updateDoc(docRef, ...)
      (addDoc as any).mockResolvedValueOnce({}); // For createNotification's addDoc(...)
      (addDoc as any).mockResolvedValueOnce({}); // For createAuditLog's addDoc(...)

      await updateInventoryItem(mockId, mockItem, thresholds);

      expect(updateDoc).toHaveBeenCalledTimes(1);
      // Since stockLevel 5 is <= warning 10, it should create a notification
      expect(addDoc).toHaveBeenCalledTimes(2); // 1 Notification + 1 Audit Log
    });

    it('creates critical notification when stock is below critical threshold', async () => {
        const mockId = 'item-123';
        const mockItem = { sku: 'SKU1', title: 'Test Item', stockLevel: 1 };
        const thresholds = { warning: 10, critical: 2 };
  
        (updateDoc as any).mockResolvedValueOnce({});
        (addDoc as any).mockResolvedValueOnce({}); // Notification
        (addDoc as any).mockResolvedValueOnce({}); // Audit Log
  
        await updateInventoryItem(mockId, mockItem, thresholds);
  
      // Verify notification call
      expect(addDoc).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        type: 'CRITICAL_STOCK',
        title: 'Critical Stock Level'
      }));
    });
  });

  describe('checkoutItems', () => {
    it('successfully checks out items in a transaction', async () => {
      const eventId = 'event-123';
      const items = [{ itemId: 'item-1', quantity: 5, title: 'Item 1', sku: 'S1' }];
      
      const mockTransaction = {
        get: vi.fn((ref) => {
          if (ref.type === 'doc') {
             // Return mock data for event and item
             return { 
               exists: () => true, 
               data: () => ({ stockLevel: 10, materialsAssigned: 0 }) 
             };
          }
          return { exists: () => false };
        }),
        update: vi.fn(),
        set: vi.fn(),
      };

      (runTransaction as any).mockImplementationOnce(async (db: any, cb: any) => {
        return await cb(mockTransaction);
      });

      await checkoutItems(eventId, items);

      expect(runTransaction).toHaveBeenCalled();
      expect(mockTransaction.update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
        stockLevel: 5
      }));
      expect(addDoc).toHaveBeenCalled(); // Audit log
    });

    it('throws error if stock is insufficient', async () => {
      const eventId = 'event-123';
      const items = [{ itemId: 'item-1', quantity: 15, title: 'Item 1', sku: 'S1' }];
      
      const mockTransaction = {
        get: vi.fn(() => ({ 
          exists: () => true, 
          data: () => ({ stockLevel: 10 }) 
        })),
        update: vi.fn(),
        set: vi.fn(),
      };

      (runTransaction as any).mockImplementationOnce(async (db: any, cb: any) => {
        return await cb(mockTransaction);
      });

      await expect(checkoutItems(eventId, items)).rejects.toThrow('Insufficient stock');
    });
  });
});
