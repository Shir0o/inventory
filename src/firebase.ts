import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

// Connection test
async function testConnection() {
  try {
    // Attempt to fetch a connectivity test doc
    await getDocFromServer(doc(db, '_system_', 'connectivity_test'));
    console.log("Firebase connection established.");
  } catch (error: any) {
    if (error instanceof Error) {
      if (error.message.includes('the client is offline') || (error as any).code === 'unavailable') {
        console.info("Firestore connection: Offline or connecting in background.", error.message);
      }
    }
  }
}

testConnection();

export { signInWithPopup, onAuthStateChanged };
export type { User };
