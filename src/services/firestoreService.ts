import { 
  collection, 
  doc, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy,
  Timestamp,
  FirestoreError,
  runTransaction,
  limit,
  getDoc,
  setDoc,
  where,
  getDocs,
  serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Helper to sanitize undefined values for Firestore ---
function cleanUndefined(obj: any): any {
  if (obj === null || obj === undefined) {
    return null;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefined(item));
  }
  if (typeof obj === 'object') {
    if (obj.constructor && (obj.constructor.name === 'FieldValue' || obj.constructor.name === 'Timestamp')) {
      return obj;
    }
    if (obj instanceof Date) {
      return obj;
    }
    const result: any = {};
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (val !== undefined) {
        result[key] = cleanUndefined(val);
      }
    }
    return result;
  }
  return obj;
}

// --- Audit Logs ---

export type AuditAction = 
  | 'STOCK_UPDATE' 
  | 'STOCK_ADJUSTED'
  | 'STARTING_STOCK'
  | 'COUNT_POSTED'
  | 'CORRECTION_FILED'
  | 'DELIVERY_RECEIVED'
  | 'ORDER_CREATED'
  | 'ORDER_UPDATED'
  | 'ORDER_DELETED'
  | 'ITEM_CREATED' 
  | 'ITEM_DELETED' 
  | 'EVENT_CREATED' 
  | 'EVENT_UPDATED' 
  | 'EVENT_DELETED' 
  | 'DISTRIBUTION' 
  | 'ROLE_UPDATE' 
  | 'SETTINGS_UPDATE' 
  | 'EMAIL_AUTHORIZED' 
  | 'EMAIL_DEAUTHORIZED'
  | 'NOTIFICATION_CREATED'
  | (string & {});

export async function createAuditLog(action: AuditAction, targetId: string, targetType: string, details: string, metadata?: any) {
  const path = 'audit_logs';
  try {
    const logData: any = {
      action,
      targetId,
      targetType,
      details,
      userId: auth.currentUser?.uid || null,
      userName: auth.currentUser?.displayName || 'Unknown User',
      userEmail: auth.currentUser?.email || null,
      timestamp: serverTimestamp()
    };

    if (metadata !== undefined) {
      logData.metadata = cleanUndefined(metadata);
    }

    return await addDoc(collection(db, path), logData);
  } catch (error) {
    console.error("Failed to create audit log", error);
    // We don't throw here to avoid blocking the main operation if logging fails
  }
}

export function subscribeToAuditLogs(callback: (logs: any[]) => void, limitCount: number = 50) {
  const path = 'audit_logs';
  const q = query(collection(db, path), orderBy('timestamp', 'desc'), limit(limitCount));
  
  return onSnapshot(q, (snapshot) => {
    const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(logs);
  }, (error: FirestoreError) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
}

export function subscribeToItemHistory(itemId: string, callback: (logs: any[]) => void) {
  const path = 'audit_logs';
  const q = query(collection(db, path), orderBy('timestamp', 'desc'), limit(100));
  
  return onSnapshot(q, (snapshot) => {
    const logs = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter((log: any) => {
        const isTarget = log.targetId === itemId;
        const inDistribution = log.action === 'DISTRIBUTION' && 
                             log.metadata?.itemIds && 
                             Array.isArray(log.metadata.itemIds) && 
                             log.metadata.itemIds.includes(itemId);
        return isTarget || inDistribution;
      });
    callback(logs);
  }, (error: FirestoreError) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
}

// --- Notifications ---

export type NotificationType = 'LOW_STOCK' | 'CRITICAL_STOCK' | 'SYSTEM' | 'EVENT';

export async function createNotification(type: NotificationType, title: string, message: string, metadata?: any) {
  const path = 'notifications';
  try {
    return await addDoc(collection(db, path), {
      type,
      title,
      message,
      metadata: metadata !== undefined ? cleanUndefined(metadata) : null,
      read: false,
      createdAt: serverTimestamp(),
      userId: auth.currentUser?.uid || null
    });
  } catch (error) {
    console.error("Failed to create notification", error);
  }
}

export function subscribeToNotifications(callback: (notifications: any[]) => void, limitCount: number = 20) {
  const path = 'notifications';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(limitCount));
  
  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(notifications);
  }, (error: FirestoreError) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
}

export async function markNotificationAsRead(id: string) {
  const path = `notifications/${id}`;
  try {
    return await updateDoc(doc(db, 'notifications', id), {
      read: true,
      readAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// --- Inventory ---

export async function getInventoryItemBySku(sku: string) {
  const path = 'inventory';
  const q = query(collection(db, path), where('sku', '==', sku), limit(1));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

/**
 * Programmatically generates the next available SKU for a new inventory item
 * without requiring the user to come up with one manually.
 */
export async function generateProgrammaticSku(category: string = 'Tract', language: string = 'EN'): Promise<string> {
  const normCat = (category || 'Tract').toLowerCase();
  const prefix = normCat.includes('bible') ? 'BIB' : normCat.includes('booklet') ? 'BKL' : 'TR';
  const langCode = (language || 'EN').toUpperCase().slice(0, 2);
  const itemNum = langCode === 'ES' ? '002' : '001';

  const snapshot = await getDocs(collection(db, 'inventory'));
  const regex = new RegExp(`^${prefix}-(\\d+)`, 'i');
  let maxNum = 0;

  snapshot.forEach(doc => {
    const data = doc.data();
    const s = data.sku || '';
    const match = s.match(regex);
    if (match && match[1]) {
      const n = parseInt(match[1], 10);
      if (!isNaN(n) && n > maxNum) {
        maxNum = n;
      }
    }
  });

  let nextNum = maxNum + 1;
  let candidate = `${prefix}-${String(nextNum).padStart(3, '0')}-${itemNum}-${langCode}`;
  
  // Double-check uniqueness in case of race
  while (await getInventoryItemBySku(candidate)) {
    nextNum++;
    candidate = `${prefix}-${String(nextNum).padStart(3, '0')}-${itemNum}-${langCode}`;
  }

  return candidate;
}

export async function addInventoryItem(item: any, thresholds?: { warning: number, critical: number }) {
  const path = 'inventory';
  try {
    // If SKU is not provided or empty, dynamically generate it programmatically
    if (!item.sku || !item.sku.trim()) {
      item.sku = await generateProgrammaticSku(item.category || 'Tract', item.language || 'EN');
    }

    // Check for SKU uniqueness
    const existing = await getInventoryItemBySku(item.sku);
    if (existing) {
      throw new Error(`SKU "${item.sku}" already exists in the inventory.`);
    }

    // Determine system status
    let status = 'Healthy';
    if (thresholds) {
      if (item.stockLevel <= thresholds.critical) status = 'Out';
      else if (item.stockLevel <= thresholds.warning) status = 'Low';
    } else {
      // Fallback defaults if no thresholds provided
      if (item.stockLevel <= 75) status = 'Out';
      else if (item.stockLevel <= 250) status = 'Low';
    }

    const docRef = await addDoc(collection(db, path), {
      ...item,
      status,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    await createAuditLog('ITEM_CREATED', docRef.id, 'inventory', `Created item: ${item.title} (${item.sku})`);
    return docRef;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateInventoryItem(
  id: string, 
  item: any, 
  thresholds?: { warning: number, critical: number },
  note?: string,
  occurredAt?: string
) {
  const path = `inventory/${id}`;
  try {
    // Determine system status
    let status = 'Healthy';
    const warningLimit = thresholds?.warning || 250;
    const criticalLimit = thresholds?.critical || 75;
    
    if (item.stockLevel <= criticalLimit) status = 'Out';
    else if (item.stockLevel <= warningLimit) status = 'Low';

    const itemRef = doc(db, 'inventory', id);
    const itemSnap = await getDoc(itemRef);
    const currentStock = itemSnap.exists() ? itemSnap.data().stockLevel : 0;
    const existingData = itemSnap.exists() ? itemSnap.data() : {};

    // Determine if this is a stock-only update (Stock Adjust) or full edit
    const hasOtherChanges = 
      (item.title !== undefined && item.title !== existingData.title) ||
      (item.subtitle !== undefined && item.subtitle !== existingData.subtitle) ||
      (item.category !== undefined && item.category !== existingData.category) ||
      (item.language !== undefined && item.language !== existingData.language) ||
      (item.unitPrice !== undefined && Number(item.unitPrice) !== existingData.unitPrice);

    let updatePayload: any;

    if (!hasOtherChanges) {
      // Stock Adjust - MUST NOT include fields like title/category to keep diff clean for safety
      updatePayload = {
        stockLevel: Number(item.stockLevel),
        status,
        updatedAt: serverTimestamp()
      };
    } else {
      // Full Edit - Include allowed fields, but NEVER include unallowed ones (like id, sku, createdAt)
      updatePayload = {
        title: item.title || existingData.title || '',
        category: item.category || existingData.category || 'Bibles',
        stockLevel: Number(item.stockLevel),
        status,
        updatedAt: serverTimestamp()
      };

      if (item.subtitle !== undefined) updatePayload.subtitle = item.subtitle;
      else if (existingData.subtitle !== undefined) updatePayload.subtitle = existingData.subtitle;

      if (item.language !== undefined) updatePayload.language = item.language;
      else if (existingData.language !== undefined) updatePayload.language = existingData.language;

      if (item.unitPrice !== undefined) updatePayload.unitPrice = Number(item.unitPrice);
      else if (existingData.unitPrice !== undefined) updatePayload.unitPrice = existingData.unitPrice;
    }

    await updateDoc(itemRef, updatePayload);
    
    // Check thresholds if provided for notifications
    if (item.stockLevel <= criticalLimit) {
      await createNotification('CRITICAL_STOCK', 'Critical Stock Level', `${item.title} is at critical level (${item.stockLevel} units).`, { itemId: id, sku: item.sku });
    } else if (item.stockLevel <= warningLimit) {
      await createNotification('LOW_STOCK', 'Low Stock Warning', `${item.title} is running low (${item.stockLevel} units).`, { itemId: id, sku: item.sku });
    }

    const delta = Number(item.stockLevel) - currentStock;
    const logDetails = note?.trim() 
      ? `Updated ${item.title} • Note: ${note.trim()}`
      : (delta !== 0 
          ? `Stock adjusted for ${item.title}: ${currentStock} -> ${item.stockLevel} (${delta > 0 ? '+' : ''}${delta})`
          : `Updated item: ${item.title}`);

    await createAuditLog('STOCK_UPDATE', id, 'inventory', logDetails, { 
      item,
      previousStock: currentStock,
      newStock: Number(item.stockLevel),
      delta,
      note: note?.trim() || undefined,
      occurredAt: occurredAt || new Date().toISOString().split('T')[0]
    });
    return;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export interface DirectStockMovement {
  type: 'SUBTRACT' | 'ADD';
  quantity: number;
  reasonCategory?: string;
  recipient?: string;
  occurredAt?: string;
  note?: string;
}

export async function recordDirectStockMovement(
  itemId: string,
  movement: DirectStockMovement,
  thresholds?: { warning: number, critical: number }
) {
  const path = `inventory/${itemId}`;
  try {
    const itemRef = doc(db, 'inventory', itemId);
    let updatedItemData: any = null;
    let delta = 0;
    let prevStock = 0;
    let nextStock = 0;

    await runTransaction(db, async (transaction) => {
      const itemDoc = await transaction.get(itemRef);
      if (!itemDoc.exists()) {
        throw new Error('Inventory item not found');
      }

      const currentData = itemDoc.data();
      prevStock = currentData.stockLevel || 0;
      const qty = Math.max(1, Number(movement.quantity) || 1);
      
      if (movement.type === 'SUBTRACT') {
        delta = -qty;
        if (prevStock < qty) {
          throw new Error(`Insufficient stock for ${currentData.title}. Available: ${prevStock}, requested: ${qty}`);
        }
        nextStock = prevStock - qty;
      } else {
        delta = qty;
        nextStock = prevStock + qty;
      }

      let status = 'Healthy';
      const warningLimit = thresholds?.warning || 250;
      const criticalLimit = thresholds?.critical || 75;

      if (nextStock <= criticalLimit) status = 'Out';
      else if (nextStock <= warningLimit) status = 'Low';

      transaction.update(itemRef, {
        stockLevel: nextStock,
        status,
        updatedAt: serverTimestamp()
      });

      updatedItemData = { ...currentData, stockLevel: nextStock, status };
    });

    // Check thresholds for notifications
    const criticalLimit = thresholds?.critical || 75;
    const warningLimit = thresholds?.warning || 250;
    if (nextStock <= criticalLimit) {
      await createNotification('CRITICAL_STOCK', 'Critical Stock Level', `${updatedItemData?.title} is at critical level (${nextStock} units).`, { itemId, sku: updatedItemData?.sku });
    } else if (nextStock <= warningLimit) {
      await createNotification('LOW_STOCK', 'Low Stock Warning', `${updatedItemData?.title} is running low (${nextStock} units).`, { itemId, sku: updatedItemData?.sku });
    }

    const noteText = movement.note?.trim() || '';
    const recipientText = movement.recipient?.trim();
    const categoryText = movement.reasonCategory?.trim() || (movement.type === 'SUBTRACT' ? 'Personal / Ad-hoc Giving' : 'Direct Inflow');
    
    // Construct readable audit details
    const actionDesc = movement.type === 'SUBTRACT' ? 'Direct outflow / gave out' : 'Direct inflow / restocked';
    let details = `${actionDesc} ${Math.abs(delta)} unit(s) of ${updatedItemData?.title}`;
    if (recipientText) {
      details += ` • To/By: ${recipientText}`;
    }
    if (noteText) {
      details += ` • "${noteText}"`;
    }

    await createAuditLog('STOCK_UPDATE', itemId, 'inventory', details, {
      isDirectMovement: true,
      movementType: movement.type,
      category: categoryText,
      recipient: recipientText || undefined,
      occurredAt: movement.occurredAt || new Date().toISOString().split('T')[0],
      note: noteText || undefined,
      delta,
      previousStock: prevStock,
      newStock: nextStock,
      item: {
        id: itemId,
        title: updatedItemData?.title,
        sku: updatedItemData?.sku,
        category: updatedItemData?.category
      }
    });

    return updatedItemData;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function recordBatchDirectDistribution(
  items: { itemId: string, quantity: number, title: string, sku: string, language?: string }[],
  details: { recipient?: string, note?: string, category?: string, occurredAt?: string },
  thresholds?: { warning: number, critical: number }
) {
  const path = 'inventory';
  try {
    const updatedItems: any[] = [];
    await runTransaction(db, async (transaction) => {
      // 1. ALL READS FIRST
      const itemDocs = [];
      for (const item of items) {
        const itemRef = doc(db, 'inventory', item.itemId);
        const itemDoc = await transaction.get(itemRef);
        if (!itemDoc.exists()) {
          throw new Error(`Item ${item.title} does not exist!`);
        }
        itemDocs.push({ item, doc: itemDoc });
      }

      // 2. ALL WRITES
      for (const { item, doc: itemDoc } of itemDocs) {
        const itemRef = doc(db, 'inventory', item.itemId);
        const data = itemDoc.data();
        const currentStock = data.stockLevel || 0;
        if (currentStock < item.quantity) {
          throw new Error(`Insufficient stock for ${item.title}. Available: ${currentStock}`);
        }

        const newStock = currentStock - item.quantity;
        let status = 'Healthy';
        const warningLimit = thresholds?.warning || 250;
        const criticalLimit = thresholds?.critical || 75;
        
        if (newStock <= criticalLimit) status = 'Out';
        else if (newStock <= warningLimit) status = 'Low';

        transaction.update(itemRef, {
          stockLevel: newStock,
          status,
          updatedAt: serverTimestamp()
        });

        updatedItems.push({
          itemId: item.itemId,
          title: item.title,
          sku: item.sku,
          quantity: item.quantity,
          previousStock: currentStock,
          newStock,
          status
        });
      }
    });

    // Notify thresholds if needed
    if (thresholds) {
      for (const item of updatedItems) {
        if (item.newStock <= thresholds.critical) {
          await createNotification('CRITICAL_STOCK', 'Critical Stock Level', `${item.title} is at critical level (${item.newStock} units).`, { itemId: item.itemId, sku: item.sku });
        } else if (item.newStock <= thresholds.warning) {
          await createNotification('LOW_STOCK', 'Low Stock Warning', `${item.title} is running low (${item.newStock} units).`, { itemId: item.itemId, sku: item.sku });
        }
      }
    }

    const recipientText = details.recipient?.trim();
    const noteText = details.note?.trim();
    const categoryText = details.category || 'Direct / Personal Distribution';
    const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);

    const logDetails = `Direct distribution of ${totalQty} items (${items.map(i => `${i.quantity}x ${i.title}`).join(', ')})${recipientText ? ` • To: ${recipientText}` : ''}${noteText ? ` • "${noteText}"` : ''}`;

    await createAuditLog('DISTRIBUTION', 'direct', 'inventory', logDetails, {
      isDirectDistribution: true,
      items,
      itemIds: items.map(i => i.itemId),
      recipient: recipientText || undefined,
      note: noteText || undefined,
      category: categoryText,
      occurredAt: details.occurredAt || new Date().toISOString().split('T')[0]
    });

    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteInventoryItem(id: string, itemTitle?: string) {
  const path = `inventory/${id}`;
  try {
    const docRef = doc(db, 'inventory', id);
    await deleteDoc(docRef);
    await createAuditLog('ITEM_DELETED', id, 'inventory', itemTitle ? `Removed item from catalog: ${itemTitle}` : 'Removed item from catalog', { title: itemTitle });
    return;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeToInventory(callback: (items: any[]) => void) {
  const path = 'inventory';
  const q = query(collection(db, path), orderBy('sku', 'asc'));
  
  return onSnapshot(q, (snapshot) => {
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(items);
  }, (error: FirestoreError) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
}

// --- Events ---

export async function addEvent(event: any) {
  const path = 'events';
  try {
    const docRef = await addDoc(collection(db, path), {
      ...event,
      createdAt: serverTimestamp()
    });
    await createAuditLog('EVENT_CREATED', docRef.id, 'event', `Created event: ${event.name}`);
    return docRef;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function createEventWithDistributions(
  eventData: any,
  items: { itemId: string, quantity: number, title: string, sku: string, language?: string }[],
  thresholds?: { warning: number, critical: number }
) {
  const eventsPath = 'events';
  try {
    // Generate an automatic reference ID for the event so we can populate subcollections atomically
    const docRef = doc(collection(db, eventsPath));
    const eventId = docRef.id;

    await runTransaction(db, async (transaction) => {
      // 1. ALL READS FIRST (Required by Firestore transactions)
      const itemDocs = [];
      for (const item of items) {
        const itemRef = doc(db, 'inventory', item.itemId);
        const itemDoc = await transaction.get(itemRef);
        if (!itemDoc.exists()) {
          throw new Error(`Item ${item.title} does not exist!`);
        }
        itemDocs.push({ item, doc: itemDoc });
      }

      // 2. NOW ALL THE WRITES
      const stats = {
        bibles: 0,
        bibles_en: 0,
        bibles_es: 0,
        tracts: 0,
        tracts_en: 0,
        tracts_es: 0,
        booklets: 0,
        booklets_en: 0,
        booklets_es: 0
      };

      for (const { item, doc: itemDoc } of itemDocs) {
        const itemRef = doc(db, 'inventory', item.itemId);
        const data = itemDoc.data();
        const currentStock = data.stockLevel || 0;
        if (currentStock < item.quantity) {
          throw new Error(`Insufficient stock for ${item.title}. Available: ${currentStock}`);
        }

        const newStock = currentStock - item.quantity;

        // Determine system status
        let status = 'Healthy';
        const warningLimit = thresholds?.warning || 250;
        const criticalLimit = thresholds?.critical || 75;
        
        if (newStock <= criticalLimit) status = 'Out';
        else if (newStock <= warningLimit) status = 'Low';

        // Update inventory
        transaction.update(itemRef, {
          stockLevel: newStock,
          status,
          updatedAt: serverTimestamp()
        });

        // Add to stats
        const cat = (data.category || '').toLowerCase();
        const lang = (data.language || item.language || '').toLowerCase();
        
        if (cat.includes('bible')) {
          stats.bibles += item.quantity;
          if (lang.includes('english') || lang === 'en') stats.bibles_en += item.quantity;
          else if (lang.includes('spanish') || lang === 'es') stats.bibles_es += item.quantity;
        } else if (cat.includes('tract')) {
          stats.tracts += item.quantity;
          if (lang.includes('english') || lang === 'en') stats.tracts_en += item.quantity;
          else if (lang.includes('spanish') || lang === 'es') stats.tracts_es += item.quantity;
        } else if (cat.includes('booklet')) {
          stats.booklets += item.quantity;
          if (lang.includes('english') || lang === 'en') stats.booklets_en += item.quantity;
          else if (lang.includes('spanish') || lang === 'es') stats.booklets_es += item.quantity;
        }

        // Add to event materials subcollection
        const materialRef = doc(collection(db, `events/${eventId}/materials`));
        transaction.set(materialRef, {
          itemId: item.itemId,
          sku: item.sku,
          title: item.title,
          language: item.language || data.language || '',
          quantity: item.quantity,
          preCount: (item as any).preCount !== undefined ? (item as any).preCount : item.quantity,
          postCount: (item as any).postCount !== undefined ? (item as any).postCount : 0,
          assignedAt: serverTimestamp()
        });
      }

      // Add the event document
      transaction.set(docRef, {
        ...eventData,
        materialsDistributed: items.reduce((sum, item) => sum + item.quantity, 0),
        categoryStats: stats,
        createdAt: serverTimestamp()
      });
    });

    await createAuditLog('EVENT_CREATED', eventId, 'event', `Created event: ${eventData.name}`);
    return docRef;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, eventsPath);
  }
}

export async function updateEvent(id: string, event: any) {
  const path = `events/${id}`;
  try {
    const docRef = doc(db, 'events', id);
    await updateDoc(docRef, event);
    await createAuditLog('EVENT_UPDATED', id, 'event', `Updated event: ${event.name}`, { event });
    return;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteEvent(id: string, eventName?: string) {
  const path = `events/${id}`;
  try {
    const docRef = doc(db, 'events', id);
    await deleteDoc(docRef);
    await createAuditLog('EVENT_DELETED', id, 'event', eventName ? `Deleted event: ${eventName}` : 'Deleted outreach event', { name: eventName });
    return;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function distributeItems(eventId: string, items: { itemId: string, quantity: number, title: string, sku: string, language?: string }[], thresholds?: { warning: number, critical: number }) {
  const path = `events/${eventId}/distributions`;
  try {
    await runTransaction(db, async (transaction) => {
      const eventRef = doc(db, 'events', eventId);
      const eventDoc = await transaction.get(eventRef);
      
      if (!eventDoc.exists()) {
        throw new Error("Event does not exist!");
      }

      // 1. ALL READS FIRST
      const itemDocs = [];
      for (const item of items) {
        const itemRef = doc(db, 'inventory', item.itemId);
        const itemDoc = await transaction.get(itemRef);
        if (!itemDoc.exists()) {
          throw new Error(`Item ${item.title} does not exist!`);
        }
        itemDocs.push({ item, doc: itemDoc });
      }

      // 2. NOW ALL THE WRITES
      let totalNewMaterials = 0;
      const statsDelta = {
        bibles: 0,
        bibles_en: 0,
        bibles_es: 0,
        tracts: 0,
        tracts_en: 0,
        tracts_es: 0,
        booklets: 0,
        booklets_en: 0,
        booklets_es: 0
      };

      for (const { item, doc: itemDoc } of itemDocs) {
        const itemRef = doc(db, 'inventory', item.itemId);
        const data = itemDoc.data();
        const currentStock = data.stockLevel || 0;
        if (currentStock < item.quantity) {
          throw new Error(`Insufficient stock for ${item.title}. Available: ${currentStock}`);
        }

        const newStock = currentStock - item.quantity;

        // Determine system status
        let status = 'Healthy';
        const warningLimit = thresholds?.warning || 250;
        const criticalLimit = thresholds?.critical || 75;
        
        if (newStock <= criticalLimit) status = 'Out';
        else if (newStock <= warningLimit) status = 'Low';

        // Update inventory
        transaction.update(itemRef, {
          stockLevel: newStock,
          status,
          updatedAt: serverTimestamp()
        });

        // Add to stats delta
        const cat = (data.category || '').toLowerCase();
        const lang = (data.language || item.language || '').toLowerCase();
        
        if (cat.includes('bible')) {
          statsDelta.bibles += item.quantity;
          if (lang.includes('english') || lang === 'en') statsDelta.bibles_en += item.quantity;
          else if (lang.includes('spanish') || lang === 'es') statsDelta.bibles_es += item.quantity;
        } else if (cat.includes('tract')) {
          statsDelta.tracts += item.quantity;
          if (lang.includes('english') || lang === 'en') statsDelta.tracts_en += item.quantity;
          else if (lang.includes('spanish') || lang === 'es') statsDelta.tracts_es += item.quantity;
        } else if (cat.includes('booklet')) {
          statsDelta.booklets += item.quantity;
          if (lang.includes('english') || lang === 'en') statsDelta.booklets_en += item.quantity;
          else if (lang.includes('spanish') || lang === 'es') statsDelta.booklets_es += item.quantity;
        }

        // Add to event materials
        const materialRef = doc(collection(db, `events/${eventId}/materials`));
        transaction.set(materialRef, {
          itemId: item.itemId,
          sku: item.sku,
          title: item.title,
          language: item.language || data.language || '',
          quantity: item.quantity,
          preCount: (item as any).preCount !== undefined ? (item as any).preCount : item.quantity,
          postCount: (item as any).postCount !== undefined ? (item as any).postCount : 0,
          assignedAt: serverTimestamp()
        });

        totalNewMaterials += item.quantity;
      }

      // Update event total and stats
      const eventData = eventDoc.data();
      const currentEventMaterials = eventData.materialsDistributed || 0;
      const currentStats = eventData.categoryStats || { bibles: 0, bibles_en: 0, bibles_es: 0, tracts: 0, tracts_en: 0, tracts_es: 0, booklets: 0, booklets_en: 0, booklets_es: 0, total: 0 };

      transaction.update(eventRef, {
        materialsDistributed: currentEventMaterials + totalNewMaterials,
        categoryStats: {
          bibles: (currentStats.bibles || 0) + statsDelta.bibles,
          bibles_en: (currentStats.bibles_en || 0) + statsDelta.bibles_en,
          bibles_es: (currentStats.bibles_es || 0) + statsDelta.bibles_es,
          tracts: (currentStats.tracts || 0) + statsDelta.tracts,
          tracts_en: (currentStats.tracts_en || 0) + statsDelta.tracts_en,
          tracts_es: (currentStats.tracts_es || 0) + statsDelta.tracts_es,
          booklets: (currentStats.booklets || 0) + statsDelta.booklets,
          booklets_en: (currentStats.booklets_en || 0) + statsDelta.booklets_en,
          booklets_es: (currentStats.booklets_es || 0) + statsDelta.booklets_es,
          total: (currentStats.total || 0) + totalNewMaterials
        }
      });
    });

    // After transaction, check thresholds and notify
    if (thresholds) {
      for (const item of items) {
        const itemDoc = await getDoc(doc(db, 'inventory', item.itemId));
        if (itemDoc.exists()) {
          const stock = itemDoc.data()?.stockLevel;
          if (stock <= thresholds.critical) {
            await createNotification('CRITICAL_STOCK', 'Critical Stock Level', `${item.title} is at critical level (${stock} units).`, { itemId: item.itemId, sku: item.sku });
          } else if (stock <= thresholds.warning) {
            await createNotification('LOW_STOCK', 'Low Stock Warning', `${item.title} is running low (${stock} units).`, { itemId: item.itemId, sku: item.sku });
          }
        }
      }
    }

    const itemIds = items.map(i => i.itemId);
    await createAuditLog('DISTRIBUTION', eventId, 'event', `Distributed ${items.length} items to event`, { items, itemIds });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateEventMaterialQuantity(eventId: string, materialId: string, newQuantity: number, thresholds?: { warning: number, critical: number }) {
  const path = `events/${eventId}/materials/${materialId}`;
  try {
    await runTransaction(db, async (transaction) => {
      const eventRef = doc(db, 'events', eventId);
      const materialRef = doc(db, `events/${eventId}/materials`, materialId);
      
      const eventDoc = await transaction.get(eventRef);
      const materialDoc = await transaction.get(materialRef);
      
      if (!eventDoc.exists() || !materialDoc.exists()) {
        throw new Error("Event or Material does not exist!");
      }

      const eventData = eventDoc.data();
      const materialData = materialDoc.data();
      const oldQuantity = materialData.quantity || 0;
      const quantityDiff = newQuantity - oldQuantity;

      if (quantityDiff === 0) return;

      const itemId = materialData.itemId;
      if (itemId) {
        const itemRef = doc(db, 'inventory', itemId);
        const itemDoc = await transaction.get(itemRef);
        
        if (itemDoc.exists()) {
          const inventoryData = itemDoc.data();
          const currentStock = inventoryData.stockLevel || 0;
          
          if (currentStock < quantityDiff) {
            throw new Error(`Insufficient stock for adjustment. Available: ${currentStock}, Needed: ${quantityDiff}`);
          }
          
          const newStockLevel = currentStock - quantityDiff;

          // Determine system status
          let status = 'Healthy';
          const warningLimit = thresholds?.warning || 250;
          const criticalLimit = thresholds?.critical || 75;
          
          if (newStockLevel <= criticalLimit) status = 'Out';
          else if (newStockLevel <= warningLimit) status = 'Low';

          transaction.update(itemRef, {
            stockLevel: newStockLevel,
            status,
            updatedAt: serverTimestamp()
          });

          // Update stats
          const eventData = eventDoc.data();
          const currentStats = eventData.categoryStats || {};
          const cat = (inventoryData.category || '').toLowerCase();
          const lang = (inventoryData.language || '').toLowerCase();

          const statsUpdate: any = {
            materialsDistributed: (eventData.materialsDistributed || 0) + quantityDiff,
            'categoryStats.total': (currentStats.total || 0) + quantityDiff
          };

          if (cat.includes('bible')) {
            statsUpdate['categoryStats.bibles'] = (currentStats.bibles || 0) + quantityDiff;
            if (lang.includes('english') || lang === 'en') statsUpdate['categoryStats.bibles_en'] = (currentStats.bibles_en || 0) + quantityDiff;
            else if (lang.includes('spanish') || lang === 'es') statsUpdate['categoryStats.bibles_es'] = (currentStats.bibles_es || 0) + quantityDiff;
          } else if (cat.includes('tract')) {
            statsUpdate['categoryStats.tracts'] = (currentStats.tracts || 0) + quantityDiff;
            if (lang.includes('english') || lang === 'en') statsUpdate['categoryStats.tracts_en'] = (currentStats.tracts_en || 0) + quantityDiff;
            else if (lang.includes('spanish') || lang === 'es') statsUpdate['categoryStats.tracts_es'] = (currentStats.tracts_es || 0) + quantityDiff;
          } else if (cat.includes('booklet')) {
            statsUpdate['categoryStats.booklets'] = (currentStats.booklets || 0) + quantityDiff;
            if (lang.includes('english') || lang === 'en') statsUpdate['categoryStats.booklets_en'] = (currentStats.booklets_en || 0) + quantityDiff;
            else if (lang.includes('spanish') || lang === 'es') statsUpdate['categoryStats.booklets_es'] = (currentStats.booklets_es || 0) + quantityDiff;
          }

          transaction.update(eventRef, statsUpdate);
        }
      } else {
        // Unlinked item - just update event total
        const eventData = eventDoc.data();
        transaction.update(eventRef, {
          materialsDistributed: (eventData.materialsDistributed || 0) + quantityDiff,
          'categoryStats.total': (eventData.categoryStats?.total || 0) + quantityDiff
        });
      }

      transaction.update(materialRef, { quantity: newQuantity });
      
      const eventName = eventData?.location || eventData?.name || 'outreach event';
      createAuditLog('EVENT_UPDATED', eventId, 'event', `Adjusted quantity of material in event: ${eventName}`, { eventName });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateEventMaterialCounts(
  eventId: string, 
  materialId: string, 
  newPreCount: number, 
  newPostCount: number, 
  thresholds?: { warning: number, critical: number }
) {
  const path = `events/${eventId}/materials/${materialId}`;
  try {
    await runTransaction(db, async (transaction) => {
      const eventRef = doc(db, 'events', eventId);
      const materialRef = doc(db, `events/${eventId}/materials`, materialId);
      
      const eventDoc = await transaction.get(eventRef);
      const materialDoc = await transaction.get(materialRef);
      
      if (!eventDoc.exists() || !materialDoc.exists()) {
        throw new Error("Event or Material does not exist!");
      }

      const eventData = eventDoc.data();
      const materialData = materialDoc.data();
      const oldPreCount = materialData.preCount !== undefined ? materialData.preCount : (materialData.quantity || 0);
      const oldPostCount = materialData.postCount !== undefined ? materialData.postCount : 0;
      const oldQuantity = materialData.quantity || 0;

      const newQuantity = Math.max(0, newPreCount - newPostCount);
      const quantityDiff = newQuantity - oldQuantity;

      if (quantityDiff === 0 && newPreCount === oldPreCount && newPostCount === oldPostCount) {
        return;
      }

      const itemId = materialData.itemId;
      if (itemId) {
        const itemRef = doc(db, 'inventory', itemId);
        const itemDoc = await transaction.get(itemRef);
        
        if (itemDoc.exists()) {
          const inventoryData = itemDoc.data();
          const currentStock = inventoryData.stockLevel || 0;
          
          if (currentStock < quantityDiff) {
            throw new Error(`Insufficient stock for adjustment. Available: ${currentStock}, Needed: ${quantityDiff}`);
          }
          
          const newStockLevel = currentStock - quantityDiff;

          // Determine system status
          let status = 'Healthy';
          const warningLimit = thresholds?.warning || 250;
          const criticalLimit = thresholds?.critical || 75;
          
          if (newStockLevel <= criticalLimit) status = 'Out';
          else if (newStockLevel <= warningLimit) status = 'Low';

          transaction.update(itemRef, {
            stockLevel: newStockLevel,
            status,
            updatedAt: serverTimestamp()
          });

          // Update stats
          const eventData = eventDoc.data();
          const currentStats = eventData.categoryStats || {};
          const cat = (inventoryData.category || '').toLowerCase();
          const lang = (inventoryData.language || '').toLowerCase();

          const statsUpdate: any = {
            materialsDistributed: (eventData.materialsDistributed || 0) + quantityDiff,
            'categoryStats.total': (currentStats.total || 0) + quantityDiff
          };

          if (cat.includes('bible')) {
            statsUpdate['categoryStats.bibles'] = (currentStats.bibles || 0) + quantityDiff;
            if (lang.includes('english') || lang === 'en') statsUpdate['categoryStats.bibles_en'] = (currentStats.bibles_en || 0) + quantityDiff;
            else if (lang.includes('spanish') || lang === 'es') statsUpdate['categoryStats.bibles_es'] = (currentStats.bibles_es || 0) + quantityDiff;
          } else if (cat.includes('tract')) {
            statsUpdate['categoryStats.tracts'] = (currentStats.tracts || 0) + quantityDiff;
            if (lang.includes('english') || lang === 'en') statsUpdate['categoryStats.tracts_en'] = (currentStats.tracts_en || 0) + quantityDiff;
            else if (lang.includes('spanish') || lang === 'es') statsUpdate['categoryStats.tracts_es'] = (currentStats.tracts_es || 0) + quantityDiff;
          } else if (cat.includes('booklet')) {
            statsUpdate['categoryStats.booklets'] = (currentStats.booklets || 0) + quantityDiff;
            if (lang.includes('english') || lang === 'en') statsUpdate['categoryStats.booklets_en'] = (currentStats.booklets_en || 0) + quantityDiff;
            else if (lang.includes('spanish') || lang === 'es') statsUpdate['categoryStats.booklets_es'] = (currentStats.booklets_es || 0) + quantityDiff;
          }

          transaction.update(eventRef, statsUpdate);
        }
      } else {
        // Unlinked item
        const eventData = eventDoc.data();
        transaction.update(eventRef, {
          materialsDistributed: (eventData.materialsDistributed || 0) + quantityDiff,
          'categoryStats.total': (eventData.categoryStats?.total || 0) + quantityDiff
        });
      }

      transaction.update(materialRef, {
        quantity: newQuantity,
        preCount: newPreCount,
        postCount: newPostCount
      });

      const eventName = eventData?.location || eventData?.name || 'outreach event';
      createAuditLog('EVENT_UPDATED', eventId, 'event', `Adjusted pre/post counts for event: ${eventName}`, { eventName });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeEventMaterial(eventId: string, materialId: string, thresholds?: { warning: number, critical: number }) {
  const path = `events/${eventId}/materials/${materialId}`;
  try {
    await runTransaction(db, async (transaction) => {
      const eventRef = doc(db, 'events', eventId);
      const materialRef = doc(db, `events/${eventId}/materials`, materialId);
      
      const eventDoc = await transaction.get(eventRef);
      const materialDoc = await transaction.get(materialRef);
      
      if (!eventDoc.exists() || !materialDoc.exists()) {
        throw new Error("Event or Material does not exist!");
      }

      const eventData = eventDoc.data();
      const materialData = materialDoc.data();
      const quantityToRemove = materialData.quantity || 0;

      const itemId = materialData.itemId;
      if (itemId) {
        const itemRef = doc(db, 'inventory', itemId);
        const itemDoc = await transaction.get(itemRef);
        
        if (itemDoc.exists()) {
          const inventoryData = itemDoc.data();
          const currentStock = inventoryData.stockLevel || 0;
          const newStockLevel = currentStock + quantityToRemove;

          // Determine system status
          let status = 'Healthy';
          const warningLimit = thresholds?.warning || 250;
          const criticalLimit = thresholds?.critical || 75;
          
          if (newStockLevel <= criticalLimit) status = 'Out';
          else if (newStockLevel <= warningLimit) status = 'Low';

          // Return items to inventory
          transaction.update(itemRef, {
            stockLevel: newStockLevel,
            status,
            updatedAt: serverTimestamp()
          });

          // Update stats
          const eventData = eventDoc.data();
          const currentStats = eventData.categoryStats || {};
          const cat = (inventoryData.category || '').toLowerCase();
          const lang = (inventoryData.language || '').toLowerCase();

          const statsUpdate: any = {
            materialsDistributed: (eventData.materialsDistributed || 0) - quantityToRemove,
            'categoryStats.total': (currentStats.total || 0) - quantityToRemove
          };

          if (cat.includes('bible')) {
            statsUpdate['categoryStats.bibles'] = (currentStats.bibles || 0) - quantityToRemove;
            if (lang.includes('english') || lang === 'en') statsUpdate['categoryStats.bibles_en'] = (currentStats.bibles_en || 0) - quantityToRemove;
            else if (lang.includes('spanish') || lang === 'es') statsUpdate['categoryStats.bibles_es'] = (currentStats.bibles_es || 0) - quantityToRemove;
          } else if (cat.includes('tract')) {
            statsUpdate['categoryStats.tracts'] = (currentStats.tracts || 0) - quantityToRemove;
            if (lang.includes('english') || lang === 'en') statsUpdate['categoryStats.tracts_en'] = (currentStats.tracts_en || 0) - quantityToRemove;
            else if (lang.includes('spanish') || lang === 'es') statsUpdate['categoryStats.tracts_es'] = (currentStats.tracts_es || 0) - quantityToRemove;
          } else if (cat.includes('booklet')) {
            statsUpdate['categoryStats.booklets'] = (currentStats.booklets || 0) - quantityToRemove;
            if (lang.includes('english') || lang === 'en') statsUpdate['categoryStats.booklets_en'] = (currentStats.booklets_en || 0) - quantityToRemove;
            else if (lang.includes('spanish') || lang === 'es') statsUpdate['categoryStats.booklets_es'] = (currentStats.booklets_es || 0) - quantityToRemove;
          }

          transaction.update(eventRef, statsUpdate);
        }
      } else {
        // Unlinked item - just update event total
        const eventData = eventDoc.data();
        transaction.update(eventRef, {
          materialsDistributed: (eventData.materialsDistributed || 0) - quantityToRemove,
          'categoryStats.total': (eventData.categoryStats?.total || 0) - quantityToRemove
        });
      }

      transaction.delete(materialRef);
      const eventName = eventData?.location || eventData?.name || 'outreach event';
      createAuditLog('EVENT_UPDATED', eventId, 'event', `Removed material from event: ${eventName}`, { eventName });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeToEvents(callback: (events: any[]) => void) {
  const path = 'events';
  const q = query(collection(db, path), orderBy('date', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const events = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(events);
  }, (error: FirestoreError) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
}

export function subscribeToEventMaterials(eventId: string, callback: (materials: any[]) => void) {
  const path = `events/${eventId}/materials`;
  const q = query(collection(db, path), orderBy('assignedAt', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const materials = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(materials);
  }, (error: FirestoreError) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
}

// --- Settings ---

export function subscribeToSettings(callback: (settings: any) => void) {
  const path = 'settings/system';
  return onSnapshot(doc(db, path), (snapshot) => {
    callback(snapshot.data() || {});
  }, (error: FirestoreError) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
}

export async function updateSettings(settings: any) {
  const path = 'settings/system';
  try {
    await setDoc(doc(db, 'settings', 'system'), settings, { merge: true });
    await createAuditLog('SETTINGS_UPDATE', 'system', 'settings', 'Updated system settings');
    return;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// --- Users ---

export function subscribeToUsers(callback: (users: any[]) => void) {
  const path = 'users';
  return onSnapshot(collection(db, path), (snapshot) => {
    const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(users);
  }, (error: FirestoreError) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
}

export function subscribeToUserProfile(userId: string, callback: (profile: any) => void) {
  const path = `users/${userId}`;
  return onSnapshot(doc(db, 'users', userId), (snapshot) => {
    callback(snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null);
  }, (error: FirestoreError) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
}

export async function updateUserRole(userId: string, role: 'admin' | 'user' | 'guest') {
  const path = `users/${userId}`;
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    const previousRole = userDoc.exists() ? userDoc.data().role : 'unknown';

    await updateDoc(userRef, { role });
    await createAuditLog('ROLE_UPDATE', userId, 'user', `Updated user role to ${role}`, {
      previousRole,
      newRole: role
    });
    return;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncUserProfile(user: any) {
  const path = `users/${user.uid}`;
  try {
    const userRef = doc(db, 'users', user.uid);
    
    // Check if user exists to preserve role
    let userDoc;
    try {
      userDoc = await getDoc(userRef);
    } catch (readErr: any) {
      if (readErr?.message?.includes('offline') || readErr?.code === 'unavailable') {
        console.info("Firestore client currently offline; deferring initial profile sync.");
        return;
      }
      throw readErr;
    }
    
    const data = {
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      lastLogin: serverTimestamp()
    };
    
    if (!userDoc.exists()) {
      const normalizedEmail = user.email?.toLowerCase();
      const primaryAdminEmail = import.meta.env.VITE_PRIMARY_ADMIN_EMAIL?.toLowerCase() || "yilongwang05@gmail.com";
      const isPrimaryAdmin = normalizedEmail === primaryAdminEmail;

      if (!isPrimaryAdmin) {
        // Only check authorized_emails collection if not the primary admin
        let authEmailDoc;
        try {
          const authEmailRef = doc(db, 'authorized_emails', normalizedEmail);
          authEmailDoc = await getDoc(authEmailRef);
        } catch (emailErr: any) {
          if (emailErr?.message?.includes('offline') || emailErr?.code === 'unavailable') {
            console.info("Firestore client currently offline; deferring email authorization check.");
            return;
          }
          throw emailErr;
        }

        if (!authEmailDoc || !authEmailDoc.exists()) {
          throw new Error("NOT_AUTHORIZED");
        }
      }

      // New user defaults to 'guest' role for admin approval flow
      // Unless it's the default admin email
      const role = isPrimaryAdmin ? 'admin' : 'guest';
      return await setDoc(userRef, { ...data, role });
    } else {
      return await updateDoc(userRef, data);
    }
  } catch (error: any) {
    if (error.message === "NOT_AUTHORIZED") {
      throw error;
    }
    if (error?.message?.includes('offline') || error?.code === 'unavailable') {
      console.info("Firestore user profile sync deferred while offline.");
      return;
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// --- Authorized Emails ---

export function subscribeToAuthorizedEmails(callback: (emails: string[]) => void) {
  const path = 'authorized_emails';
  return onSnapshot(collection(db, path), (snapshot) => {
    const emails = snapshot.docs.map(doc => doc.id);
    callback(emails);
  }, (error: FirestoreError) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
}

export async function authorizeEmail(email: string) {
  const normalizedEmail = email.toLowerCase();
  const path = `authorized_emails/${normalizedEmail}`;
  try {
    const { setDoc } = await import('firebase/firestore');
    await setDoc(doc(db, 'authorized_emails', normalizedEmail), { 
      addedAt: serverTimestamp(),
      addedBy: auth.currentUser?.email 
    });
    await createAuditLog('EMAIL_AUTHORIZED', normalizedEmail, 'auth', `Authorized email: ${normalizedEmail}`);
    return;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeAuthorizedEmail(email: string) {
  const normalizedEmail = email.toLowerCase();
  const path = `authorized_emails/${normalizedEmail}`;
  try {
    const { deleteDoc } = await import('firebase/firestore');
    await deleteDoc(doc(db, 'authorized_emails', normalizedEmail));
    await createAuditLog('EMAIL_DEAUTHORIZED', normalizedEmail, 'auth', `Deauthorized email: ${normalizedEmail}`);
    return;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function importEventWithMaterials(eventData: any, materials: { sku: string, quantity: number, title?: string }[]) {
  const eventsPath = 'events';
  try {
    const { serverTimestamp, getDocs, where, query, collection } = await import('firebase/firestore');
    
    // 1. Pre-fetch all relevant inventory items to avoid queries inside transaction
    const skus = materials.map(m => m.sku).filter(Boolean);
    const inventoryMap = new Map();
    
    if (skus.length > 0) {
      const inventoryQ = query(collection(db, 'inventory'), where('sku', 'in', skus.slice(0, 30)));
      const inventorySnapshot = await getDocs(inventoryQ);
      inventorySnapshot.forEach(doc => {
        inventoryMap.set(doc.data().sku, { id: doc.id, ...doc.data() });
      });
    }

    return await runTransaction(db, async (transaction) => {
      // 2. Create the event
      const eventRef = doc(collection(db, eventsPath));
      const totalQuantity = materials.reduce((sum, m) => sum + m.quantity, 0);
      
      const stats = {
        bibles: 0,
        bibles_en: 0,
        bibles_es: 0,
        tracts: 0,
        tracts_en: 0,
        tracts_es: 0,
        booklets: 0,
        booklets_en: 0,
        booklets_es: 0,
        total: totalQuantity
      };

      // READ ALL INVENTORY LEVELS FIRST BEFORE ANY WRITES
      const itemLockDocs = new Map();
      for (const material of materials) {
        const itemInfo = inventoryMap.get(material.sku);
        if (itemInfo) {
          const itemRef = doc(db, 'inventory', itemInfo.id);
          const itemDocForLock = await transaction.get(itemRef);
          itemLockDocs.set(itemInfo.id, itemDocForLock);
        }
      }

      // 3. Process each material and calculate stats and generate WRITES
      for (const material of materials) {
        const itemInfo = inventoryMap.get(material.sku);
        const sku = material.sku.toUpperCase();

        // High-level stat calculation
        if (sku === 'BIBLES') stats.bibles += material.quantity;
        else if (sku === 'BIBLES_EN') { stats.bibles += material.quantity; stats.bibles_en += material.quantity; }
        else if (sku === 'BIBLES_ES') { stats.bibles += material.quantity; stats.bibles_es += material.quantity; }
        else if (sku === 'TRACTS') stats.tracts += material.quantity;
        else if (sku === 'TRACTS_EN') { stats.tracts += material.quantity; stats.tracts_en += material.quantity; }
        else if (sku === 'TRACTS_ES') { stats.tracts += material.quantity; stats.tracts_es += material.quantity; }
        else if (sku === 'BOOKLETS') stats.booklets += material.quantity;
        else if (sku === 'BOOKLETS_EN') { stats.booklets += material.quantity; stats.booklets_en += material.quantity; }
        else if (sku === 'BOOKLETS_ES') { stats.booklets += material.quantity; stats.booklets_es += material.quantity; }
        else if (itemInfo) {
          // If it's a specific item, check its category and language
          const cat = (itemInfo.category || '').toLowerCase();
          const lang = (itemInfo.language || '').toLowerCase();
          
          if (cat.includes('bible')) {
            stats.bibles += material.quantity;
            if (lang.includes('english') || lang === 'en') stats.bibles_en += material.quantity;
            else if (lang.includes('spanish') || lang === 'es') stats.bibles_es += material.quantity;
          } else if (cat.includes('tract')) {
            stats.tracts += material.quantity;
            if (lang.includes('english') || lang === 'en') stats.tracts_en += material.quantity;
            else if (lang.includes('spanish') || lang === 'es') stats.tracts_es += material.quantity;
          } else if (cat.includes('booklet')) {
            stats.booklets += material.quantity;
            if (lang.includes('english') || lang === 'en') stats.booklets_en += material.quantity;
            else if (lang.includes('spanish') || lang === 'es') stats.booklets_es += material.quantity;
          }
        }

        if (itemInfo) {
          const itemRef = doc(db, 'inventory', itemInfo.id);
          const itemDocForLock = itemLockDocs.get(itemInfo.id);
          const currentStock = itemDocForLock?.data()?.stockLevel || 0;
          
          transaction.update(itemRef, {
            stockLevel: Math.max(0, currentStock - material.quantity),
            updatedAt: serverTimestamp()
          });

          // Add to event materials
          const materialRef = doc(collection(db, `events/${eventRef.id}/materials`));
          transaction.set(materialRef, {
            itemId: itemInfo.id,
            sku: material.sku,
            title: material.title || itemInfo.title,
            quantity: material.quantity,
            assignedAt: serverTimestamp()
          });
        } else {
          const materialRef = doc(collection(db, `events/${eventRef.id}/materials`));
          transaction.set(materialRef, {
            sku: material.sku,
            title: material.title || 'Unknown Item',
            quantity: material.quantity,
            assignedAt: serverTimestamp(),
            unlinked: true
          });
        }
      }

      // Parse YYYY-MM-DD as a local date at noon to prevent day shifting
      const parseSafeDate = (dStr: string) => {
        if (!dStr) return new Date();
        const [year, month, day] = dStr.split('-').map(Number);
        if (isNaN(year)) return new Date(dStr);
        return new Date(year, month - 1, day, 12, 0, 0);
      };

      transaction.set(eventRef, {
        name: eventData.name,
        date: Timestamp.fromDate(parseSafeDate(eventData.date)),
        location: eventData.location,
        status: eventData.status,
        materialsDistributed: totalQuantity,
        categoryStats: stats,
        createdAt: serverTimestamp()
      });

      await createAuditLog('EVENT_CREATED', eventRef.id, 'event', `Imported event via AI: ${eventData.name}`, { materialCount: materials.length });
      return eventRef;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, eventsPath);
  }
}

// --- Orders ---

export function subscribeToOrders(callback: (orders: any[]) => void) {
  const path = 'orders';
  const q = query(collection(db, path), orderBy('orderedDate', 'desc'));
  
  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    callback(orders);
  }, (error: FirestoreError) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
}

export async function addOrderItem(order: any) {
  const path = 'orders';
  try {
    const docId = order.key ? order.key.replace(/[^a-zA-Z0-9_-]/g, '_') : undefined;
    let docRef;
    if (docId) {
      docRef = doc(db, 'orders', docId);
      await setDoc(docRef, {
        ...order,
        createdAt: serverTimestamp()
      }, { merge: true });
    } else {
      docRef = await addDoc(collection(db, path), {
        ...order,
        createdAt: serverTimestamp()
      });
    }
    await createAuditLog('ORDER_CREATED', docRef.id || docId, 'order', `Created order for: ${order.title} (${order.qty} units)`);
    return docRef;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateOrderItem(id: string, updates: any, orderTitle?: string) {
  const path = `orders/${id}`;
  try {
    await updateDoc(doc(db, 'orders', id), {
      ...updates,
      updatedAt: serverTimestamp()
    });
    await createAuditLog('ORDER_UPDATED', id, 'order', orderTitle ? `Updated order for: ${orderTitle}` : 'Updated literature order', { title: orderTitle });
    return;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteOrderItem(id: string, orderTitle?: string) {
  const path = `orders/${id}`;
  try {
    await deleteDoc(doc(db, 'orders', id));
    await createAuditLog('ORDER_DELETED', id, 'order', orderTitle ? `Cancelled order for: ${orderTitle}` : 'Cancelled literature order', { title: orderTitle });
    return;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function seedData() {
  const inventoryPath = 'inventory';
  const eventsPath = 'events';
  const settingsPath = 'settings/system';

  const items = [
    { sku: 'B-EN-001', title: 'NKJV Holy Bible', subtitle: 'Pew Edition - Hardcover', category: 'Bibles', language: 'English', stockLevel: 450, status: 'Healthy', updatedAt: serverTimestamp() },
    { sku: 'B-ES-001', title: 'Santa Biblia RV1960', subtitle: 'Edición de Estudio', category: 'Bibles', language: 'Spanish', stockLevel: 320, status: 'Healthy', updatedAt: serverTimestamp() },
    { sku: 'T-EN-001', title: 'Steps to Christ', subtitle: 'Pocket Tract', category: 'Tracts', language: 'English', stockLevel: 2500, status: 'Healthy', updatedAt: serverTimestamp() },
    { sku: 'T-ES-001', title: 'El Camino a Cristo', subtitle: 'Tratado de Bolsillo', category: 'Tracts', language: 'Spanish', stockLevel: 1800, status: 'Healthy', updatedAt: serverTimestamp() },
    { sku: 'BK-EN-001', title: 'Understanding Prophecy', subtitle: 'Introductory Booklet', category: 'Booklets', language: 'English', stockLevel: 120, status: 'Low', updatedAt: serverTimestamp() },
    { sku: 'BK-ES-001', title: 'Entendiendo la Profecía', subtitle: 'Folleto Introductorio', category: 'Booklets', language: 'Spanish', stockLevel: 85, status: 'Low', updatedAt: serverTimestamp() },
  ];

  const events = [
    { name: 'Regional Outreach - North Sector', date: Timestamp.fromDate(new Date('2024-10-12')), location: 'Grand Plaza Convention Center', materialsDistributed: 1250, status: 'Scheduled', createdAt: serverTimestamp() },
    { name: 'Weekly Bible Study Series', date: Timestamp.fromDate(new Date('2024-10-14')), location: 'Community Center West', materialsDistributed: 420, status: 'Stock Alert', createdAt: serverTimestamp() },
  ];

  for (const item of items) {
    await addDoc(collection(db, inventoryPath), item);
  }

  for (const event of events) {
    await addDoc(collection(db, eventsPath), event);
  }

  const { updateDoc, doc } = await import('firebase/firestore');
  await updateDoc(doc(db, settingsPath), {
    orgName: "Literature Inventory Management",
    taxId: "TX-9920-441-B",
    address: "722 Industrial Parkway, Suite 400\nNew London, CT 06320\nUnited States",
    timezone: "UTC-05:00 Eastern Standard",
    updateFrequency: "Real-time (Atomic)",
    categories: ['Bibles', 'Tracts', 'Booklets']
  });
}
