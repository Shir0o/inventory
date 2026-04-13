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
  FirestoreError
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

// --- Inventory ---

export async function addInventoryItem(item: any) {
  const path = 'inventory';
  try {
    return await addDoc(collection(db, path), {
      ...item,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateInventoryItem(id: string, item: any) {
  const path = `inventory/${id}`;
  try {
    const docRef = doc(db, 'inventory', id);
    return await updateDoc(docRef, {
      ...item,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteInventoryItem(id: string) {
  const path = `inventory/${id}`;
  try {
    const docRef = doc(db, 'inventory', id);
    return await deleteDoc(docRef);
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
    return await addDoc(collection(db, path), {
      ...event,
      createdAt: new Date().toISOString()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateEvent(id: string, event: any) {
  const path = `events/${id}`;
  try {
    const docRef = doc(db, 'events', id);
    return await updateDoc(docRef, event);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteEvent(id: string) {
  const path = `events/${id}`;
  try {
    const docRef = doc(db, 'events', id);
    return await deleteDoc(docRef);
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
    return await updateDoc(doc(db, path), settings);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
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
    { name: 'Regional Meeting - North Sector', date: Timestamp.fromDate(new Date('2024-10-12')), location: 'Grand Plaza Convention Center', materialsAssigned: 1250, status: 'Scheduled', createdAt: new Date().toISOString() },
    { name: 'Weekly Bible Study Series', date: Timestamp.fromDate(new Date('2024-10-14')), location: 'Community Center West', materialsAssigned: 420, status: 'Stock Alert', createdAt: new Date().toISOString() },
  ];

  for (const item of items) {
    await addDoc(collection(db, inventoryPath), item);
  }

  for (const event of events) {
    await addDoc(collection(db, eventsPath), event);
  }

  await updateDoc(doc(db, settingsPath), {
    orgName: "Literature Ledger Global Operations",
    taxId: "TX-9920-441-B",
    address: "722 Industrial Parkway, Suite 400\nNew London, CT 06320\nUnited States",
    timezone: "UTC-05:00 Eastern Standard",
    updateFrequency: "Real-time (Atomic)"
  });
}
