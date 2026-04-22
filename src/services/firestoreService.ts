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

// --- Audit Logs ---

export type AuditAction = 
  | 'STOCK_UPDATE' 
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
      timestamp: serverTimestamp()
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
      createdAt: serverTimestamp(),
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

export async function addInventoryItem(item: any) {
  const path = 'inventory';
  try {
    // Check for SKU uniqueness
    const existing = await getInventoryItemBySku(item.sku);
    if (existing) {
      throw new Error(`SKU "${item.sku}" already exists in the inventory.`);
    }

    const docRef = await addDoc(collection(db, path), {
      ...item,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    await createAuditLog('ITEM_CREATED', docRef.id, 'inventory', `Created item: ${item.title} (${item.sku})`, { item });
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
      updatedAt: serverTimestamp()
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

export async function deleteInventoryItem(id: string, itemTitle?: string) {
  const path = `inventory/${id}`;
  try {
    const docRef = doc(db, 'inventory', id);
    await deleteDoc(docRef);
    await createAuditLog('ITEM_DELETED', id, 'inventory', `Deleted item: ${itemTitle || id}`);
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

      for (const item of items) {
        const itemRef = doc(db, 'inventory', item.itemId);
        const itemDoc = await transaction.get(itemRef);
        
        if (!itemDoc.exists()) {
          throw new Error(`Item ${item.title} does not exist!`);
        }

        const data = itemDoc.data();
        const currentStock = data.stockLevel || 0;
        if (currentStock < item.quantity) {
          throw new Error(`Insufficient stock for ${item.title}. Available: ${currentStock}`);
        }

        const newStock = currentStock - item.quantity;

        // Update inventory
        transaction.update(itemRef, {
          stockLevel: newStock,
          updatedAt: serverTimestamp()
        });

        // Add to stats delta
        const cat = (data.category || '').toLowerCase();
        const lang = (data.language || '').toLowerCase();
        
        if (cat.includes('bible')) {
          statsDelta.bibles += item.quantity;
          if (lang.includes('english')) statsDelta.bibles_en += item.quantity;
          else if (lang.includes('spanish')) statsDelta.bibles_es += item.quantity;
        } else if (cat.includes('tract')) {
          statsDelta.tracts += item.quantity;
          if (lang.includes('english')) statsDelta.tracts_en += item.quantity;
          else if (lang.includes('spanish')) statsDelta.tracts_es += item.quantity;
        } else if (cat.includes('booklet')) {
          statsDelta.booklets += item.quantity;
          if (lang.includes('english')) statsDelta.booklets_en += item.quantity;
          else if (lang.includes('spanish')) statsDelta.booklets_es += item.quantity;
        }

        // Add to event materials
        const materialRef = doc(collection(db, `events/${eventId}/materials`));
        transaction.set(materialRef, {
          itemId: item.itemId,
          sku: item.sku,
          title: item.title,
          quantity: item.quantity,
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
    await createAuditLog('SETTINGS_UPDATE', 'system', 'settings', 'Updated system settings', { settings });
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
    await createAuditLog('ROLE_UPDATE', userId, 'user', `Updated user role to ${role}`, { role });
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
      lastLogin: serverTimestamp()
    };
    
    if (!userDoc.exists()) {
      // 1. Check if email is authorized
      const normalizedEmail = user.email?.toLowerCase();
      const authEmailRef = doc(db, 'authorized_emails', normalizedEmail);
      const authEmailDoc = await getDoc(authEmailRef);
      // Use environment variable with hardcoded fallback if not set
      const primaryAdminEmail = import.meta.env.VITE_PRIMARY_ADMIN_EMAIL?.toLowerCase() || "yilongwang05@gmail.com";
      const isPrimaryAdmin = normalizedEmail === primaryAdminEmail;

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

      // 3. Process each material and calculate stats
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
            if (lang.includes('english')) stats.bibles_en += material.quantity;
            else if (lang.includes('spanish')) stats.bibles_es += material.quantity;
          } else if (cat.includes('tract')) {
            stats.tracts += material.quantity;
            if (lang.includes('english')) stats.tracts_en += material.quantity;
            else if (lang.includes('spanish')) stats.tracts_es += material.quantity;
          } else if (cat.includes('booklet')) {
            stats.booklets += material.quantity;
            if (lang.includes('english')) stats.booklets_en += material.quantity;
            else if (lang.includes('spanish')) stats.booklets_es += material.quantity;
          }
        }

        if (itemInfo) {
          const itemRef = doc(db, 'inventory', itemInfo.id);
          const itemDocForLock = await transaction.get(itemRef);
          const currentStock = itemDocForLock.data()?.stockLevel || 0;
          
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

      // Fix for one-day-off bug: parse date as noon to avoid UTC/Local midnight shifts
      const eventDate = eventData.date.includes('T') ? new Date(eventData.date) : new Date(`${eventData.date}T12:00:00`);

      transaction.set(eventRef, {
        name: eventData.name,
        date: Timestamp.fromDate(eventDate),
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

export async function seedData() {
  const inventoryPath = 'inventory';
  const eventsPath = 'events';
  const settingsPath = 'settings/system';

  const items = [
    { sku: 'B-EN-001', title: 'NKJV Holy Bible', subtitle: 'Pew Edition - Hardcover', category: 'Bibles', language: 'English', stockLevel: 450, unitPrice: 12.50, status: 'Healthy', updatedAt: serverTimestamp() },
    { sku: 'B-ES-001', title: 'Santa Biblia RV1960', subtitle: 'Edición de Estudio', category: 'Bibles', language: 'Spanish', stockLevel: 320, unitPrice: 15.50, status: 'Healthy', updatedAt: serverTimestamp() },
    { sku: 'T-EN-001', title: 'Steps to Christ', subtitle: 'Pocket Tract', category: 'Tracts', language: 'English', stockLevel: 2500, unitPrice: 0.15, status: 'Healthy', updatedAt: serverTimestamp() },
    { sku: 'T-ES-001', title: 'El Camino a Cristo', subtitle: 'Tratado de Bolsillo', category: 'Tracts', language: 'Spanish', stockLevel: 1800, unitPrice: 0.15, status: 'Healthy', updatedAt: serverTimestamp() },
    { sku: 'BK-EN-001', title: 'Understanding Prophecy', subtitle: 'Introductory Booklet', category: 'Booklets', language: 'English', stockLevel: 120, unitPrice: 2.50, status: 'Low', updatedAt: serverTimestamp() },
    { sku: 'BK-ES-001', title: 'Entendiendo la Profecía', subtitle: 'Folleto Introductorio', category: 'Booklets', language: 'Spanish', stockLevel: 85, unitPrice: 2.50, status: 'Low', updatedAt: serverTimestamp() },
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
    timezone: "America/New_York",
    updateFrequency: "Real-time (Atomic)",
    categories: ['Bibles', 'Tracts', 'Booklets']
  });
}
