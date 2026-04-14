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
  limit
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

// --- Audit Logs ---

export type AuditAction = 
  | 'STOCK_UPDATE' 
  | 'ITEM_CREATED' 
  | 'ITEM_DELETED' 
  | 'EVENT_CREATED' 
  | 'EVENT_UPDATED' 
  | 'EVENT_DELETED' 
  | 'DISTRIBUTION' 
  | 'RESTOCK' 
  | 'ROLE_UPDATE' 
  | 'SETTINGS_UPDATE' 
  | 'EMAIL_AUTHORIZED' 
  | 'EMAIL_DEAUTHORIZED'
  | 'NOTIFICATION_CREATED';

export async function createAuditLog(action: AuditAction, targetId: string, targetType: string, details: string, metadata?: any) {
  const path = 'audit_logs';
  try {
    return await addDoc(collection(db, path), {
      action,
      targetId,
      targetType,
      details,
      metadata,
      userId: auth.currentUser?.uid,
      userName: auth.currentUser?.displayName || 'Unknown User',
      userEmail: auth.currentUser?.email,
      timestamp: new Date().toISOString()
    });
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

// --- Notifications ---

export type NotificationType = 'LOW_STOCK' | 'CRITICAL_STOCK' | 'SYSTEM' | 'EVENT';

export async function createNotification(type: NotificationType, title: string, message: string, metadata?: any) {
  const path = 'notifications';
  try {
    return await addDoc(collection(db, path), {
      type,
      title,
      message,
      metadata,
      read: false,
      createdAt: new Date().toISOString(),
      userId: auth.currentUser?.uid
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
      readAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

// --- Inventory ---

export async function addInventoryItem(item: any) {
  const path = 'inventory';
  try {
    const docRef = await addDoc(collection(db, path), {
      ...item,
      updatedAt: new Date().toISOString()
    });
    await createAuditLog('ITEM_CREATED', docRef.id, 'inventory', `Created item: ${item.title} (${item.sku})`);
    return docRef;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateInventoryItem(id: string, item: any, thresholds?: { warning: number, critical: number }) {
  const path = `inventory/${id}`;
  try {
    const docRef = doc(db, 'inventory', id);
    await updateDoc(docRef, {
      ...item,
      updatedAt: new Date().toISOString()
    });
    
    // Check thresholds if provided
    if (thresholds) {
      if (item.stockLevel <= thresholds.critical) {
        await createNotification('CRITICAL_STOCK', 'Critical Stock Level', `${item.title} is at critical level (${item.stockLevel} units).`, { itemId: id, sku: item.sku });
      } else if (item.stockLevel <= thresholds.warning) {
        await createNotification('LOW_STOCK', 'Low Stock Warning', `${item.title} is running low (${item.stockLevel} units).`, { itemId: id, sku: item.sku });
      }
    }

    await createAuditLog('STOCK_UPDATE', id, 'inventory', `Updated item: ${item.title}`, { item });
    return;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteInventoryItem(id: string) {
  const path = `inventory/${id}`;
  try {
    const docRef = doc(db, 'inventory', id);
    await deleteDoc(docRef);
    await createAuditLog('ITEM_DELETED', id, 'inventory', `Deleted item ID: ${id}`);
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
      createdAt: new Date().toISOString()
    });
    await createAuditLog('EVENT_CREATED', docRef.id, 'event', `Created event: ${event.name}`);
    return docRef;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
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

export async function deleteEvent(id: string) {
  const path = `events/${id}`;
  try {
    const docRef = doc(db, 'events', id);
    await deleteDoc(docRef);
    await createAuditLog('EVENT_DELETED', id, 'event', `Deleted event ID: ${id}`);
    return;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function distributeItems(eventId: string, items: { itemId: string, quantity: number, title: string, sku: string }[], thresholds?: { warning: number, critical: number }) {
  const path = `events/${eventId}/distributions`;
  try {
    await runTransaction(db, async (transaction) => {
      const eventRef = doc(db, 'events', eventId);
      const eventDoc = await transaction.get(eventRef);
      
      if (!eventDoc.exists()) {
        throw new Error("Event does not exist!");
      }

      let totalNewMaterials = 0;

      for (const item of items) {
        const itemRef = doc(db, 'inventory', item.itemId);
        const itemDoc = await transaction.get(itemRef);
        
        if (!itemDoc.exists()) {
          throw new Error(`Item ${item.title} does not exist!`);
        }

        const currentStock = itemDoc.data().stockLevel || 0;
        if (currentStock < item.quantity) {
          throw new Error(`Insufficient stock for ${item.title}. Available: ${currentStock}`);
        }

        const newStock = currentStock - item.quantity;

        // Update inventory
        transaction.update(itemRef, {
          stockLevel: newStock,
          updatedAt: new Date().toISOString()
        });

        // Add to event materials
        const materialRef = doc(collection(db, `events/${eventId}/materials`));
        transaction.set(materialRef, {
          itemId: item.itemId,
          sku: item.sku,
          title: item.title,
          quantity: item.quantity,
          assignedAt: new Date().toISOString()
        });

        totalNewMaterials += item.quantity;
      }

      // Update event total
      const currentEventMaterials = eventDoc.data().materialsDistributed || 0;
      transaction.update(eventRef, {
        materialsDistributed: currentEventMaterials + totalNewMaterials
      });
    });

    // After transaction, check thresholds and notify
    if (thresholds) {
      for (const item of items) {
        const { getDoc } = await import('firebase/firestore');
        const itemDoc = await getDoc(doc(db, 'inventory', item.itemId));
        if (itemDoc.exists()) {
          const stock = itemDoc.data().stockLevel;
          if (stock <= thresholds.critical) {
            await createNotification('CRITICAL_STOCK', 'Critical Stock Level', `${item.title} is at critical level (${stock} units).`, { itemId: item.itemId, sku: item.sku });
          } else if (stock <= thresholds.warning) {
            await createNotification('LOW_STOCK', 'Low Stock Warning', `${item.title} is running low (${stock} units).`, { itemId: item.itemId, sku: item.sku });
          }
        }
      }
    }

    await createAuditLog('DISTRIBUTION', eventId, 'event', `Distributed ${items.length} items to event`, { items });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
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

export async function restockItem(eventId: string, materialId: string, itemId: string, quantityToRestock: number) {
  const path = `events/${eventId}/materials/${materialId}/restock`;
  try {
    await runTransaction(db, async (transaction) => {
      const materialRef = doc(db, `events/${eventId}/materials`, materialId);
      const itemRef = doc(db, 'inventory', itemId);
      const eventRef = doc(db, 'events', eventId);

      const materialDoc = await transaction.get(materialRef);
      const itemDoc = await transaction.get(itemRef);
      const eventDoc = await transaction.get(eventRef);

      if (!materialDoc.exists() || !itemDoc.exists() || !eventDoc.exists()) {
        throw new Error("Required documents for restock not found.");
      }

      const currentMaterialQty = materialDoc.data().quantity || 0;
      const currentInventoryQty = itemDoc.data().stockLevel || 0;
      const currentEventMaterials = eventDoc.data().materialsDistributed || 0;

      if (quantityToRestock > currentMaterialQty) {
        throw new Error("Cannot restock more than distributed.");
      }

      // 1. Update Inventory
      transaction.update(itemRef, {
        stockLevel: currentInventoryQty + quantityToRestock,
        updatedAt: new Date().toISOString()
      });

      // 2. Update Event Material Record
      if (currentMaterialQty === quantityToRestock) {
        transaction.delete(materialRef);
      } else {
        transaction.update(materialRef, {
          quantity: currentMaterialQty - quantityToRestock
        });
      }

      // 3. Update Event Total
      transaction.update(eventRef, {
        materialsDistributed: currentEventMaterials - quantityToRestock
      });
    });

    await createAuditLog('RESTOCK', eventId, 'event', `Restocked ${quantityToRestock} units of item ${itemId} from event`);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
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
    await updateDoc(doc(db, path), settings);
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
    await updateDoc(doc(db, 'users', userId), { role });
    await createAuditLog('ROLE_UPDATE', userId, 'user', `Updated user role to ${role}`);
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
    const { getDoc } = await import('firebase/firestore');
    const userDoc = await getDoc(userRef);
    
    const data = {
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      lastLogin: new Date().toISOString()
    };
    
    if (!userDoc.exists()) {
      // 1. Check if email is authorized
      const authEmailRef = doc(db, 'authorized_emails', user.email);
      const authEmailDoc = await getDoc(authEmailRef);
      const isPrimaryAdmin = user.email === "YilongWang05@gmail.com";

      if (!authEmailDoc.exists() && !isPrimaryAdmin) {
        // Not authorized - this will trigger a permission error in rules
        // or we can throw a custom error here
        throw new Error("NOT_AUTHORIZED");
      }

      // New user defaults to 'guest' role for admin approval flow
      // Unless it's the default admin email
      const role = isPrimaryAdmin ? 'admin' : 'guest';
      const { setDoc } = await import('firebase/firestore');
      return await setDoc(userRef, { ...data, role });
    } else {
      return await updateDoc(userRef, data);
    }
  } catch (error: any) {
    if (error.message === "NOT_AUTHORIZED") {
      throw error;
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
  const path = `authorized_emails/${email}`;
  try {
    const { setDoc } = await import('firebase/firestore');
    await setDoc(doc(db, 'authorized_emails', email), { 
      addedAt: new Date().toISOString(),
      addedBy: auth.currentUser?.email 
    });
    await createAuditLog('EMAIL_AUTHORIZED', email, 'auth', `Authorized email: ${email}`);
    return;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function removeAuthorizedEmail(email: string) {
  const path = `authorized_emails/${email}`;
  try {
    const { deleteDoc } = await import('firebase/firestore');
    await deleteDoc(doc(db, 'authorized_emails', email));
    await createAuditLog('EMAIL_DEAUTHORIZED', email, 'auth', `Deauthorized email: ${email}`);
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
    { sku: 'B-ES-992', title: 'Study Bible (Hardcover)', subtitle: 'Reina Valera 1960', category: 'Bibles', language: 'Spanish', stockLevel: 2410, status: 'Healthy', updatedAt: new Date().toISOString() },
    { sku: 'T-EN-012', title: 'Steps to Freedom', subtitle: 'Evangelistic Tract Series', category: 'Tracts', language: 'English', stockLevel: 124, status: 'Low', updatedAt: new Date().toISOString() },
    { sku: 'S-FR-441', title: 'Doctrine of Hope', subtitle: 'Advanced Study Series', category: 'Study Guides', language: 'French', stockLevel: 0, status: 'Out', updatedAt: new Date().toISOString() },
  ];

  const events = [
    { name: 'Regional Meeting - North Sector', date: Timestamp.fromDate(new Date('2024-10-12')), location: 'Grand Plaza Convention Center', materialsDistributed: 1250, status: 'Scheduled', createdAt: new Date().toISOString() },
    { name: 'Weekly Bible Study Series', date: Timestamp.fromDate(new Date('2024-10-14')), location: 'Community Center West', materialsDistributed: 420, status: 'Stock Alert', createdAt: new Date().toISOString() },
  ];

  for (const item of items) {
    await addDoc(collection(db, inventoryPath), item);
  }

  for (const event of events) {
    await addDoc(collection(db, eventsPath), event);
  }

  await updateDoc(doc(db, settingsPath), {
    orgName: "Literature Inventory Management",
    taxId: "TX-9920-441-B",
    address: "722 Industrial Parkway, Suite 400\nNew London, CT 06320\nUnited States",
    timezone: "UTC-05:00 Eastern Standard",
    updateFrequency: "Real-time (Atomic)"
  });
}
